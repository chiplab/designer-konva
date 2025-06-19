import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useState, useCallback } from "react";
import { Page, Modal, TextField, Banner, ChoiceList, Text, BlockStack } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import DesignerCanvas from "../components/DesignerCanvas";
import db from "../db.server";

const GET_PRODUCT_VARIANT = `#graphql
  query GetProductVariant($productId: ID!, $variantId: ID!) {
    product(id: $productId) {
      id
      title
    }
    productVariant(id: $variantId) {
      id
      title
      displayName
      image {
        url
        altText
      }
      selectedOptions {
        name
        value
      }
    }
  }
`;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const templateId = url.searchParams.get("template");
  const productId = url.searchParams.get("productId");
  const variantId = url.searchParams.get("variantId");
  const layoutId = url.searchParams.get("layoutId"); // Legacy support
  const layoutVariantId = url.searchParams.get("layoutVariantId"); // New layout system
  
  let template = null;
  let productLayout = null;
  let shopifyProduct = null;
  let shopifyVariant = null;
  let layoutVariant = null;
  
  if (templateId) {
    // Loading existing template
    template = await db.template.findFirst({
      where: {
        id: templateId,
        shop: session.shop,
      },
      include: {
        productLayout: true,
      },
    });
    
    // If template has Shopify references, load them
    if (template?.shopifyProductId && template?.shopifyVariantId) {
      try {
        const response = await admin.graphql(GET_PRODUCT_VARIANT, {
          variables: {
            productId: template.shopifyProductId,
            variantId: template.shopifyVariantId,
          }
        });
        const data = await response.json();
        shopifyProduct = data.data?.product;
        shopifyVariant = data.data?.productVariant;
      } catch (error) {
        console.error("Error loading Shopify data:", error);
      }
    }
    
    productLayout = template?.productLayout;
  } else if (productId && variantId) {
    // Creating new template for specific variant
    try {
      const response = await admin.graphql(GET_PRODUCT_VARIANT, {
        variables: { productId, variantId }
      });
      const data = await response.json();
      shopifyProduct = data.data?.product;
      shopifyVariant = data.data?.productVariant;
    } catch (error) {
      console.error("Error loading Shopify variant:", error);
    }
  } else if (layoutId) {
    // Legacy support for old ProductLayout system
    productLayout = await db.productLayout.findFirst({
      where: {
        id: layoutId,
        shop: session.shop,
      },
    });
  } else if (layoutVariantId) {
    // New layout system - load the layout variant with its layout
    layoutVariant = await db.layoutVariant.findFirst({
      where: {
        id: layoutVariantId,
      },
      include: {
        layout: true,
      },
    });
    
    // Verify the layout belongs to this shop
    if (layoutVariant && layoutVariant.layout.shop !== session.shop) {
      layoutVariant = null;
    }
  }
  
  return json({
    shop: session.shop,
    template,
    productLayout,
    shopifyProduct,
    shopifyVariant,
    layoutVariant,
  });
};

export default function Designer() {
  const { template, productLayout, shopifyProduct, shopifyVariant, layoutVariant } = useLoaderData<typeof loader>();
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState(template?.name || "");
  const [products, setProducts] = useState<any[]>([]);
  const [selectedVariants, setSelectedVariants] = useState<string[]>(
    shopifyVariant ? [shopifyVariant.id] : []
  );
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  // Canvas data from child component
  const [pendingCanvasData, setPendingCanvasData] = useState<any>(null);
  const [pendingThumbnail, setPendingThumbnail] = useState<string | null>(null);
  
  // Determine the title based on what we're doing
  let title = "Template Designer";
  if (template) {
    title = `Edit: ${template.name}`;
  } else if (shopifyVariant) {
    title = `New Template: ${shopifyVariant.displayName}`;
  } else if (layoutVariant) {
    title = `New Template: ${layoutVariant.variantTitle}`;
  } else if (productLayout) {
    title = `New Template for ${productLayout.name}`;
  }
  
  // Load products when modal opens
  const handleOpenSaveModal = useCallback(async (canvasData: any, thumbnail: string | undefined) => {
    setPendingCanvasData(canvasData);
    setPendingThumbnail(thumbnail || null);
    setSaveModalOpen(true);
    setSaveError(null);
    
    // If we already have a product/variant from the URL, we might not need to load products
    if (!shopifyProduct && !products.length) {
      setLoadingProducts(true);
      try {
        const response = await fetch('/app/api/products');
        const data = await response.json();
        setProducts(data.products || []);
      } catch (error) {
        console.error('Error fetching products:', error);
        setSaveError('Failed to load products');
      } finally {
        setLoadingProducts(false);
      }
    }
  }, [shopifyProduct, products.length]);
  
  // Handle the actual save
  const handleSave = useCallback(async () => {
    if (!templateName.trim()) {
      setSaveError("Please enter a template name");
      return;
    }
    
    // For new templates, we need a variant selected
    if (!template && selectedVariants.length === 0) {
      setSaveError("Please select a product variant");
      return;
    }
    
    setSaving(true);
    setSaveError(null);
    
    try {
      const formData = new FormData();
      formData.append('name', templateName);
      formData.append('canvasData', JSON.stringify(pendingCanvasData));
      
      if (pendingThumbnail) {
        formData.append('thumbnail', pendingThumbnail);
      }
      
      // If editing existing template
      if (template?.id) {
        formData.append('templateId', template.id);
      }
      
      // Extract color from variant for color variant generation
      let colorVariant = null;
      
      // For new templates, use the selected variant
      if (selectedVariants.length > 0 && !template) {
        // Find the product and variant IDs
        const selectedVariantId = selectedVariants[0];
        let selectedProductId = null;
        let selectedVariantDisplayName = null;
        
        console.log('Selected variant ID:', selectedVariantId);
        console.log('Products available:', products);
        
        // If we have shopifyProduct from props, use it
        if (shopifyProduct) {
          selectedProductId = shopifyProduct.id;
          console.log('Using shopifyProduct from props:', selectedProductId);
          
          // We already have the variant displayName from props
          if (shopifyVariant) {
            selectedVariantDisplayName = shopifyVariant.displayName;
          }
        } else {
          // Find the product that contains this variant
          for (const product of products) {
            const variantEdge = product.variants.edges.find(
              (edge: any) => edge.node.id === selectedVariantId
            );
            if (variantEdge) {
              selectedProductId = product.id;
              selectedVariantDisplayName = variantEdge.node.displayName;
              console.log('Found product for variant:', selectedProductId);
              console.log('Variant display name:', selectedVariantDisplayName);
              break;
            }
          }
        }
        
        // Extract color from displayName or selectedOptions
        if (selectedVariantDisplayName) {
          console.log('Full variant display name:', selectedVariantDisplayName);
          
          // First try to get color from selectedOptions if we have the full variant data
          let extractedColor = null;
          
          // Try to find the variant in products to get selectedOptions
          for (const product of products) {
            const variantEdge = product.variants.edges.find(
              (edge: any) => edge.node.id === selectedVariantId
            );
            if (variantEdge && variantEdge.node.selectedOptions) {
              console.log('Variant selectedOptions:', variantEdge.node.selectedOptions);
              
              // Look for a "Color" option
              const colorOption = variantEdge.node.selectedOptions.find(
                (opt: any) => opt.name.toLowerCase() === 'color'
              );
              if (colorOption) {
                extractedColor = colorOption.value.toLowerCase();
                console.log('Found color from selectedOptions:', extractedColor);
                break;
              }
            }
          }
          
          // If no color option found, try parsing the display name
          if (!extractedColor) {
            const parts = selectedVariantDisplayName.split('/');
            console.log('Display name parts:', parts);
            
            if (parts.length >= 2) {
              // Try both first and last parts, see which one looks like a color
              const firstPart = parts[0].trim().toLowerCase();
              const lastPart = parts[parts.length - 1].trim().toLowerCase();
              
              // Common color names - include multi-word colors first
              const multiWordColors = ['light blue'];
              const singleWordColors = ['red', 'blue', 'green', 'black', 'white', 'purple', 'yellow', 'grey', 'gray', 'orange', 'ivory', 'pink', 'brown'];
              
              // First check for multi-word colors in the full display name
              let foundMultiWord = false;
              for (const color of multiWordColors) {
                if (selectedVariantDisplayName.toLowerCase().includes(color)) {
                  extractedColor = color.replace(' ', '-'); // Convert "light blue" to "light-blue"
                  foundMultiWord = true;
                  break;
                }
              }
              
              // If no multi-word color found, check single-word colors
              if (!foundMultiWord) {
                if (singleWordColors.includes(firstPart)) {
                  extractedColor = firstPart;
                } else if (singleWordColors.includes(lastPart)) {
                  extractedColor = lastPart;
                } else {
                  // Try to find a color word in the full display name
                  for (const color of singleWordColors) {
                    if (selectedVariantDisplayName.toLowerCase().includes(color)) {
                      extractedColor = color;
                      break;
                    }
                  }
                }
              }
            }
          }
          
          colorVariant = extractedColor;
          console.log('Final extracted color variant:', colorVariant);
        }
        
        if (selectedProductId) {
          console.log('Appending to formData - productId:', selectedProductId, 'variantId:', selectedVariantId);
          formData.append('shopifyProductId', selectedProductId);
          formData.append('shopifyVariantId', selectedVariantId);
          
          if (colorVariant) {
            formData.append('colorVariant', colorVariant);
          }
        } else {
          console.error('Could not find product ID for selected variant!');
          setSaveError('Could not find product for selected variant');
          setSaving(false);
          return;
        }
      } else if (template) {
        // Preserve existing product/variant for updates
        if (template.shopifyProductId) {
          formData.append('shopifyProductId', template.shopifyProductId);
        }
        if (template.shopifyVariantId) {
          formData.append('shopifyVariantId', template.shopifyVariantId);
        }
        // For existing templates, check if we need to extract color
        if (!template.colorVariant && shopifyVariant?.displayName) {
          const parts = shopifyVariant.displayName.split('/');
          if (parts.length >= 2) {
            colorVariant = parts[parts.length - 1].trim().toLowerCase();
            if (colorVariant) {
              formData.append('colorVariant', colorVariant);
            }
          }
        }
      }
      
      // Legacy support
      if (productLayout?.id) {
        formData.append('productLayoutId', productLayout.id);
      }
      
      // New layout system
      if (layoutVariant?.id) {
        formData.append('layoutVariantId', layoutVariant.id);
        
        // Also extract and send color from layout variant
        if (layoutVariant.color && !colorVariant) {
          formData.append('colorVariant', layoutVariant.color.toLowerCase());
        }
      }
      
      // Log all formData entries
      console.log('FormData being sent:');
      for (const [key, value] of formData.entries()) {
        console.log(`  ${key}:`, value);
      }
      
      const response = await fetch('/api/templates/save', {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      
      if (result.success) {
        // @ts-ignore - shopify is globally available in embedded apps
        if (typeof shopify !== 'undefined' && shopify.toast) {
          shopify.toast.show('Template saved successfully!', { duration: 3000 });
        }
        
        // Redirect to templates page or stay on editor
        if (!template) {
          // New template - redirect to templates
          window.location.href = '/app/templates';
        } else {
          // Updated existing - close modal and stay
          setSaveModalOpen(false);
        }
      } else {
        setSaveError(result.error || 'Failed to save template');
      }
    } catch (error) {
      console.error('Error saving template:', error);
      setSaveError('Failed to save template');
    } finally {
      setSaving(false);
    }
  }, [templateName, template, selectedVariants, pendingCanvasData, pendingThumbnail, products, shopifyProduct, productLayout]);
  
  return (
    <Page fullWidth>
      <TitleBar title={title}>
        <button onClick={() => window.location.href = "/app/templates"}>
          View all templates
        </button>
      </TitleBar>
      <div style={{ 
        height: 'calc(100vh - 64px)', // Account for top bar only
        minHeight: '600px',
        position: 'relative',
        backgroundColor: '#ffffff'
      }}>
        <DesignerCanvas 
          initialTemplate={template} 
          productLayout={productLayout}
          shopifyProduct={shopifyProduct}
          shopifyVariant={shopifyVariant}
          layoutVariant={layoutVariant}
          onSave={handleOpenSaveModal}
          isAdminView={true}
        />
      </div>
      
      <Modal
        open={saveModalOpen}
        onClose={() => {
          setSaveModalOpen(false);
          setSaveError(null);
        }}
        title={template ? "Update Template" : "Save New Template"}
        primaryAction={{
          content: "Save",
          onAction: handleSave,
          loading: saving,
          disabled: saving || (!template && selectedVariants.length === 0),
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => {
              setSaveModalOpen(false);
              setSaveError(null);
            },
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            {saveError && (
              <Banner tone="critical">
                <p>{saveError}</p>
              </Banner>
            )}
            
            <TextField
              label="Template Name"
              value={templateName}
              onChange={setTemplateName}
              placeholder="Enter a name for this template"
              autoComplete="off"
              requiredIndicator
            />
            
            {/* Show product selection only for new templates without pre-selected variant */}
            {!template && !shopifyVariant && (
              <>
                <Text variant="headingMd" as="h3">Select Product Variant</Text>
                <Text variant="bodySm" tone="subdued" as="p">
                  Choose which product variant this template is for
                </Text>
                
                {loadingProducts ? (
                  <Text as="p">Loading products...</Text>
                ) : products.length === 0 ? (
                  <Banner tone="warning">
                    <p>No products found. Please create a product in Shopify first.</p>
                  </Banner>
                ) : (
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {products.map((product: any) => (
                      <div key={product.id} style={{ marginBottom: '16px' }}>
                        <Text variant="headingSm" as="h4">{product.title}</Text>
                        <ChoiceList
                          title=""
                          choices={product.variants.edges.map((edge: any) => ({
                            label: edge.node.displayName,
                            value: edge.node.id,
                          }))}
                          selected={selectedVariants}
                          onChange={(value) => setSelectedVariants(value.slice(0, 1))} // Only allow one selection
                        />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            
            {/* Show pre-selected variant info */}
            {shopifyVariant && (
              <Banner tone="info">
                <p>This template will be saved for: <strong>{shopifyVariant.displayName}</strong></p>
              </Banner>
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useActionData } from "@remix-run/react";
import { useState, useCallback, useEffect } from "react";
import {
  Page,
  Layout,
  Card,
  ResourceList,
  ResourceItem,
  Text,
  Thumbnail,
  EmptyState,
  Badge,
  Banner,
  Modal,
  BlockStack,
  InlineStack,
  Button,
  Grid,
  ProgressBar,
  Box,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { uploadToS3 } from "../services/s3.server";

// GraphQL query to get products with layout source metafield
const PRODUCTS_WITH_LAYOUT_SOURCE_QUERY = `#graphql
  query GetProductsWithLayoutSource($cursor: String) {
    products(first: 100, after: $cursor, query: "metafield.custom_designer.is_template_source:true") {
      edges {
        node {
          id
          title
          featuredImage {
            url
          }
          variants(first: 100) {
            edges {
              node {
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
          }
          metafield(namespace: "custom_designer", key: "is_template_source") {
            value
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("_action");

  if (action === "createLayout") {
    const productId = formData.get("productId") as string;
    const productTitle = formData.get("productTitle") as string;
    const variantsJson = formData.get("variants") as string;
    
    try {
      const variants = JSON.parse(variantsJson);
      
      // Create the layout
      const layout = await db.layout.create({
        data: {
          shop: session.shop,
          shopifyProductId: productId,
          productTitle: productTitle,
        },
      });
      
      // Process each variant
      for (let i = 0; i < variants.length; i++) {
        const variant = variants[i];
        
        // Extract color and pattern from variant title
        const titleParts = variant.title.split(" / ");
        let color = null;
        let pattern = null;
        
        if (titleParts.length === 2) {
          color = titleParts[0].trim();
          pattern = titleParts[1].trim();
        }
        
        console.log(`Processing variant ${i + 1}/${variants.length}: ${variant.title}`);
        
        // Upload image to S3 if present
        let s3ImageUrl = "";
        if (variant.imageUrl) {
          try {
            // Force WebP format from Shopify CDN with explicit parameters
            // Using .webp extension and format=webp to be more explicit
            const baseUrl = variant.imageUrl.split('?')[0];
            const optimizedUrl = `${baseUrl}.webp?width=1200&format=webp&quality=85`;
            const response = await fetch(optimizedUrl, {
              headers: {
                'Accept': 'image/webp,image/*,*/*;q=0.8'
              }
            });
            const buffer = await response.arrayBuffer();
            const imageBuffer = Buffer.from(buffer);
            
            // Detect actual content type from response
            const contentType = response.headers.get('content-type') || 'image/webp';
            const extension = contentType.includes('webp') ? '.webp' : '.png';
            
            // Log what we're getting
            console.log(`Variant ${variant.title}: Requested WebP, got ${contentType}`);
            
            // Create descriptive filename based on color and pattern
            const colorSlug = (color || 'default').toLowerCase().replace(/\s+/g, '-');
            const patternSlug = pattern ? `-${pattern.toLowerCase().replace(/\s+/g, '-')}` : '';
            const fileName = `${colorSlug}${patternSlug}-base${extension}`;
            
            // Upload with correct naming and content type
            const s3Key = `layouts/${session.shop}/${layout.id}/variants/${variant.id}/${fileName}`;
            const s3Url = await uploadToS3(s3Key, imageBuffer, { contentType });
            s3ImageUrl = s3Url;
          } catch (error) {
            console.error(`Failed to upload image for variant ${variant.id}:`, error);
            // Use Shopify URL as fallback
            s3ImageUrl = variant.imageUrl;
          }
        }
        
        // Create layout variant
        await db.layoutVariant.create({
          data: {
            layoutId: layout.id,
            shopifyVariantId: variant.id,
            variantTitle: variant.title,
            baseImageUrl: s3ImageUrl,
            shopifyImageUrl: variant.imageUrl,
            position: i,
            color: color,
            pattern: pattern,
          },
        });
      }
      
      return json({ 
        success: true, 
        message: `Layout created successfully with ${variants.length} variants`,
        layoutId: layout.id
      });
      
    } catch (error) {
      console.error("Error creating layout:", error);
      return json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to create layout" 
      }, { status: 500 });
    }
  }
  
  if (action === "deleteLayout") {
    const layoutId = formData.get("layoutId") as string;
    
    try {
      // Verify ownership
      const layout = await db.layout.findFirst({
        where: {
          id: layoutId,
          shop: session.shop,
        },
      });
      
      if (!layout) {
        return json({ 
          success: false, 
          error: "Layout not found or access denied" 
        }, { status: 404 });
      }
      
      // Delete layout (cascade will delete variants)
      await db.layout.delete({
        where: { id: layoutId },
      });
      
      return json({ 
        success: true, 
        message: "Layout deleted successfully" 
      });
      
    } catch (error) {
      console.error("Error deleting layout:", error);
      return json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to delete layout" 
      }, { status: 500 });
    }
  }

  return json({ success: false });
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  
  try {
    // Get existing layouts
    const layouts = await db.layout.findMany({
      where: { shop: session.shop },
      include: {
        layoutVariants: {
          orderBy: { position: 'asc' }
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    // Get products with layout source metafield
    const productsWithLayoutSource = [];
    let cursor = null;
    
    do {
      const response = await admin.graphql(PRODUCTS_WITH_LAYOUT_SOURCE_QUERY, {
        variables: { cursor }
      });
      
      const data = await response.json();
      
      // Debug logging
      console.log("GraphQL response:", JSON.stringify(data, null, 2));
      
      if (data.data?.products?.edges) {
        // Filter to only include products that actually have the metafield set to true
        const filteredProducts = data.data.products.edges
          .map((edge: any) => edge.node)
          .filter((product: any) => {
            // Check if the metafield exists and is set to "true"
            const hasMetafield = product.metafield?.value === "true";
            if (hasMetafield) {
              console.log(`Product "${product.title}" has is_template_source = true`);
            }
            return hasMetafield;
          });
        
        productsWithLayoutSource.push(...filteredProducts);
        cursor = data.data.products.pageInfo.hasNextPage ? data.data.products.pageInfo.endCursor : null;
      } else {
        console.error("No products data in response:", data);
        break;
      }
    } while (cursor);
    
    return json({ 
      layouts, 
      productsWithLayoutSource,
      error: null 
    });
    
  } catch (error) {
    console.error("Error loading layouts:", error);
    return json({ 
      layouts: [], 
      productsWithLayoutSource: [],
      error: "Failed to load data" 
    });
  }
};

export default function ProductLayouts() {
  const { layouts, productsWithLayoutSource, error } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [creationProgress, setCreationProgress] = useState({ current: 0, total: 0, variant: '' });
  const submit = useSubmit();
  
  useEffect(() => {
    if (actionData?.success) {
      setShowSuccessBanner(true);
      setIsCreating(false);
      setCreationProgress({ current: 0, total: 0, variant: '' });
      setTimeout(() => setShowSuccessBanner(false), 5000);
    }
  }, [actionData]);
  
  // Simulate progress while creating
  useEffect(() => {
    if (isCreating && creationProgress.total > 0) {
      const interval = setInterval(() => {
        setCreationProgress(prev => {
          // Estimate ~1 second per variant
          const estimatedProgress = Math.min(prev.current + 1, prev.total - 1);
          return { ...prev, current: estimatedProgress };
        });
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [isCreating, creationProgress.total]);

  const handleCreateLayout = useCallback((product: any) => {
    setSelectedProduct(product);
    setShowProductModal(true);
  }, []);

  const handleConfirmCreateLayout = useCallback(() => {
    if (selectedProduct) {
      // Extract variant data
      const variants = selectedProduct.variants.edges.map((edge: any) => {
        const colorOption = edge.node.selectedOptions?.find((opt: any) => opt.name === "Color");
        const patternOption = edge.node.selectedOptions?.find((opt: any) => 
          opt.name === "Edge Pattern" || opt.name === "Pattern"
        );
        
        // Construct title as "Color / Pattern" if both are available
        let variantTitle = edge.node.displayName || edge.node.title;
        if (colorOption && patternOption) {
          variantTitle = `${colorOption.value} / ${patternOption.value}`;
        }
        
        return {
          id: edge.node.id,
          title: variantTitle,
          imageUrl: edge.node.image?.url || null,
        };
      });
      
      // Set up progress tracking
      setIsCreating(true);
      setCreationProgress({ current: 0, total: variants.length, variant: 'Initializing...' });
      setShowProductModal(false);
      
      // Start the creation process
      const formData = new FormData();
      formData.append("_action", "createLayout");
      formData.append("productId", selectedProduct.id);
      formData.append("productTitle", selectedProduct.title);
      formData.append("variants", JSON.stringify(variants));
      submit(formData, { method: "post" });
      
      setSelectedProduct(null);
    }
  }, [selectedProduct, submit]);

  const handleDeleteLayout = useCallback((layoutId: string) => {
    if (confirm("Are you sure you want to delete this layout? This will not affect any templates created from it.")) {
      const formData = new FormData();
      formData.append("_action", "deleteLayout");
      formData.append("layoutId", layoutId);
      submit(formData, { method: "post" });
    }
  }, [submit]);

  const emptyStateMarkup = (
    <EmptyState
      heading="No product layouts found"
      action={{
        content: "Create your first layout",
        onAction: () => setShowProductModal(true),
      }}
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <p>
        Product layouts define the base images for each variant. 
        Create a layout to start designing templates.
      </p>
    </EmptyState>
  );

  const layoutsMarkup = (
    <BlockStack gap="400">
      {layouts.map((layout) => (
        <Card key={layout.id}>
          <BlockStack gap="400">
            <InlineStack align="space-between">
              <div>
                <Text variant="headingLg" as="h2">{layout.productTitle}</Text>
                <Text variant="bodySm" tone="subdued">
                  {layout.layoutVariants.length} variants • Created {new Date(layout.createdAt).toLocaleDateString()}
                </Text>
              </div>
              <Button tone="critical" onClick={() => handleDeleteLayout(layout.id)}>
                Delete Layout
              </Button>
            </InlineStack>
            
            <Grid columns={{ xs: 2, sm: 3, md: 4, lg: 6 }}>
              {layout.layoutVariants.slice(0, 12).map((variant) => (
                <div key={variant.id} style={{ textAlign: 'center' }}>
                  <Thumbnail
                    source={variant.baseImageUrl || "https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"}
                    alt={variant.variantTitle}
                    size="large"
                  />
                  <Text variant="bodySm" as="p" tone="subdued">
                    {variant.color && variant.pattern ? `${variant.color} / ${variant.pattern}` : variant.variantTitle}
                  </Text>
                </div>
              ))}
            </Grid>
            
            {layout.layoutVariants.length > 12 && (
              <Text variant="bodySm" tone="subdued" alignment="center">
                +{layout.layoutVariants.length - 12} more variants
              </Text>
            )}
          </BlockStack>
        </Card>
      ))}
    </BlockStack>
  );

  const availableProductsMarkup = productsWithLayoutSource.length > 0 && (
    <Card>
      <BlockStack gap="400">
        <Text variant="headingMd" as="h2">Available Products for Layout Creation</Text>
        <ResourceList
          resourceName={{ singular: "product", plural: "products" }}
          items={productsWithLayoutSource.filter(p => !layouts.some(l => l.shopifyProductId === p.id))}
          renderItem={(product) => {
            const { id, title, featuredImage, variants } = product;
            const media = featuredImage ? (
              <Thumbnail source={featuredImage.url} alt={title} size="small" />
            ) : (
              <Thumbnail
                source="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                alt="No image"
                size="small"
              />
            );

            return (
              <ResourceItem
                id={id}
                media={media}
                accessibilityLabel={`Create layout for ${title}`}
              >
                <InlineStack align="space-between">
                  <div>
                    <Text variant="bodyMd" fontWeight="bold" as="h3">
                      {title}
                    </Text>
                    <Text variant="bodySm" tone="subdued">
                      {variants.edges.length} variants
                    </Text>
                  </div>
                  <Button onClick={() => handleCreateLayout(product)}>
                    Create Layout
                  </Button>
                </InlineStack>
              </ResourceItem>
            );
          }}
        />
      </BlockStack>
    </Card>
  );

  return (
    <Page fullWidth>
      {showSuccessBanner && actionData?.success && (
        <Banner tone="success" onDismiss={() => setShowSuccessBanner(false)}>
          <p>{actionData.message}</p>
        </Banner>
      )}
      
      {actionData && !actionData.success && actionData.error && (
        <Banner tone="critical" onDismiss={() => {}}>
          <p>Error: {actionData.error}</p>
        </Banner>
      )}
      
      {error && (
        <Banner tone="critical" onDismiss={() => {}}>
          <p>{error}</p>
        </Banner>
      )}
      
      <TitleBar title="Product Layouts">
        <button variant="primary" onClick={() => setShowProductModal(true)}>
          Create layout
        </button>
      </TitleBar>
      
      <Layout>
        <Layout.Section>
          {layouts.length === 0 && productsWithLayoutSource.length === 0 ? (
            <Card padding="0">
              {emptyStateMarkup}
            </Card>
          ) : (
            <BlockStack gap="600">
              {layouts.length > 0 && layoutsMarkup}
              {availableProductsMarkup}
            </BlockStack>
          )}
        </Layout.Section>
      </Layout>
      
      <Modal
        open={showProductModal}
        onClose={() => {
          setShowProductModal(false);
          setSelectedProduct(null);
        }}
        title="Create Product Layout"
        primaryAction={selectedProduct ? {
          content: "Create Layout",
          onAction: handleConfirmCreateLayout,
        } : undefined}
        secondaryActions={[{
          content: "Cancel",
          onAction: () => {
            setShowProductModal(false);
            setSelectedProduct(null);
          },
        }]}
      >
        <Modal.Section>
          {selectedProduct ? (
            <BlockStack gap="400">
              <Text as="p">
                Create a layout for <strong>{selectedProduct.title}</strong>?
              </Text>
              <Text as="p" tone="subdued">
                This will create a layout with {selectedProduct.variants.edges.length} variants. 
                Each variant's image will be downloaded and stored for fast access.
              </Text>
            </BlockStack>
          ) : (
            <Text as="p">
              Select a product that has the "Is Layout Source" metafield set to true.
            </Text>
          )}
        </Modal.Section>
      </Modal>
      
      <Modal
        open={isCreating}
        onClose={() => {}}
        title="Creating Product Layout"
        size="small"
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Text as="p" variant="headingMd">
              Optimizing variant images...
            </Text>
            
            <Box paddingBlockStart="200" paddingBlockEnd="200">
              <ProgressBar 
                progress={creationProgress.total > 0 ? (creationProgress.current / creationProgress.total) * 100 : 0} 
                tone="primary"
                animated
              />
            </Box>
            
            <InlineStack align="space-between">
              <Text as="p" tone="subdued" variant="bodySm">
                Processing {creationProgress.current} of {creationProgress.total} variants
              </Text>
              <Text as="p" tone="subdued" variant="bodySm">
                {creationProgress.total > 0 ? Math.round((creationProgress.current / creationProgress.total) * 100) : 0}%
              </Text>
            </InlineStack>
            
            <Card background="bg-surface-secondary">
              <BlockStack gap="200">
                <Text as="p" variant="bodySm" fontWeight="semibold">
                  What's happening:
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  • Fetching optimized WebP images from Shopify CDN
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  • Reducing file sizes by ~70% for faster loading
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  • Creating unique filenames to prevent caching issues
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  • Storing images with correct content types
                </Text>
              </BlockStack>
            </Card>
            
            <Text as="p" tone="subdued" variant="bodySm" alignment="center">
              This is a one-time process. Please don't close this window.
            </Text>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  ResourceList,
  ResourceItem,
  Text,
  Thumbnail,
  Badge,
  Button,
  Banner,
  EmptyState,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

const GET_PRODUCT_WITH_VARIANTS = `#graphql
  query GetProductWithVariants($id: ID!) {
    product(id: $id) {
      id
      title
      status
      featuredImage {
        url
      }
      variants(first: 100) {
        edges {
          node {
            id
            title
            displayName
            price
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
    }
  }
`;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const productId = url.searchParams.get("productId");
  
  if (!productId) {
    return json({ error: "Product ID is required", product: null, templates: {} });
  }
  
  try {
    // Fetch product from Shopify
    const response = await admin.graphql(GET_PRODUCT_WITH_VARIANTS, {
      variables: { id: productId }
    });
    const data = await response.json();
    
    if (!data.data?.product) {
      return json({ error: "Product not found", product: null, templates: {} });
    }
    
    // Get templates for this product
    const templates = await db.template.findMany({
      where: { 
        shop: session.shop,
        shopifyProductId: productId
      },
      select: {
        id: true,
        name: true,
        shopifyVariantId: true,
        thumbnail: true,
        isColorVariant: true,
        masterTemplateId: true,
      }
    });
    
    // Map templates by variant ID
    const templatesByVariant: Record<string, any> = {};
    templates.forEach(template => {
      if (template.shopifyVariantId) {
        templatesByVariant[template.shopifyVariantId] = template;
      }
    });
    
    return json({ 
      product: data.data.product,
      templates: templatesByVariant,
      error: null
    });
    
  } catch (error) {
    console.error("Error loading product variants:", error);
    return json({ 
      error: "Failed to load product variants",
      product: null,
      templates: {}
    });
  }
};

export default function ProductVariants() {
  const { product, templates, error } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  
  if (error) {
    return (
      <Page fullWidth>
        <TitleBar title="Product Variants" />
        <Layout>
          <Layout.Section>
            <Banner tone="critical">
              <p>{error}</p>
            </Banner>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }
  
  if (!product) {
    return (
      <Page fullWidth>
        <TitleBar title="Product Variants" />
        <Layout>
          <Layout.Section>
            <EmptyState
              heading="No product selected"
              action={{
                content: "View products",
                url: "/app/product-layouts",
              }}
            >
              <p>Please select a product to view its variants.</p>
            </EmptyState>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }
  
  const variants = product.variants.edges.map((edge: any) => edge.node);
  
  // Group variants by color
  const variantsByColor: Record<string, any[]> = {};
  variants.forEach((variant: any) => {
    const colorOption = variant.selectedOptions.find((opt: any) => opt.name === "Color");
    const color = colorOption?.value || "Unknown";
    if (!variantsByColor[color]) {
      variantsByColor[color] = [];
    }
    variantsByColor[color].push(variant);
  });
  
  return (
    <Page fullWidth>
      <TitleBar 
        title={`${product.title} Variants`}
        breadcrumbs={[{ content: "Products", url: "/app/product-layouts" }]}
      />
      
      <Layout>
        <Layout.Section>
          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "16px" }}>
              {product.featuredImage && (
                <Thumbnail
                  source={product.featuredImage.url}
                  alt={product.title}
                  size="large"
                />
              )}
              <div>
                <Text variant="headingLg" as="h2">{product.title}</Text>
                <Text variant="bodyMd" tone="subdued">
                  {variants.length} variants
                </Text>
              </div>
            </div>
          </Card>
        </Layout.Section>
        
        {Object.entries(variantsByColor).map(([color, colorVariants]) => (
          <Layout.Section key={color}>
            <Card>
              <Text variant="headingMd" as="h3">{color} Variants</Text>
              <div style={{ marginTop: "16px" }}>
                <ResourceList
                  resourceName={{ singular: "variant", plural: "variants" }}
                  items={colorVariants}
                  renderItem={(variant) => {
                    const template = templates[variant.id];
                    const patternOption = variant.selectedOptions.find((opt: any) => 
                      opt.name === "Edge Pattern" || opt.name === "Pattern"
                    );
                    const pattern = patternOption?.value || "";
                    
                    const media = variant.image ? (
                      <Thumbnail source={variant.image.url} alt={variant.title} size="medium" />
                    ) : template?.thumbnail ? (
                      <Thumbnail source={template.thumbnail} alt={variant.title} size="medium" />
                    ) : (
                      <div style={{
                        width: "40px",
                        height: "40px",
                        backgroundColor: "#f0f0f0",
                        borderRadius: "4px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}>
                        <Text variant="bodySm" tone="subdued">?</Text>
                      </div>
                    );
                    
                    return (
                      <ResourceItem
                        id={variant.id}
                        media={media}
                        accessibilityLabel={`View ${variant.displayName}`}
                        shortcutActions={template ? [
                          {
                            content: "Edit template",
                            url: `/app/designer?template=${template.id}`,
                          }
                        ] : [
                          {
                            content: "Create template",
                            url: `/app/designer?productId=${product.id}&variantId=${variant.id}`,
                          }
                        ]}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div>
                            <Text variant="bodyMd" fontWeight="bold">
                              {pattern || variant.title}
                            </Text>
                            <Text variant="bodySm" tone="subdued">
                              {variant.price}
                            </Text>
                          </div>
                          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            {template ? (
                              <>
                                <Badge tone="success">Has Template</Badge>
                                {template.isColorVariant && (
                                  <Badge tone="info">Color Variant</Badge>
                                )}
                              </>
                            ) : (
                              <Badge tone="warning">No Template</Badge>
                            )}
                          </div>
                        </div>
                      </ResourceItem>
                    );
                  }}
                />
              </div>
            </Card>
          </Layout.Section>
        ))}
      </Layout>
    </Page>
  );
}
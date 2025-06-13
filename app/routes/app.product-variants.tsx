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
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const productId = url.searchParams.get("productId");
  
  if (!productId) {
    return json({ error: "Product ID is required", product: null, templates: {}, productId: null });
  }
  
  try {
    // Get templates for this product from database only
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
        colorVariant: true,
      },
      orderBy: [
        { isColorVariant: 'asc' }, // Master templates first
        { colorVariant: 'asc' },    // Then by color name
        { name: 'asc' }
      ]
    });
    
    // Map templates by variant ID
    const templatesByVariant: Record<string, any> = {};
    templates.forEach(template => {
      if (template.shopifyVariantId) {
        templatesByVariant[template.shopifyVariantId] = template;
      }
    });
    
    // Group templates by color to show a summary
    const templatesByColor: Record<string, any[]> = {};
    templates.forEach(template => {
      const color = template.colorVariant || 'Unknown';
      if (!templatesByColor[color]) {
        templatesByColor[color] = [];
      }
      templatesByColor[color].push(template);
    });
    
    // Create a mock product structure based on templates
    const product = {
      id: productId,
      title: `Product ${productId.split('/').pop()}`,
      variants: {
        edges: templates
          .filter(t => t.shopifyVariantId)
          .map(t => ({
            node: {
              id: t.shopifyVariantId,
              title: t.name.replace(' Template', ''),
              displayName: t.name,
              selectedOptions: [
                { name: "Color", value: t.colorVariant || 'Unknown' }
              ]
            }
          }))
      }
    };
    
    return json({ 
      product,
      templates: templatesByVariant,
      templatesByColor,
      productId,
      error: null
    });
    
  } catch (error) {
    console.error("Error loading product variants:", error);
    return json({ 
      error: "Failed to load product variants",
      product: null,
      templates: {},
      templatesByColor: {},
      productId,
    });
  }
};

export default function ProductVariants() {
  const { product, templates, templatesByColor, error } = useLoaderData<typeof loader>();
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
  
  return (
    <Page fullWidth>
      <TitleBar 
        title={`Templates for Product ${product.id.split('/').pop()}`}
        breadcrumbs={[{ content: "Products", url: "/app/product-layouts" }]}
      />
      
      <Layout>
        <Layout.Section>
          <Card>
            <Text variant="headingLg" as="h2">Template Summary</Text>
            <div style={{ marginTop: "16px" }}>
              <Text variant="bodyMd" as="p">
                Total templates: {Object.keys(templates).length}
              </Text>
              <Text variant="bodyMd" as="p">
                Colors with templates: {Object.keys(templatesByColor).length}
              </Text>
            </div>
          </Card>
        </Layout.Section>
        
        {Object.entries(templatesByColor).map(([color, colorTemplates]) => (
          <Layout.Section key={color}>
            <Card>
              <Text variant="headingMd" as="h3">
                {color.charAt(0).toUpperCase() + color.slice(1)} Templates ({colorTemplates.length})
              </Text>
              <div style={{ marginTop: "16px" }}>
                <ResourceList
                  resourceName={{ singular: "template", plural: "templates" }}
                  items={colorTemplates}
                  renderItem={(template) => {
                    const media = template.thumbnail ? (
                      <Thumbnail source={template.thumbnail} alt={template.name} size="medium" />
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
                        id={template.id}
                        media={media}
                        accessibilityLabel={`View ${template.name}`}
                        shortcutActions={[
                          {
                            content: "Edit template",
                            url: `/app/designer?template=${template.id}`,
                          }
                        ]}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div>
                            <Text variant="bodyMd" fontWeight="bold">
                              {template.name}
                            </Text>
                            {template.shopifyVariantId && (
                              <Text variant="bodySm" tone="subdued">
                                Variant ID: {template.shopifyVariantId.split('/').pop()}
                              </Text>
                            )}
                          </div>
                          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            {!template.isColorVariant ? (
                              <Badge tone="warning">Master Template</Badge>
                            ) : (
                              <Badge tone="info">Color Variant</Badge>
                            )}
                            {template.shopifyVariantId ? (
                              <Badge tone="success">Assigned</Badge>
                            ) : (
                              <Badge>Unassigned</Badge>
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
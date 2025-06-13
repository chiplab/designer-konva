import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
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
  DataTable,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  try {
    // Get all templates with product IDs
    const templates = await db.template.findMany({
      where: { 
        shop: session.shop,
        shopifyProductId: { not: null }
      },
      select: { 
        shopifyProductId: true,
        shopifyVariantId: true,
        name: true,
        thumbnail: true,
        isColorVariant: true,
        masterTemplateId: true,
      },
      distinct: ['shopifyProductId']
    });
    
    // Group by product
    const productMap: Record<string, any> = {};
    
    templates.forEach(template => {
      const productId = template.shopifyProductId!;
      if (!productMap[productId]) {
        productMap[productId] = {
          id: productId,
          title: `Product ${productId.split('/').pop()}`, // Extract ID number
          templates: [],
          variantCount: 0,
          templatesCount: 0,
        };
      }
      productMap[productId].templates.push(template);
      productMap[productId].templatesCount++;
    });
    
    // Get template counts per product
    const productIds = Object.keys(productMap);
    for (const productId of productIds) {
      const allTemplates = await db.template.count({
        where: {
          shop: session.shop,
          shopifyProductId: productId
        }
      });
      productMap[productId].templatesCount = allTemplates;
      
      // Count unique variants
      const variantTemplates = await db.template.findMany({
        where: {
          shop: session.shop,
          shopifyProductId: productId,
          shopifyVariantId: { not: null }
        },
        select: { shopifyVariantId: true },
        distinct: ['shopifyVariantId']
      });
      productMap[productId].variantCount = variantTemplates.length;
    }
    
    const products = Object.values(productMap);
    
    return json({ products, error: null });
    
  } catch (error) {
    console.error("Error loading template products:", error);
    return json({ products: [], error: "Failed to load template products" });
  }
};

export default function ProductLayouts() {
  const { products, error } = useLoaderData<typeof loader>();
  
  const emptyStateMarkup = (
    <EmptyState
      heading="No products with templates found"
      action={{
        content: "Create your first template",
        url: "/app/designer",
      }}
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <p>
        Start by creating templates for your products.
      </p>
    </EmptyState>
  );

  const resourceListMarkup = (
    <ResourceList
      resourceName={{ singular: "product", plural: "products" }}
      items={products}
      renderItem={(product) => {
        const { id, title, templates, variantCount, templatesCount } = product;
        const firstTemplate = templates[0];
        const media = firstTemplate?.thumbnail ? (
          <Thumbnail source={firstTemplate.thumbnail} alt={title} size="large" />
        ) : (
          <Thumbnail
            source="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            alt="No image"
            size="large"
          />
        );

        return (
          <ResourceItem
            id={id}
            media={media}
            accessibilityLabel={`View details for ${title}`}
            shortcutActions={[
              {
                content: "View variants",
                url: `/app/product-variants?productId=${id}`,
              },
              {
                content: "View templates",
                url: `/app/templates`,
              },
            ]}
          >
            <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between" }}>
              <div>
                <Text variant="bodyMd" fontWeight="bold" as="h3">
                  {title}
                </Text>
                <div style={{ marginTop: "4px" }}>
                  <Text variant="bodySm" tone="subdued" as="p">
                    {templatesCount} templates for {variantCount} variants
                  </Text>
                  <Text variant="bodySm" as="p">
                    Master templates: {templates.filter((t: any) => !t.isColorVariant).length}
                  </Text>
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <Badge tone="success">Has Templates</Badge>
              </div>
            </div>
          </ResourceItem>
        );
      }}
    />
  );

  return (
    <Page fullWidth>
      <TitleBar title="Products with Templates" />
      
      {error && (
        <Banner tone="critical" onDismiss={() => {}}>
          <p>{error}</p>
        </Banner>
      )}
      
      <Layout>
        <Layout.Section>
          <Card padding="0">
            {products.length === 0 ? emptyStateMarkup : resourceListMarkup}
          </Card>
        </Layout.Section>
        
        {products.length > 0 && (
          <Layout.Section>
            <Card>
              <Text variant="headingMd" as="h2">
                Summary
              </Text>
              <div style={{ marginTop: "16px" }}>
                <DataTable
                  columnContentTypes={['text', 'numeric', 'numeric', 'numeric']}
                  headings={['Product ID', 'Total Templates', 'Master Templates', 'Color Variants']}
                  rows={products.map(p => [
                    p.id.split('/').pop() || p.id,
                    p.templatesCount,
                    p.templates.filter((t: any) => !t.isColorVariant).length,
                    p.templates.filter((t: any) => t.isColorVariant).length,
                  ])}
                />
              </div>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
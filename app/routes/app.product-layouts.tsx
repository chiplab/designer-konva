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
  Button,
  DataTable,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

const GET_TEMPLATE_PRODUCTS_QUERY = `#graphql
  query GetTemplateProducts {
    products(first: 50) {
      edges {
        node {
          id
          title
          status
          featuredImage {
            url
            altText
          }
          metafield(namespace: "custom_designer", key: "is_template_source") {
            value
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
              }
            }
          }
        }
      }
    }
  }
`;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  
  try {
    // Fetch template source products from Shopify
    const response = await admin.graphql(GET_TEMPLATE_PRODUCTS_QUERY);
    const data = await response.json();
    
    // Get template counts from database
    const templates = await db.template.findMany({
      where: { shop: session.shop },
      select: { 
        shopifyProductId: true,
        shopifyVariantId: true 
      },
    });
    
    // Count templates per product
    const templateCountByProduct: Record<string, number> = {};
    const templatesByVariant: Record<string, boolean> = {};
    
    templates.forEach(template => {
      if (template.shopifyProductId) {
        templateCountByProduct[template.shopifyProductId] = 
          (templateCountByProduct[template.shopifyProductId] || 0) + 1;
      }
      if (template.shopifyVariantId) {
        templatesByVariant[template.shopifyVariantId] = true;
      }
    });
    
    // Filter and transform products data - only include template sources
    const products = data.data?.products?.edges
      ?.filter((edge: any) => {
        // Only include products where is_template_source metafield is "true"
        const metafieldValue = edge.node.metafield?.value;
        return metafieldValue === "true";
      })
      ?.map((edge: any) => {
        const product = edge.node;
        const variantCount = product.variants.edges.length;
        const templatesCount = templateCountByProduct[product.id] || 0;
        
        // Count variants with templates
        const variantsWithTemplates = product.variants.edges.filter((v: any) => 
          templatesByVariant[v.node.id]
        ).length;
        
        return {
          id: product.id,
          title: product.title,
          status: product.status,
          image: product.featuredImage?.url,
          variantCount,
          templatesCount,
          variantsWithTemplates,
          variants: product.variants.edges.map((v: any) => ({
            id: v.node.id,
            title: v.node.title,
            displayName: v.node.displayName,
            image: v.node.image?.url,
            hasTemplate: !!templatesByVariant[v.node.id]
          }))
        };
      }) || [];
    
    return json({ products });
    
  } catch (error) {
    console.error("Error loading template products:", error);
    return json({ products: [], error: "Failed to load template products" });
  }
};

export default function ProductLayouts() {
  const { products, error } = useLoaderData<typeof loader>();
  
  const emptyStateMarkup = (
    <EmptyState
      heading="No template source products found"
      action={{
        content: "Learn how to set up products",
        url: "https://help.shopify.com/en/manual/products",
        external: true,
      }}
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <p>
        Mark products as template sources by setting the "Is Template Source" metafield to true
        in your Shopify admin.
      </p>
    </EmptyState>
  );

  const resourceListMarkup = (
    <ResourceList
      resourceName={{ singular: "product", plural: "products" }}
      items={products}
      renderItem={(product) => {
        const { id, title, image, variantCount, templatesCount, variantsWithTemplates, status } = product;
        const media = image ? (
          <Thumbnail source={image} alt={title} size="large" />
        ) : (
          <Thumbnail
            source="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            alt="No image"
            size="large"
          />
        );

        const progress = variantCount > 0 
          ? Math.round((variantsWithTemplates / variantCount) * 100)
          : 0;

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
                content: "Create template",
                url: `/app/designer?productId=${id}`,
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
                    {variantCount} variants • {templatesCount} templates
                  </Text>
                  <div style={{ marginTop: "4px" }}>
                    <Text variant="bodySm" as="p">
                      Progress: {variantsWithTemplates} of {variantCount} variants have templates ({progress}%)
                    </Text>
                    <div style={{ 
                      marginTop: "4px", 
                      width: "200px", 
                      height: "8px", 
                      backgroundColor: "#e0e0e0",
                      borderRadius: "4px",
                      overflow: "hidden"
                    }}>
                      <div style={{
                        width: `${progress}%`,
                        height: "100%",
                        backgroundColor: progress === 100 ? "#008060" : "#FFC453",
                        transition: "width 0.3s ease"
                      }} />
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <Badge tone={status === 'ACTIVE' ? 'success' : 'info'}>
                  {status}
                </Badge>
                <Badge tone="info">Template Source</Badge>
              </div>
            </div>
          </ResourceItem>
        );
      }}
    />
  );

  return (
    <Page fullWidth>
      <TitleBar title="Template Products" />
      
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
                Quick Stats
              </Text>
              <div style={{ marginTop: "16px" }}>
                <DataTable
                  columnContentTypes={['text', 'numeric', 'numeric', 'numeric']}
                  headings={['Product', 'Variants', 'Templates', 'Coverage']}
                  rows={products.map(p => [
                    p.title,
                    p.variantCount,
                    p.templatesCount,
                    `${Math.round((p.variantsWithTemplates / p.variantCount) * 100)}%`
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
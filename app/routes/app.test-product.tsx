import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Page, Card, Layout, Text, Badge, Banner } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { admin } = await authenticate.admin(request);
    
    const response = await admin.graphql(
      `#graphql
      query getProduct($id: ID!) {
        product(id: $id) {
          id
          title
          status
          metafields(first: 100) {
            edges {
              node {
                id
                namespace
                key
                value
                type
              }
            }
          }
          variants(first: 100) {
            edges {
              node {
                id
                title
                displayName
                metafields(first: 100) {
                  edges {
                    node {
                      id
                      namespace
                      key
                      value
                      type
                    }
                  }
                }
              }
            }
          }
        }
      }`,
      {
        variables: {
          id: "gid://shopify/Product/9797597331751",
        },
      }
    );

    const data = await response.json();
    
    if (data.errors) {
      console.error("GraphQL errors:", data.errors);
      return json({ error: "GraphQL errors", details: data.errors }, { status: 400 });
    }

    return json({ 
      success: true,
      product: data.data?.product || null,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("Error fetching product:", error);
    return json({ 
      error: "Failed to fetch product", 
      details: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
};

export default function TestProduct() {
  const data = useLoaderData<typeof loader>();
  
  return (
    <Page fullWidth>
      <TitleBar title="Test Product Access" />
      <Layout>
        <Layout.Section>
          {data.success && data.product ? (
            <>
              <Card>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                  <Text variant="headingLg" as="h2">{data.product.title}</Text>
                  <Badge tone={data.product.status === 'ACTIVE' ? 'success' : 'warning'}>
                    {data.product.status}
                  </Badge>
                </div>
                <Text variant="bodyMd" as="p">
                  Product ID: {data.product.id}
                </Text>
                <Text variant="bodyMd" as="p">
                  Variants: {data.product.variants.edges.length}
                </Text>
                <Text variant="bodyMd" as="p">
                  Metafields: {data.product.metafields.edges.length}
                </Text>
              </Card>
              
              <Card title="Raw Data">
                <pre style={{ 
                  backgroundColor: "#f5f5f5", 
                  padding: "16px", 
                  borderRadius: "4px",
                  overflow: "auto",
                  maxHeight: "60vh",
                  fontSize: "12px"
                }}>
                  {JSON.stringify(data, null, 2)}
                </pre>
              </Card>
            </>
          ) : (
            <Banner tone="critical">
              <p>{data.error || "Product not found"}</p>
              {data.details && (
                <pre style={{ marginTop: "8px", fontSize: "12px" }}>
                  {JSON.stringify(data.details, null, 2)}
                </pre>
              )}
            </Banner>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
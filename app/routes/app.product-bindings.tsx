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
  Badge,
  BlockStack,
  EmptyState,
  Banner,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

const PRODUCT_VARIANTS_QUERY = `#graphql
  query GetProductVariantsWithMetafields {
    productVariants(first: 100) {
      edges {
        node {
          id
          title
          displayName
          price
          product {
            id
            title
            featuredImage {
              url
              altText
            }
          }
          image {
            url
            altText
          }
          metafield(namespace: "custom_designer", key: "template_id") {
            value
          }
        }
      }
    }
  }
`;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  
  // Get variants with template metafields
  const response = await admin.graphql(PRODUCT_VARIANTS_QUERY);
  const { data } = await response.json();
  
  // Get all templates for this shop
  const templates = await db.template.findMany({
    where: {
      shop: session.shop,
    },
    select: {
      id: true,
      name: true,
    },
  });
  
  // Create a map for quick template lookup
  const templateMap = new Map(templates.map(t => [t.id, t.name]));
  
  // Filter variants that have template assignments
  const variantsWithTemplates = data.productVariants.edges
    .filter((edge: any) => edge.node.metafield?.value)
    .map((edge: any) => ({
      ...edge.node,
      templateName: templateMap.get(edge.node.metafield.value) || 'Unknown Template',
    }));
  
  return json({ 
    variantsWithTemplates,
    totalVariants: data.productVariants.edges.length,
  });
};

export default function ProductBindings() {
  const { variantsWithTemplates, totalVariants } = useLoaderData<typeof loader>();
  
  const emptyStateMarkup = (
    <EmptyState
      heading="No product bindings yet"
      action={{
        content: "Assign templates",
        url: "/app/templates",
      }}
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <p>Start by assigning templates to product variants from the Templates page.</p>
    </EmptyState>
  );
  
  const resourceListMarkup = (
    <>
      <Banner tone="info">
        <p>
          Showing {variantsWithTemplates.length} variant(s) with templates assigned 
          out of {totalVariants} total variants.
        </p>
      </Banner>
      
      <ResourceList
        resourceName={{ singular: "variant", plural: "variants" }}
        items={variantsWithTemplates}
        renderItem={(variant: any) => {
          const media = variant.image?.url ? (
            <Thumbnail
              source={variant.image.url}
              alt={variant.image.altText || variant.displayName}
              size="large"
            />
          ) : variant.product.featuredImage?.url ? (
            <Thumbnail
              source={variant.product.featuredImage.url}
              alt={variant.product.featuredImage.altText || variant.product.title}
              size="large"
            />
          ) : (
            <Thumbnail
              source="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              alt="No image"
              size="large"
            />
          );
          
          return (
            <ResourceItem
              id={variant.id}
              media={media}
              accessibilityLabel={`View ${variant.displayName}`}
            >
              <BlockStack gap="200">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div>
                    <Text variant="bodyMd" fontWeight="bold" as="h3">
                      {variant.product.title}
                    </Text>
                    <Text variant="bodySm" as="p">
                      {variant.displayName} • ${variant.price}
                    </Text>
                  </div>
                  <Badge tone="success">
                    {variant.templateName}
                  </Badge>
                </div>
                <Text variant="bodySm" tone="subdued" as="p">
                  Template ID: {variant.metafield.value}
                </Text>
              </BlockStack>
            </ResourceItem>
          );
        }}
      />
    </>
  );
  
  return (
    <Page>
      <TitleBar title="Product Template Bindings" />
      <Layout>
        <Layout.Section>
          <Card padding="0">
            {variantsWithTemplates.length === 0 ? emptyStateMarkup : resourceListMarkup}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
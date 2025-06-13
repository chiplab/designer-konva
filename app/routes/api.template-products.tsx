import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

const GET_TEMPLATE_PRODUCTS_QUERY = `#graphql
  query GetTemplateProducts {
    products(first: 50, query: "metafield.custom_designer.is_template_source:true") {
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
                price
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
      }
    }
  }
`;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { admin } = await authenticate.admin(request);
    
    const response = await admin.graphql(GET_TEMPLATE_PRODUCTS_QUERY);
    const data = await response.json();
    
    if (data.errors) {
      console.error("GraphQL errors:", data.errors);
      return json({ 
        success: false,
        error: "Failed to fetch template products",
        details: data.errors 
      }, { status: 400 });
    }
    
    // Transform the data for easier consumption
    const products = data.data?.products?.edges?.map((edge: any) => {
      const product = edge.node;
      return {
        id: product.id,
        title: product.title,
        status: product.status,
        image: product.featuredImage?.url,
        variants: product.variants.edges.map((variantEdge: any) => {
          const variant = variantEdge.node;
          // Parse color and pattern from variant title (e.g., "Red / 8 Spot")
          const [color, pattern] = variant.title.split(' / ').map((s: string) => s.trim());
          
          return {
            id: variant.id,
            title: variant.title,
            displayName: variant.displayName,
            price: variant.price,
            image: variant.image?.url,
            color: color?.toLowerCase(),
            pattern: pattern?.toLowerCase().replace(/\s+/g, '-'),
            hasTemplate: !!variant.metafield?.value
          };
        })
      };
    }) || [];
    
    return json({ 
      success: true,
      products,
      count: products.length
    });
    
  } catch (error) {
    console.error("Error fetching template products:", error);
    return json({ 
      success: false,
      error: "Failed to fetch template products",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
};
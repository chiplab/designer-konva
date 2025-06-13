import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

const PRODUCTS_QUERY = `#graphql
  query GetProducts {
    products(first: 50, sortKey: TITLE) {
      edges {
        node {
          id
          title
          status
          variants(first: 100) {
            edges {
              node {
                id
                title
                displayName
                selectedOptions {
                  name
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
  const { admin } = await authenticate.admin(request);
  
  try {
    const response = await admin.graphql(PRODUCTS_QUERY);
    const data = await response.json();
    
    // Filter to only active products
    const products = data.data?.products?.edges
      ?.filter((edge: any) => edge.node.status === 'ACTIVE')
      ?.map((edge: any) => edge.node) || [];
    
    return json({ products });
  } catch (error) {
    console.error("Error fetching products:", error);
    return json({ products: [], error: "Failed to fetch products" }, { status: 500 });
  }
};
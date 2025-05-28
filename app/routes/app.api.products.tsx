import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

const GET_PRODUCTS_QUERY = `#graphql
  query GetProducts {
    products(first: 50, sortKey: TITLE) {
      edges {
        node {
          id
          title
          variants(first: 100) {
            edges {
              node {
                id
                title
                displayName
                price
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
    const response = await admin.graphql(GET_PRODUCTS_QUERY);
    const { data } = await response.json();
    
    return json({ 
      products: data.products.edges.map((edge: any) => edge.node)
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    return json({ 
      products: [],
      error: "Failed to fetch products" 
    }, { status: 500 });
  }
};
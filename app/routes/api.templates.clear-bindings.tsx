import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

const CLEAR_METAFIELD_MUTATION = `#graphql
  mutation ClearMetafield($id: ID!) {
    metafieldDelete(input: {
      id: $id
    }) {
      deletedId
      userErrors {
        field
        message
      }
    }
  }
`;

const GET_VARIANTS_WITH_METAFIELDS = `#graphql
  query GetProductVariantsWithMetafields($productId: ID!) {
    product(id: $productId) {
      variants(first: 250) {
        edges {
          node {
            id
            displayName
            metafield(namespace: "custom_designer", key: "template_id") {
              id
              value
            }
          }
        }
      }
    }
  }
`;

export async function action({ request }: ActionFunctionArgs) {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const productId = formData.get("productId") as string;

  if (!productId) {
    return json({ error: "Product ID is required" }, { status: 400 });
  }

  try {
    // Get all variants with their metafields
    const response = await admin.graphql(GET_VARIANTS_WITH_METAFIELDS, {
      variables: { productId }
    });
    const { data } = await response.json();
    
    if (!data?.product?.variants?.edges) {
      return json({ error: "No variants found" }, { status: 404 });
    }

    let clearedCount = 0;
    const errors: string[] = [];

    // Clear metafields for all variants
    for (const edge of data.product.variants.edges) {
      const variant = edge.node;
      if (variant.metafield?.id) {
        try {
          const deleteResponse = await admin.graphql(CLEAR_METAFIELD_MUTATION, {
            variables: { id: variant.metafield.id }
          });
          const deleteData = await deleteResponse.json();
          
          if (deleteData.data?.metafieldDelete?.userErrors?.length > 0) {
            errors.push(`Failed to clear ${variant.displayName}: ${deleteData.data.metafieldDelete.userErrors[0].message}`);
          } else {
            clearedCount++;
          }
        } catch (error) {
          errors.push(`Error clearing ${variant.displayName}: ${error}`);
        }
      }
    }

    return json({ 
      success: true, 
      clearedCount,
      errors,
      message: `Cleared ${clearedCount} variant bindings` 
    });
  } catch (error) {
    console.error("Error clearing bindings:", error);
    return json({ error: "Failed to clear bindings" }, { status: 500 });
  }
}
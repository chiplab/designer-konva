import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

const VARIANT_QUERY = `#graphql
  query GetVariantMetafield($id: ID!) {
    productVariant(id: $id) {
      id
      title
      displayName
      product {
        id
        title
      }
      metafield(namespace: "custom_designer", key: "template_id") {
        id
        value
      }
    }
  }
`;

const METAFIELD_SET_MUTATION = `#graphql
  mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        id
        namespace
        key
        value
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

export async function action({ request }: ActionFunctionArgs) {
  const { session, admin } = await authenticate.admin(request);
  
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const formData = await request.formData();
    const variantId = formData.get("variantId") as string;
    const action = formData.get("action") as string;
    
    if (!variantId) {
      return json({ error: "Variant ID required" }, { status: 400 });
    }
    
    console.log(`[Fix Metafields] Processing variant: ${variantId}, action: ${action}`);
    
    // Get variant info from Shopify
    const response = await admin.graphql(VARIANT_QUERY, {
      variables: { id: variantId }
    });
    
    const { data } = await response.json() as any;
    const variant = data?.productVariant;
    
    if (!variant) {
      return json({ error: "Variant not found in Shopify" }, { status: 404 });
    }
    
    const currentTemplateId = variant.metafield?.value;
    console.log(`[Fix Metafields] Current template ID in metafield: ${currentTemplateId}`);
    
    if (action === "diagnose") {
      // Just diagnose the issue
      let diagnosis = {
        variant: {
          id: variant.id,
          title: variant.title,
          productTitle: variant.product.title,
        },
        currentMetafieldValue: currentTemplateId,
        templateExists: false,
        suggestedFix: null as any,
        relatedTemplates: [] as any[]
      };
      
      if (currentTemplateId) {
        // Check if template exists
        const template = await db.template.findFirst({
          where: { id: currentTemplateId }
        });
        
        diagnosis.templateExists = !!template;
        
        if (!template) {
          // Find templates for this product
          const productTemplates = await db.template.findMany({
            where: {
              shopifyProductId: variant.product.id,
              shop: session.shop,
            },
            select: {
              id: true,
              name: true,
              isColorVariant: true,
              colorVariant: true,
              shopifyVariantId: true,
            },
            orderBy: { name: 'asc' }
          });
          
          diagnosis.relatedTemplates = productTemplates;
          
          // Try to find the right template based on variant title
          const variantColor = variant.title.split(' / ')[0];
          const matchingTemplate = productTemplates.find(t => 
            t.name.toLowerCase().includes(variantColor.toLowerCase())
          );
          
          if (matchingTemplate) {
            diagnosis.suggestedFix = {
              action: "updateMetafield",
              newTemplateId: matchingTemplate.id,
              templateName: matchingTemplate.name,
              reason: `Found template matching variant color: ${variantColor}`
            };
          } else {
            // If no color match, suggest the master template
            const masterTemplate = productTemplates.find(t => !t.isColorVariant);
            if (masterTemplate) {
              diagnosis.suggestedFix = {
                action: "updateMetafield",
                newTemplateId: masterTemplate.id,
                templateName: masterTemplate.name,
                reason: "No matching color variant found, suggesting master template"
              };
            }
          }
        }
      }
      
      return json(diagnosis);
    }
    
    if (action === "fix") {
      const newTemplateId = formData.get("newTemplateId") as string;
      
      if (!newTemplateId) {
        return json({ error: "New template ID required for fix action" }, { status: 400 });
      }
      
      // Verify the new template exists
      const newTemplate = await db.template.findFirst({
        where: {
          id: newTemplateId,
          shop: session.shop,
        }
      });
      
      if (!newTemplate) {
        return json({ error: "New template not found or doesn't belong to this shop" }, { status: 404 });
      }
      
      // Update the metafield
      const metafieldResponse = await admin.graphql(METAFIELD_SET_MUTATION, {
        variables: {
          metafields: [{
            ownerId: variantId,
            namespace: "custom_designer",
            key: "template_id",
            value: newTemplateId,
            type: "single_line_text_field"
          }]
        }
      });
      
      const metafieldResult = await metafieldResponse.json() as any;
      
      if (metafieldResult.data?.metafieldsSet?.userErrors?.length > 0) {
        const errors = metafieldResult.data.metafieldsSet.userErrors;
        return json({ 
          error: `Failed to update metafield: ${errors.map((e: any) => e.message).join(", ")}` 
        }, { status: 400 });
      }
      
      return json({
        success: true,
        message: `Updated variant "${variant.title}" to use template "${newTemplate.name}"`,
        oldTemplateId: currentTemplateId,
        newTemplateId: newTemplateId,
        variant: {
          id: variant.id,
          title: variant.title,
          productTitle: variant.product.title,
        },
        template: {
          id: newTemplate.id,
          name: newTemplate.name,
        }
      });
    }
    
    if (action === "clear") {
      // Clear the metafield by setting it to empty string
      const metafieldResponse = await admin.graphql(METAFIELD_SET_MUTATION, {
        variables: {
          metafields: [{
            ownerId: variantId,
            namespace: "custom_designer",
            key: "template_id",
            value: "",
            type: "single_line_text_field"
          }]
        }
      });
      
      const metafieldResult = await metafieldResponse.json() as any;
      
      if (metafieldResult.data?.metafieldsSet?.userErrors?.length > 0) {
        const errors = metafieldResult.data.metafieldsSet.userErrors;
        return json({ 
          error: `Failed to clear metafield: ${errors.map((e: any) => e.message).join(", ")}` 
        }, { status: 400 });
      }
      
      return json({
        success: true,
        message: `Cleared template metafield for variant "${variant.title}"`,
        variant: {
          id: variant.id,
          title: variant.title,
          productTitle: variant.product.title,
        }
      });
    }
    
    return json({ error: "Invalid action. Use 'diagnose', 'fix', or 'clear'" }, { status: 400 });
    
  } catch (error) {
    console.error("Error fixing template metafields:", error);
    return json({ 
      error: error instanceof Error ? error.message : "Failed to fix template metafields" 
    }, { status: 500 });
  }
}
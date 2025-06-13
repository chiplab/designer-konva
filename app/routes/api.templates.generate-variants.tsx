import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { generateColorVariants, matchTemplatesToVariants } from "../services/template-color-generator.server";
import db from "../db.server";

export async function action({ request }: ActionFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const formData = await request.formData();
    const templateId = formData.get("templateId") as string;
    
    if (!templateId) {
      return json({ error: "Template ID is required" }, { status: 400 });
    }
    
    // Verify template exists and belongs to this shop
    const template = await db.template.findFirst({
      where: {
        id: templateId,
        shop: session.shop,
      },
    });
    
    if (!template) {
      return json({ error: "Template not found or access denied" }, { status: 404 });
    }
    
    // Check if this template already has color variants
    const existingVariants = await db.template.count({
      where: {
        masterTemplateId: templateId,
      },
    });
    
    if (existingVariants > 0) {
      return json({ 
        error: "This template already has color variants. Delete them first to regenerate." 
      }, { status: 400 });
    }
    
    // Generate color variants
    console.log(`Generating color variants for template ${templateId}...`);
    const createdTemplates = await generateColorVariants(templateId, session.shop, admin);
    
    // Match templates to Shopify variants and get variant images
    if (template.shopifyProductId) {
      console.log("Matching templates to Shopify variants...");
      
      // Get the pattern from the master template
      let masterPattern = "";
      if (template.shopifyVariantId) {
        const GET_VARIANT = `#graphql
          query GetVariant($id: ID!) {
            productVariant(id: $id) {
              selectedOptions {
                name
                value
              }
            }
          }
        `;
        
        const response = await admin.graphql(GET_VARIANT, {
          variables: { id: template.shopifyVariantId }
        });
        const data = await response.json();
        const patternOption = data.data?.productVariant?.selectedOptions?.find(
          (opt: any) => opt.name === "Edge Pattern" || opt.name === "Pattern"
        );
        masterPattern = patternOption?.value || "";
      }
      
      const templatesWithImages = await matchTemplatesToVariants(
        admin, 
        template.shopifyProductId, 
        createdTemplates,
        masterPattern
      );
      
      // Update canvas data with new base images
      for (const createdTemplate of templatesWithImages) {
        if (createdTemplate.variantImage) {
          try {
            const dbTemplate = await db.template.findUnique({
              where: { id: createdTemplate.id }
            });
            
            if (dbTemplate) {
              const canvasData = JSON.parse(dbTemplate.canvasData);
              // Update the base image URL in canvas data
              if (canvasData.assets) {
                canvasData.assets.baseImage = createdTemplate.variantImage;
              }
              
              await db.template.update({
                where: { id: createdTemplate.id },
                data: {
                  canvasData: JSON.stringify(canvasData)
                }
              });
            }
          } catch (error) {
            console.error(`Error updating base image for template ${createdTemplate.id}:`, error);
          }
        }
      }
    }
    
    return json({ 
      success: true,
      message: `Successfully generated ${createdTemplates.length} color variants`,
      templates: createdTemplates,
    });
    
  } catch (error) {
    console.error("Error generating color variants:", error);
    return json({ 
      error: error instanceof Error ? error.message : "Failed to generate color variants" 
    }, { status: 500 });
  }
}
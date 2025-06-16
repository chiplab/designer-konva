import { 
  startJob, 
  updateJobProgress, 
  completeJob, 
  failJob,
  type JobData 
} from "./job-queue.server";
import { generateAllVariants, matchTemplatesToVariants } from "./template-color-generator.server";
import { generateTemplateThumbnail } from "./template-thumbnail-generator.server";
import db from "../db.server";

// GraphQL mutation to set metafield
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

/**
 * Process a generate variants job
 * FIXED VERSION: Separates thumbnail generation from admin API calls
 */
export async function processGenerateVariantsJob(
  jobId: string,
  shop: string,
  data: JobData,
  admin: any
) {
  try {
    // Mark job as processing
    await startJob(jobId);
    
    const { templateId } = data;
    if (!templateId) {
      throw new Error("Template ID is required");
    }
    
    // Get the master template
    const template = await db.template.findFirst({
      where: {
        id: templateId,
        shop,
      },
    });
    
    if (!template) {
      throw new Error("Template not found");
    }
    
    // Generate all variants
    console.log(`Job ${jobId}: Generating all variants for template ${templateId}...`);
    const createdTemplates = await generateAllVariants(templateId, shop, admin);
    
    // Update progress - variants created
    await updateJobProgress(jobId, createdTemplates.length, createdTemplates.length * 2);
    
    // Get master pattern if available
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
      
      try {
        const response = await admin.graphql(GET_VARIANT, {
          variables: { id: template.shopifyVariantId }
        });
        const data = await response.json();
        const patternOption = data.data?.productVariant?.selectedOptions?.find(
          (opt: any) => opt.name === "Edge Pattern" || opt.name === "Pattern"
        );
        masterPattern = patternOption?.value || "";
      } catch (error) {
        console.error("Error getting master pattern:", error);
      }
    }
    
    // Match templates to Shopify variants if product ID exists
    let templatesWithImages = createdTemplates;
    if (template.shopifyProductId) {
      console.log(`\nJob ${jobId}: ========== VARIANT MATCHING SECTION ==========`);
      console.log(`Job ${jobId}: Matching templates to Shopify variants...`);
      
      // Import product mapping helper
      const { getSellingProductId } = await import("../config/product-mappings");
      
      // Get the selling product ID (customer-facing) from the source product ID
      const sellingProductId = getSellingProductId(template.shopifyProductId);
      console.log(`Job ${jobId}: Using selling product ID: ${sellingProductId}`);
      
      templatesWithImages = await matchTemplatesToVariants(
        admin,
        sellingProductId,
        createdTemplates,
        masterPattern
      );
      
      console.log(`Job ${jobId}: ========== END VARIANT MATCHING SECTION ==========\n`);
    }
    
    // PHASE 1: Collect all templates that need metafield binding
    console.log(`Job ${jobId}: Phase 1 - Collecting templates for metafield binding...`);
    const templatesToBind: Array<{
      templateId: string;
      variantId: string;
      color: string;
      pattern?: string;
    }> = [];
    
    for (const createdTemplate of templatesWithImages) {
      const dbTemplate = await db.template.findUnique({
        where: { id: createdTemplate.id }
      });
      
      if (dbTemplate?.shopifyVariantId) {
        templatesToBind.push({
          templateId: createdTemplate.id,
          variantId: dbTemplate.shopifyVariantId,
          color: createdTemplate.color,
          pattern: createdTemplate.pattern
        });
      }
    }
    
    console.log(`Job ${jobId}: Found ${templatesToBind.length} templates that need metafield binding`);
    
    // PHASE 2: Do all metafield bindings BEFORE any thumbnail generation
    console.log(`Job ${jobId}: Phase 2 - Binding metafields...`);
    for (const binding of templatesToBind) {
      try {
        console.log(`Job ${jobId}: Binding template ${binding.templateId} to variant ${binding.variantId}...`);
        
        const metafieldResponse = await admin.graphql(METAFIELD_SET_MUTATION, {
          variables: {
            metafields: [{
              ownerId: binding.variantId,
              namespace: "custom_designer",
              key: "template_id",
              value: binding.templateId,
              type: "single_line_text_field"
            }]
          }
        });
        
        const metafieldResult = await metafieldResponse.json();
        
        if (metafieldResult.data?.metafieldsSet?.userErrors?.length > 0) {
          console.error(`Job ${jobId}: Failed to set metafield for ${binding.color}/${binding.pattern}:`, 
            metafieldResult.data.metafieldsSet.userErrors);
        } else if (metafieldResult.data?.metafieldsSet?.metafields?.length > 0) {
          console.log(`Job ${jobId}: Successfully bound template for ${binding.color}/${binding.pattern}`);
        }
      } catch (error) {
        console.error(`Job ${jobId}: Error binding template ${binding.templateId}:`, error);
      }
    }
    
    // PHASE 3: Generate thumbnails (this loads Konva/jsdom but admin API calls are done)
    console.log(`Job ${jobId}: Phase 3 - Generating thumbnails...`);
    const BATCH_SIZE = 5;
    let processedCount = createdTemplates.length;
    
    for (let i = 0; i < templatesWithImages.length; i += BATCH_SIZE) {
      const batch = templatesWithImages.slice(i, i + BATCH_SIZE);
      console.log(`Job ${jobId}: Processing thumbnail batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(templatesWithImages.length/BATCH_SIZE)}`);
      
      await Promise.all(batch.map(async (createdTemplate) => {
        try {
          const dbTemplate = await db.template.findUnique({
            where: { id: createdTemplate.id }
          });
          
          if (dbTemplate) {
            console.log(`Job ${jobId}: Generating thumbnail for ${createdTemplate.color}/${createdTemplate.pattern || masterPattern}...`);
            
            try {
              const thumbnailUrl = await generateTemplateThumbnail(
                dbTemplate.canvasData,
                shop,
                createdTemplate.id
              );
              
              if (thumbnailUrl) {
                await db.template.update({
                  where: { id: createdTemplate.id },
                  data: { thumbnail: thumbnailUrl }
                });
                console.log(`Job ${jobId}: Thumbnail generated for ${createdTemplate.color}`);
              }
            } catch (error) {
              console.warn(`Job ${jobId}: Failed to generate thumbnail for ${createdTemplate.id}:`, error);
            }
          }
          
          processedCount++;
          await updateJobProgress(jobId, processedCount, createdTemplates.length * 2);
        } catch (error) {
          console.error(`Job ${jobId}: Error processing template ${createdTemplate.id}:`, error);
        }
      }));
    }
    
    // Generate master template thumbnail if it doesn't have one
    if (template && !template.thumbnail) {
      try {
        console.log(`Job ${jobId}: Generating master template thumbnail...`);
        const thumbnailUrl = await generateTemplateThumbnail(
          template.canvasData,
          shop,
          template.id
        );
        
        if (thumbnailUrl) {
          await db.template.update({
            where: { id: template.id },
            data: { thumbnail: thumbnailUrl }
          });
        }
      } catch (error) {
        console.error(`Job ${jobId}: Error generating master template thumbnail:`, error);
      }
    }
    
    // Complete the job
    await completeJob(jobId, {
      message: `Successfully generated ${createdTemplates.length} variants with metafield bindings`,
      templatesCreated: createdTemplates.length,
      metafieldsSet: templatesToBind.length,
      templates: createdTemplates.map(t => ({ 
        id: t.id, 
        color: t.color, 
        pattern: t.pattern 
      })),
    });
    
    console.log(`Job ${jobId}: Completed successfully`);
    
  } catch (error) {
    console.error(`Job ${jobId}: Failed with error:`, error);
    await failJob(jobId, error instanceof Error ? error.message : "Unknown error");
  }
}

// Export other job processors from original file
export { processSyncProductThumbnailsJob, processSyncAllThumbnailsJob, processJob } from "./job-processor.server";
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

/**
 * Process a generate variants job
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
      console.log(`Job ${jobId}: Matching templates to Shopify variants...`);
      templatesWithImages = await matchTemplatesToVariants(
        admin,
        template.shopifyProductId,
        createdTemplates,
        masterPattern
      );
    }
    
    // Process templates in batches for base image updates and thumbnails
    const BATCH_SIZE = 5;
    let processedCount = createdTemplates.length;
    
    for (let i = 0; i < templatesWithImages.length; i += BATCH_SIZE) {
      const batch = templatesWithImages.slice(i, i + BATCH_SIZE);
      console.log(`Job ${jobId}: Processing batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(templatesWithImages.length/BATCH_SIZE)}`);
      
      await Promise.all(batch.map(async (createdTemplate) => {
        try {
          const dbTemplate = await db.template.findUnique({
            where: { id: createdTemplate.id }
          });
          
          if (dbTemplate) {
            let canvasData = JSON.parse(dbTemplate.canvasData);
            let updates: any = {};
            
            // Update the base image URL if we have a variant image
            if (createdTemplate.variantImage && canvasData.assets) {
              canvasData.assets.baseImage = createdTemplate.variantImage;
              updates.canvasData = JSON.stringify(canvasData);
            }
            
            // Generate thumbnail
            console.log(`Job ${jobId}: Generating thumbnail for ${createdTemplate.color}/${createdTemplate.pattern || masterPattern} variant...`);
            try {
              const thumbnailUrl = await generateTemplateThumbnail(
                updates.canvasData || dbTemplate.canvasData,
                shop,
                createdTemplate.id
              );
              
              if (thumbnailUrl) {
                console.log(`Job ${jobId}: Thumbnail generated successfully`);
                updates.thumbnail = thumbnailUrl;
              }
            } catch (error) {
              console.warn(`Job ${jobId}: Failed to generate thumbnail for ${createdTemplate.id}:`, error);
            }
            
            // Update the template if needed
            if (Object.keys(updates).length > 0) {
              await db.template.update({
                where: { id: createdTemplate.id },
                data: updates,
              });
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
      message: `Successfully generated ${createdTemplates.length} variants across all patterns`,
      templatesCreated: createdTemplates.length,
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

/**
 * Main job processor - can be called from a background worker or API endpoint
 */
export async function processJob(jobId: string, shop: string, admin: any) {
  const job = await db.job.findFirst({
    where: {
      id: jobId,
      shop,
      status: "pending",
    },
  });
  
  if (!job) {
    throw new Error("Job not found or already processed");
  }
  
  const data = JSON.parse(job.data) as JobData;
  
  switch (job.type) {
    case "generateVariants":
      await processGenerateVariantsJob(jobId, shop, data, admin);
      break;
    default:
      throw new Error(`Unknown job type: ${job.type}`);
  }
}
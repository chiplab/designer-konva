import { 
  startJob, 
  updateJobProgress, 
  completeJob, 
  failJob,
  type JobData 
} from "./job-queue.server";
import { generateAllVariants, matchTemplatesToVariants } from "./template-color-generator.server";
import { generateTemplateThumbnail } from "./template-thumbnail-generator.server";
import { syncTemplateThumbnailToVariants } from "./template-sync.server";
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
      
      // IMPORTANT: We need to match against the SELLING product, not the source product
      // The source product (e.g., 9797597331751) has the base images for templates
      // The selling product (e.g., 9852686237991) is what we're creating variants for
      // For now, we'll use the same product ID, but this should be configurable
      // TODO: Add a separate "sellingProductId" field to templates or make this configurable
      
      templatesWithImages = await matchTemplatesToVariants(
        admin,
        template.shopifyProductId, // This should ideally be the selling product ID
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
            
            // NOTE: We intentionally DO NOT update the base image URL
            // The base images should come from the unpublished source product
            // Only the thumbnail (customized design) syncs to the selling product variants
            // This maintains separation between source assets and customer-facing products
            
            // if (createdTemplate.variantImage && canvasData.assets) {
            //   canvasData.assets.baseImage = createdTemplate.variantImage;
            //   updates.canvasData = JSON.stringify(canvasData);
            // }
            
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
            
            // Bind template to variant and sync thumbnail
            if (dbTemplate.shopifyVariantId && dbTemplate.thumbnail) {
              try {
                // Set metafield to bind template to variant
                console.log(`Job ${jobId}: Binding template ${createdTemplate.id} to variant ${dbTemplate.shopifyVariantId}...`);
                const metafieldResponse = await admin.graphql(METAFIELD_SET_MUTATION, {
                  variables: {
                    metafields: [{
                      ownerId: dbTemplate.shopifyVariantId,
                      namespace: "custom_designer",
                      key: "template_id",
                      value: createdTemplate.id,
                      type: "single_line_text_field"
                    }]
                  }
                });
                
                const metafieldResult = await metafieldResponse.json();
                if (metafieldResult.data?.metafieldsSet?.userErrors?.length > 0) {
                  console.error(`Job ${jobId}: Failed to set metafield:`, metafieldResult.data.metafieldsSet.userErrors);
                  // Mark this template as having sync issues
                  // For now, just log - we'll add visual indicators in the UI later
                  console.error(`Job ${jobId}: Template ${createdTemplate.id} failed to bind to variant`);
                } else {
                  console.log(`Job ${jobId}: Successfully bound template to variant`);
                  
                  // Now sync the thumbnail to the variant
                  console.log(`Job ${jobId}: Syncing thumbnail to variant...`);
                  const syncResult = await syncTemplateThumbnailToVariants(admin, createdTemplate.id, dbTemplate.thumbnail);
                  
                  if (syncResult.success && syncResult.syncedCount > 0) {
                    console.log(`Job ${jobId}: Successfully synced thumbnail to ${syncResult.syncedCount} variant(s)`);
                  } else if (syncResult.errors.length > 0) {
                    console.warn(`Job ${jobId}: Thumbnail sync had errors:`, syncResult.errors);
                    // Log warning - we'll add visual indicators in the UI later
                    console.warn(`Job ${jobId}: Template ${createdTemplate.id} had sync warnings`);
                  }
                }
              } catch (bindError) {
                console.error(`Job ${jobId}: Error binding/syncing template ${createdTemplate.id}:`, bindError);
                // Log error - we'll add visual indicators in the UI later
                console.error(`Job ${jobId}: Template ${createdTemplate.id} failed binding/syncing`);
              }
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
 * Process a sync all thumbnails job
 */
export async function processSyncAllThumbnailsJob(
  jobId: string,
  shop: string,
  data: JobData,
  admin: any
) {
  try {
    // Mark job as processing
    await startJob(jobId);
    
    // Get all templates with shopifyProductId (these are the ones that can be synced)
    const templatesToSync = await db.template.findMany({
      where: {
        shop,
        shopifyProductId: { not: null },
        thumbnail: { not: null },
      },
    });
    
    console.log(`Job ${jobId}: Found ${templatesToSync.length} templates to sync`);
    await updateJobProgress(jobId, 0, templatesToSync.length);
    
    let totalSynced = 0;
    let totalErrors = 0;
    const errors: string[] = [];
    const syncResults: any[] = [];
    
    // Process templates in batches
    const BATCH_SIZE = 5;
    for (let i = 0; i < templatesToSync.length; i += BATCH_SIZE) {
      const batch = templatesToSync.slice(i, i + BATCH_SIZE);
      console.log(`Job ${jobId}: Processing batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(templatesToSync.length/BATCH_SIZE)}`);
      
      await Promise.all(batch.map(async (template) => {
        try {
          const syncResult = await syncTemplateThumbnailToVariants(
            admin, 
            template.id, 
            template.thumbnail
          );
          
          if (syncResult.syncedCount > 0) {
            totalSynced += syncResult.syncedCount;
            console.log(`Job ${jobId}: Synced ${syncResult.syncedCount} variant(s) for template ${template.name}`);
            syncResults.push({
              templateId: template.id,
              templateName: template.name,
              synced: true,
              count: syncResult.syncedCount
            });
          } else {
            syncResults.push({
              templateId: template.id,
              templateName: template.name,
              synced: false,
              reason: "No variants found"
            });
          }
          
          if (syncResult.errors.length > 0) {
            totalErrors += syncResult.errors.length;
            errors.push(...syncResult.errors);
          }
        } catch (error) {
          console.error(`Job ${jobId}: Error syncing template ${template.id}:`, error);
          errors.push(`Failed to sync ${template.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          totalErrors++;
          syncResults.push({
            templateId: template.id,
            templateName: template.name,
            synced: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }));
      
      // Update progress after each batch
      await updateJobProgress(jobId, Math.min(i + BATCH_SIZE, templatesToSync.length), templatesToSync.length);
    }
    
    // Complete the job
    await completeJob(jobId, {
      message: `Synced ${totalSynced} variant thumbnail(s) across ${templatesToSync.length} templates`,
      totalSynced,
      totalTemplates: templatesToSync.length,
      totalErrors,
      errors: errors.length > 0 ? errors : undefined,
      syncResults
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
    case "syncAllThumbnails":
      await processSyncAllThumbnailsJob(jobId, shop, data, admin);
      break;
    default:
      throw new Error(`Unknown job type: ${job.type}`);
  }
}
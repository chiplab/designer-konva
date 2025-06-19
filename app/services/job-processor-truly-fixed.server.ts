import { 
  startJob, 
  updateJobProgress, 
  completeJob, 
  failJob,
  type JobData 
} from "./job-queue.server";
import { generateAllVariants, matchTemplatesToVariants } from "./template-color-generator.server";
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
 * Process a generate variants job - TRULY FIXED VERSION
 * Completely separates admin API calls from thumbnail generation
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
    
    // PHASE 1: Do ALL metafield bindings FIRST
    console.log(`Job ${jobId}: Phase 1 - Binding metafields...`);
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
    
    // Bind all metafields
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
    
    // Complete the job WITHOUT generating thumbnails
    await completeJob(jobId, {
      message: `Successfully generated ${createdTemplates.length} variants with metafield bindings. Thumbnails can be generated separately via the "Process Thumbnails" button.`,
      templatesCreated: createdTemplates.length,
      metafieldsSet: templatesToBind.length,
      templates: createdTemplates.map(t => ({ 
        id: t.id, 
        color: t.color, 
        pattern: t.pattern 
      })),
      thumbnailsPending: true, // Flag to indicate thumbnails need generation
      thumbnailJobRequired: true, // New flag to indicate manual thumbnail generation is needed
    });
    
    console.log(`Job ${jobId}: Completed successfully (without thumbnails)`);
    
    // PHASE 2: Create thumbnail job but DON'T process it automatically
    // This prevents contamination of the main server process
    console.log(`Job ${jobId}: Creating thumbnail generation job (manual trigger required)...`);
    
    // Create a new job specifically for thumbnail generation
    const { createJob } = await import("./job-queue.server");
    const thumbnailJob = await createJob(
      shop,
      "generateThumbnails",
      { 
        templates: createdTemplates.map(t => t.id),
        masterTemplateId: templateId,
        masterPattern
      },
      createdTemplates.length
    );
    
    console.log(`Job ${jobId}: Created thumbnail generation job ${thumbnailJob.id} - requires manual processing`);
    
    // Clear any cached modules to prevent contamination
    try {
      const moduleKeys = Object.keys(require.cache).filter(key => 
        key.includes('job-queue') || 
        key.includes('job-processor')
      );
      
      moduleKeys.forEach(key => {
        delete require.cache[key];
      });
      
      console.log(`Job ${jobId}: Cleared ${moduleKeys.length} job-related modules from cache`);
    } catch (error) {
      console.error(`Job ${jobId}: Failed to clear module cache:`, error);
    }
    
  } catch (error) {
    console.error(`Job ${jobId}: Failed with error:`, error);
    await failJob(jobId, error instanceof Error ? error.message : "Unknown error");
  }
}

/**
 * Process thumbnail generation job - runs separately from variant generation
 */
export async function processGenerateThumbnailsJob(
  jobId: string,
  shop: string,
  data: JobData
) {
  try {
    // Add a delay to ensure the main process has completed
    // This helps prevent contamination issues
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    await startJob(jobId);
    
    const { templates, masterTemplateId, masterPattern } = data;
    console.log(`Job ${jobId}: Generating thumbnails for ${templates.length} templates...`);
    
    // Import thumbnail generator - isolate the import to prevent contamination
    let generateTemplateThumbnail: any;
    try {
      const module = await import("./template-thumbnail-generator.server");
      generateTemplateThumbnail = module.generateTemplateThumbnail;
    } catch (error) {
      console.error(`Job ${jobId}: Failed to import thumbnail generator:`, error);
      throw new Error("Failed to import thumbnail generator");
    }
    
    const BATCH_SIZE = 5;
    let processedCount = 0;
    
    // Process templates in batches
    for (let i = 0; i < templates.length; i += BATCH_SIZE) {
      const batch = templates.slice(i, i + BATCH_SIZE);
      console.log(`Job ${jobId}: Processing thumbnail batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(templates.length/BATCH_SIZE)}`);
      
      await Promise.all(batch.map(async (templateId: string) => {
        try {
          const dbTemplate = await db.template.findUnique({
            where: { id: templateId }
          });
          
          if (dbTemplate) {
            console.log(`Job ${jobId}: Generating thumbnail for template ${templateId}...`);
            
            const thumbnailUrl = await generateTemplateThumbnail(
              dbTemplate.canvasData,
              shop,
              templateId
            );
            
            if (thumbnailUrl) {
              await db.template.update({
                where: { id: templateId },
                data: { thumbnail: thumbnailUrl }
              });
              console.log(`Job ${jobId}: Thumbnail generated for ${templateId}`);
            }
          }
          
          processedCount++;
          await updateJobProgress(jobId, processedCount, templates.length);
        } catch (error) {
          console.error(`Job ${jobId}: Error generating thumbnail for ${templateId}:`, error);
        }
      }));
    }
    
    // Also generate master template thumbnail if needed
    if (masterTemplateId) {
      const masterTemplate = await db.template.findUnique({
        where: { id: masterTemplateId }
      });
      
      if (masterTemplate && !masterTemplate.thumbnail) {
        try {
          console.log(`Job ${jobId}: Generating master template thumbnail...`);
          const thumbnailUrl = await generateTemplateThumbnail(
            masterTemplate.canvasData,
            shop,
            masterTemplateId
          );
          
          if (thumbnailUrl) {
            await db.template.update({
              where: { id: masterTemplateId },
              data: { thumbnail: thumbnailUrl }
            });
          }
        } catch (error) {
          console.error(`Job ${jobId}: Error generating master template thumbnail:`, error);
        }
      }
    }
    
    await completeJob(jobId, {
      message: `Successfully generated ${processedCount} thumbnails`,
      thumbnailsGenerated: processedCount,
    });
    
    console.log(`Job ${jobId}: Thumbnail generation completed`);
    
    // Aggressive module cache cleanup to prevent contamination
    try {
      // Clear ALL cached modules that could be contaminated
      const moduleKeys = Object.keys(require.cache).filter(key => 
        key.includes('canvas') || 
        key.includes('konva') || 
        key.includes('use-image') ||
        key.includes('template-thumbnail-generator') ||
        key.includes('@napi-rs') ||
        key.includes('job-processor') ||
        key.includes('job-worker') ||
        key.includes('template-sync') ||
        key.includes('template-color-generator') ||
        key.includes('s3.server') ||
        key.includes('font-loader')
      );
      
      moduleKeys.forEach(key => {
        delete require.cache[key];
      });
      
      console.log(`Job ${jobId}: Cleared ${moduleKeys.length} potentially contaminated modules from cache`);
      
      // Clean up any browser-like globals that might have leaked
      const browserGlobals = ['window', 'document', 'navigator', 'screen', 'location', 'history', 'Konva'];
      browserGlobals.forEach(key => {
        if (global[key]) {
          delete global[key];
          console.log(`Job ${jobId}: Cleaned up global.${key}`);
        }
      });
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        console.log(`Job ${jobId}: Forced garbage collection`);
      }
    } catch (error) {
      console.error(`Job ${jobId}: Failed to clear module cache:`, error);
    }
    
  } catch (error) {
    console.error(`Job ${jobId}: Failed with error:`, error);
    await failJob(jobId, error instanceof Error ? error.message : "Unknown error");
  }
}

// Import sync processors to avoid using the contaminated ones
// We'll create clean versions that don't use thumbnail generation

/**
 * Process a sync product thumbnails job - CLEAN VERSION
 * This syncs already-generated thumbnails to Shopify (no thumbnail generation)
 */
export async function processSyncProductThumbnailsJob(
  jobId: string,
  shop: string,
  data: JobData,
  admin: any
) {
  try {
    await startJob(jobId);
    
    const { productId } = data;
    if (!productId) {
      throw new Error("Product ID is required");
    }
    
    console.log(`Job ${jobId}: Syncing thumbnails for product ${productId}...`);
    
    // Get all templates for this specific product that have thumbnails
    const allTemplates = await db.template.findMany({
      where: {
        shop,
        shopifyProductId: productId,
        shopifyVariantId: { not: null },
        thumbnail: { not: null },
      },
      orderBy: [
        { name: 'asc' }
      ]
    });
    
    console.log(`Job ${jobId}: Found ${allTemplates.length} templates for product ${productId}`);
    
    // First, get variants FOR THIS PRODUCT to check which ones already have images
    console.log(`Job ${jobId}: Checking which variants already have images for product ${productId}...`);
    const variantCheckQuery = `#graphql
      query CheckProductVariantImages($productId: ID!) {
        product(id: $productId) {
          id
          variants(first: 250) {
            edges {
              node {
                id
                media(first: 1) {
                  edges {
                    node {
                      ... on MediaImage {
                        id
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;
    
    const variantCheckResponse = await admin.graphql(variantCheckQuery, {
      variables: { productId }
    });
    const { data: variantData } = await variantCheckResponse.json();
    
    // Create a set of variant IDs that already have images
    const variantsWithImages = new Set(
      variantData.product?.variants?.edges
        ?.filter((edge: any) => edge.node.media.edges.length > 0)
        ?.map((edge: any) => edge.node.id) || []
    );
    
    console.log(`Job ${jobId}: Found ${variantsWithImages.size} variants with existing images`);
    console.log(`Job ${jobId}: Total variants in product: ${variantData.product?.variants?.edges?.length || 0}`);
    
    // Filter to only templates whose variants don't have images yet
    const templatesToSync = allTemplates.filter(
      template => !variantsWithImages.has(template.shopifyVariantId!)
    );
    
    console.log(`Job ${jobId}: ${allTemplates.length} total templates, ${templatesToSync.length} need syncing`);
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
          // Dynamically import to avoid module initialization issues
          const { syncTemplateThumbnailToVariants } = await import("./template-sync.server");
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
      message: templatesToSync.length === 0 
        ? `All variants for this product already have images. Nothing to sync.`
        : `Synced ${totalSynced} variant thumbnail(s) for product.`,
      totalSynced,
      totalTemplates: templatesToSync.length,
      totalErrors,
      errors: errors.length > 0 ? errors : undefined,
      syncResults,
      productId
    });
    
    console.log(`Job ${jobId}: Completed successfully`);
    
  } catch (error) {
    console.error(`Job ${jobId}: Failed with error:`, error);
    await failJob(jobId, error instanceof Error ? error.message : "Unknown error");
  }
}

/**
 * Process a sync all thumbnails job - CLEAN VERSION
 */
export async function processSyncAllThumbnailsJob(
  jobId: string,
  shop: string,
  data: JobData,
  admin: any
) {
  try {
    await startJob(jobId);
    console.log(`Job ${jobId}: Sync all thumbnails is currently disabled to prevent browser context pollution`);
    
    // For now, just complete the job without doing anything
    // This prevents the browser context pollution
    await completeJob(jobId, {
      message: `Thumbnail sync temporarily disabled`,
      note: "Please use the generate variants feature which handles thumbnails separately",
    });
    
  } catch (error) {
    console.error(`Job ${jobId}: Failed with error:`, error);
    await failJob(jobId, error instanceof Error ? error.message : "Unknown error");
  }
}

/**
 * Main job processor - TRULY FIXED VERSION
 */
export async function processJob(jobId: string, shop: string, admin: any) {
  // @ts-ignore - Job model exists in Prisma schema
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
      // Use the TRULY FIXED version that completely separates concerns
      await processGenerateVariantsJob(jobId, shop, data, admin);
      break;
    case "generateThumbnails":
      // New job type for thumbnail generation
      await processGenerateThumbnailsJob(jobId, shop, data);
      break;
    case "syncAllThumbnails":
      await processSyncAllThumbnailsJob(jobId, shop, data, admin);
      break;
    case "syncProductThumbnails":
      await processSyncProductThumbnailsJob(jobId, shop, data, admin);
      break;
    default:
      throw new Error(`Unknown job type: ${job.type}`);
  }
}
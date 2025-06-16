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
      console.log(`Job ${jobId}: Master template has shopifyProductId: ${template.shopifyProductId}`);
      console.log(`Job ${jobId}: Master pattern extracted: "${masterPattern}"`);
      
      // Import product mapping helper
      const { getSellingProductId } = await import("../config/product-mappings");
      
      // Get the selling product ID (customer-facing) from the source product ID
      const sellingProductId = getSellingProductId(template.shopifyProductId);
      console.log(`Job ${jobId}: Product mapping:`);
      console.log(`Job ${jobId}:   - Source product (with base images): ${template.shopifyProductId}`);
      console.log(`Job ${jobId}:   - Selling product (customer-facing): ${sellingProductId}`);
      console.log(`Job ${jobId}:   - Using ${sellingProductId === template.shopifyProductId ? 'SAME PRODUCT (no mapping)' : 'MAPPED PRODUCT'}`);
      
      templatesWithImages = await matchTemplatesToVariants(
        admin,
        sellingProductId, // Use the selling product ID for variant matching
        createdTemplates,
        masterPattern
      );
      
      // Log how many templates got matched
      const matchedCount = templatesWithImages.filter(t => t.variantImage).length;
      console.log(`Job ${jobId}: Matched ${matchedCount} out of ${templatesWithImages.length} templates to variants`);
      
      console.log(`Job ${jobId}: ========== END VARIANT MATCHING SECTION ==========\n`);
    }
    
    // Process templates in batches for base image updates and thumbnails
    const BATCH_SIZE = 5;
    let processedCount = createdTemplates.length;
    
    console.log(`Job ${jobId}: Starting batch processing of ${templatesWithImages.length} templates`);
    
    for (let i = 0; i < templatesWithImages.length; i += BATCH_SIZE) {
      const batch = templatesWithImages.slice(i, i + BATCH_SIZE);
      console.log(`Job ${jobId}: Processing batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(templatesWithImages.length/BATCH_SIZE)}`);
      
      await Promise.all(batch.map(async (createdTemplate) => {
        try {
          console.log(`Job ${jobId}: Processing template ${createdTemplate.id} (${createdTemplate.color}/${createdTemplate.pattern || 'no pattern'})`);
          
          const dbTemplate = await db.template.findUnique({
            where: { id: createdTemplate.id }
          });
          
          if (dbTemplate) {
            console.log(`Job ${jobId}: Fetched template from DB - shopifyVariantId: ${dbTemplate.shopifyVariantId}`);
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
            
            // Bind template to variant - do this AFTER updates are saved
            const variantId = dbTemplate.shopifyVariantId;
            console.log(`Job ${jobId}: Template ${createdTemplate.id} has shopifyVariantId: ${variantId}`);
            
            if (variantId) {
              try {
                // Set metafield to bind template to variant
                console.log(`Job ${jobId}: Setting metafield for template ${createdTemplate.id} to variant ${variantId}...`);
                
                // First, check if a metafield already exists
                const CHECK_METAFIELD = `#graphql
                  query CheckMetafield($ownerId: ID!) {
                    productVariant(id: $ownerId) {
                      metafield(namespace: "custom_designer", key: "template_id") {
                        id
                        value
                      }
                    }
                  }
                `;
                
                const checkResponse = await admin.graphql(CHECK_METAFIELD, {
                  variables: { ownerId: variantId }
                });
                const checkData = await checkResponse.json();
                const existingMetafield = checkData.data?.productVariant?.metafield;
                
                if (existingMetafield) {
                  console.log(`Job ${jobId}: Existing metafield found with value: ${existingMetafield.value}`);
                  console.log(`Job ${jobId}: Will update from ${existingMetafield.value} to ${createdTemplate.id}`);
                }
                
                const metafieldResponse = await admin.graphql(METAFIELD_SET_MUTATION, {
                  variables: {
                    metafields: [{
                      ownerId: variantId,
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
                  console.error(`Job ${jobId}: Metafield mutation full response:`, JSON.stringify(metafieldResult, null, 2));
                } else if (metafieldResult.data?.metafieldsSet?.metafields?.length > 0) {
                  console.log(`Job ${jobId}: Successfully bound template to variant`);
                  console.log(`Job ${jobId}: Created metafield:`, metafieldResult.data.metafieldsSet.metafields[0]);
                } else {
                  console.warn(`Job ${jobId}: Unexpected metafield response:`, JSON.stringify(metafieldResult, null, 2));
                }
                  
                // Sync thumbnail if available
                const thumbnailToSync = updates.thumbnail || dbTemplate.thumbnail;
                if (thumbnailToSync) {
                  console.log(`Job ${jobId}: Syncing thumbnail to variant...`);
                  const { syncTemplateThumbnailToVariants } = await import("./template-sync.server");
                  const syncResult = await syncTemplateThumbnailToVariants(admin, createdTemplate.id, thumbnailToSync);
                  
                  if (syncResult.success && syncResult.syncedCount > 0) {
                    console.log(`Job ${jobId}: Successfully synced thumbnail to ${syncResult.syncedCount} variant(s)`);
                  } else if (syncResult.errors.length > 0) {
                    console.warn(`Job ${jobId}: Thumbnail sync had errors:`, syncResult.errors);
                  }
                }
              } catch (bindError) {
                console.error(`Job ${jobId}: Error binding template ${createdTemplate.id}:`, bindError);
              }
            } else {
              console.log(`Job ${jobId}: No variant ID found for template ${createdTemplate.id} (color: ${createdTemplate.color}) - skipping metafield binding`);
              // Log more details about the template
              console.log(`Job ${jobId}: Template details:`, {
                id: dbTemplate.id,
                name: dbTemplate.name,
                shopifyVariantId: dbTemplate.shopifyVariantId,
                shopifyProductId: dbTemplate.shopifyProductId,
                isColorVariant: dbTemplate.isColorVariant,
                colorVariant: dbTemplate.colorVariant
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
 * Process a sync product thumbnails job
 */
export async function processSyncProductThumbnailsJob(
  jobId: string,
  shop: string,
  data: JobData,
  admin: any
) {
  try {
    // Mark job as processing
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
    
    // Debug: log a few examples
    if (templatesToSync.length === 0 && allTemplates.length > 0) {
      console.log(`Job ${jobId}: All variants appear to have images. First few variant checks:`);
      allTemplates.slice(0, 3).forEach(template => {
        console.log(`  Template ${template.name}: variant ${template.shopifyVariantId} has image: ${variantsWithImages.has(template.shopifyVariantId!)}`);
      });
    }
    
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
    
    // First, get all variants to check which ones already have images
    console.log(`Job ${jobId}: Checking which variants already have images...`);
    const variantCheckQuery = `#graphql
      query CheckVariantImages {
        productVariants(first: 250) {
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
    `;
    
    const variantCheckResponse = await admin.graphql(variantCheckQuery);
    const { data: variantData } = await variantCheckResponse.json();
    
    // Create a set of variant IDs that already have images
    const variantsWithImages = new Set(
      variantData.productVariants.edges
        .filter((edge: any) => edge.node.media.edges.length > 0)
        .map((edge: any) => edge.node.id)
    );
    
    console.log(`Job ${jobId}: Found ${variantsWithImages.size} variants that already have images`);
    
    // Get all templates that have shopifyVariantId and need syncing
    const allTemplates = await db.template.findMany({
      where: {
        shop,
        shopifyVariantId: { not: null },
        thumbnail: { not: null },
      },
      orderBy: [
        { name: 'asc' }
      ]
    });
    
    // Filter to only templates whose variants don't have images yet
    const templatesToSync = allTemplates.filter(
      template => !variantsWithImages.has(template.shopifyVariantId!)
    );
    
    console.log(`Job ${jobId}: ${allTemplates.length} total templates, ${templatesToSync.length} need syncing`);
    
    console.log(`Job ${jobId}: Found ${templatesToSync.length} templates to sync`);
    console.log(`Job ${jobId}: Templates to sync:`, templatesToSync.map(t => ({ 
      name: t.name, 
      id: t.id,
      hasThumbnail: !!t.thumbnail,
      shopifyVariantId: t.shopifyVariantId 
    })));
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
      console.log(`Job ${jobId}: Batch templates:`, batch.map(t => ({ name: t.name, id: t.id })));
      
      if (batch.length === 0) {
        console.error(`Job ${jobId}: WARNING - Empty batch at index ${i}`);
        continue;
      }
      
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
    
    // Verify which variants actually have images
    console.log(`Job ${jobId}: Verifying sync results...`);
    const finalVerificationQuery = `#graphql
      query VerifyVariantImages {
        productVariants(first: 250) {
          edges {
            node {
              id
              displayName
              media(first: 10) {
                edges {
                  node {
                    ... on MediaImage {
                      id
                      image {
                        url
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
    
    const verifyResponse = await admin.graphql(finalVerificationQuery);
    const { data: verifyData } = await verifyResponse.json();
    
    const variantsWithImagesAfterSync = verifyData.productVariants.edges.filter(
      (edge: any) => edge.node.media.edges.length > 0
    );
    
    console.log(`Job ${jobId}: Verification complete - ${variantsWithImagesAfterSync.length} variants have images`);
    console.log(`Job ${jobId}: Variants with images:`, variantsWithImagesAfterSync.map((v: any) => ({
      id: v.node.id,
      name: v.node.displayName,
      imageCount: v.node.media.edges.length
    })));
    
    // Complete the job
    await completeJob(jobId, {
      message: templatesToSync.length === 0 
        ? `All variants already have images. Nothing to sync.`
        : `Synced ${totalSynced} variant thumbnail(s) across ${templatesToSync.length} templates. Verified ${variantsWithImagesAfterSync.length} variants have images.`,
      totalSynced,
      totalTemplates: templatesToSync.length,
      totalErrors,
      errors: errors.length > 0 ? errors : undefined,
      syncResults,
      verifiedVariantsWithImages: variantsWithImagesAfterSync.length
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
      await processGenerateVariantsJob(jobId, shop, data, admin);
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
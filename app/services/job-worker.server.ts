import db from "../db.server";
import { processJob } from "./job-processor-truly-fixed.server";

/**
 * Worker to process pending thumbnail generation jobs
 * This runs separately to avoid contaminating the main server process
 * 
 * IMPORTANT: This function should be called in an isolated context
 * to prevent browser-like APIs from contaminating the main server.
 */
export async function processPendingThumbnailJobs(shop: string) {
  // Save original global state
  const originalGlobals = {
    window: global.window,
    document: global.document,
    Konva: global.Konva,
  };
  try {
    // Find pending thumbnail generation jobs
    const pendingJobs = await db.job.findMany({
      where: {
        shop,
        type: "generateThumbnails",
        status: "pending",
      },
      orderBy: {
        createdAt: "asc",
      },
      take: 5, // Process up to 5 jobs at a time
    });
    
    if (pendingJobs.length === 0) {
      return { processed: 0 };
    }
    
    console.log(`Found ${pendingJobs.length} pending thumbnail jobs for shop ${shop}`);
    
    let processedCount = 0;
    
    for (const job of pendingJobs) {
      try {
        console.log(`Processing thumbnail job ${job.id}...`);
        await processJob(job.id, shop, null); // No admin needed for thumbnails
        processedCount++;
      } catch (error) {
        console.error(`Failed to process thumbnail job ${job.id}:`, error);
      }
    }
    
    // Aggressive module cache cleanup after processing to prevent contamination
    try {
      const moduleKeys = Object.keys(require.cache).filter(key => 
        key.includes('canvas') || 
        key.includes('konva') || 
        key.includes('use-image') ||
        key.includes('template-thumbnail-generator') ||
        key.includes('@napi-rs') ||
        key.includes('job-processor') ||
        key.includes('template-sync') ||
        key.includes('template-color-generator') ||
        key.includes('s3.server') ||
        key.includes('font-loader')
      );
      
      moduleKeys.forEach(key => {
        delete require.cache[key];
      });
      
      console.log(`Cleared ${moduleKeys.length} potentially contaminated modules from cache after processing`);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        console.log(`Forced garbage collection after thumbnail processing`);
      }
    } catch (error) {
      console.error(`Failed to clear module cache:`, error);
    }
    
    return { processed: processedCount };
    
  } catch (error) {
    console.error("Error processing thumbnail jobs:", error);
    throw error;
  } finally {
    // Restore original global state
    Object.keys(originalGlobals).forEach(key => {
      if (originalGlobals[key] === undefined) {
        delete global[key];
      } else {
        global[key] = originalGlobals[key];
      }
    });
  }
}
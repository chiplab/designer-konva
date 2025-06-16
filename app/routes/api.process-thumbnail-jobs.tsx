import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { processJob } from "../services/job-processor-truly-fixed.server";
import db from "../db.server";

/**
 * API endpoint to process pending thumbnail generation jobs
 * This can be called periodically or triggered after variant generation
 */
export async function action({ request }: ActionFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    // Find pending thumbnail generation jobs for this shop
    const pendingJobs = await db.job.findMany({
      where: {
        shop: session.shop,
        type: "generateThumbnails",
        status: "pending",
      },
      orderBy: {
        createdAt: "asc",
      },
      take: 5, // Process up to 5 jobs at a time
    });
    
    console.log(`Found ${pendingJobs.length} pending thumbnail generation jobs`);
    
    if (pendingJobs.length === 0) {
      return json({ 
        success: true, 
        message: "No pending thumbnail jobs",
        jobsProcessed: 0,
      });
    }
    
    // Process each job
    const results = [];
    for (const job of pendingJobs) {
      try {
        console.log(`Processing thumbnail job ${job.id}...`);
        await processJob(job.id, session.shop, admin);
        results.push({ jobId: job.id, success: true });
      } catch (error) {
        console.error(`Failed to process thumbnail job ${job.id}:`, error);
        results.push({ 
          jobId: job.id, 
          success: false, 
          error: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
    
    return json({ 
      success: true,
      message: `Processed ${results.filter(r => r.success).length} of ${pendingJobs.length} thumbnail jobs`,
      jobsProcessed: pendingJobs.length,
      results,
    });
    
  } catch (error) {
    console.error("Error processing thumbnail jobs:", error);
    return json({ 
      error: error instanceof Error ? error.message : "Failed to process thumbnail jobs" 
    }, { status: 500 });
  }
}
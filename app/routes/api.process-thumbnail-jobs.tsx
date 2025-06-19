import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { processPendingThumbnailJobs } from "../services/job-worker.server";

/**
 * API endpoint to process pending thumbnail generation jobs
 * This can be called periodically or triggered after variant generation
 */
export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const result = await processPendingThumbnailJobs(session.shop);
    
    return json({
      success: true,
      processed: result.processed,
      message: result.processed > 0 
        ? `Processed ${result.processed} thumbnail job(s)` 
        : "No pending thumbnail jobs found"
    });
    
  } catch (error) {
    console.error("Error processing thumbnail jobs:", error);
    return json({ 
      success: false,
      error: error instanceof Error ? error.message : "Failed to process thumbnail jobs" 
    }, { status: 500 });
  }
}
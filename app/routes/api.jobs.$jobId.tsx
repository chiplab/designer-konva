import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getJob } from "../services/job-queue.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const { jobId } = params;
  
  if (!jobId) {
    return json({ error: "Job ID is required" }, { status: 400 });
  }
  
  try {
    const job = await getJob(jobId, session.shop);
    
    if (!job) {
      return json({ error: "Job not found" }, { status: 404 });
    }
    
    // Parse result if completed
    let result = null;
    if (job.status === "completed" && job.result) {
      try {
        result = JSON.parse(job.result);
      } catch (e) {
        result = job.result;
      }
    }
    
    return json({
      id: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      total: job.total,
      error: job.error,
      result,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    });
    
  } catch (error) {
    console.error("Error fetching job:", error);
    return json({ 
      error: error instanceof Error ? error.message : "Failed to fetch job" 
    }, { status: 500 });
  }
}
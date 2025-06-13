import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { createJob } from "../services/job-queue.server";
import { processJob } from "../services/job-processor.server";
import db from "../db.server";

export async function action({ request }: ActionFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const formData = await request.formData();
    const templateId = formData.get("templateId") as string;
    const processInBackground = formData.get("background") !== "false";
    
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
    
    // Create a job for generating variants
    const job = await createJob(
      session.shop,
      "generateVariants",
      { templateId },
      49 // Estimated total (will be updated during processing)
    );
    
    if (processInBackground) {
      // Start processing in background (fire and forget)
      processJob(job.id, session.shop, admin).catch(error => {
        console.error(`Background job ${job.id} failed:`, error);
      });
      
      // Return immediately with job ID
      return json({ 
        success: true,
        message: "Generating variants in background. This may take a few minutes.",
        jobId: job.id,
        isBackground: true,
      });
    } else {
      // Process synchronously (for testing)
      await processJob(job.id, session.shop, admin);
      
      // Get the completed job
      const completedJob = await db.job.findUnique({
        where: { id: job.id }
      });
      
      if (completedJob?.status === "completed") {
        const result = JSON.parse(completedJob.result || "{}");
        return json({ 
          success: true,
          message: result.message || "Variants generated successfully",
          jobId: job.id,
          isBackground: false,
          result,
        });
      } else {
        const error = completedJob?.error || "Job failed";
        return json({ 
          success: false,
          error,
          jobId: job.id,
        }, { status: 500 });
      }
    }
    
  } catch (error) {
    console.error("Error in generate variants action:", error);
    return json({ 
      error: error instanceof Error ? error.message : "Failed to generate variants" 
    }, { status: 500 });
  }
}
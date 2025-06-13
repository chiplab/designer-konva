import db from "../db.server";

export interface JobData {
  templateId?: string;
  [key: string]: any;
}

export interface JobResult {
  message?: string;
  templates?: any[];
  [key: string]: any;
}

/**
 * Creates a new job in the queue
 */
export async function createJob(
  shop: string,
  type: string,
  data: JobData,
  total: number = 0
) {
  return await db.job.create({
    data: {
      shop,
      type,
      status: "pending",
      data: JSON.stringify(data),
      total,
    },
  });
}

/**
 * Updates job progress
 */
export async function updateJobProgress(
  jobId: string,
  progress: number,
  total?: number
) {
  return await db.job.update({
    where: { id: jobId },
    data: {
      progress,
      ...(total !== undefined && { total }),
    },
  });
}

/**
 * Marks a job as processing
 */
export async function startJob(jobId: string) {
  return await db.job.update({
    where: { id: jobId },
    data: {
      status: "processing",
    },
  });
}

/**
 * Marks a job as completed
 */
export async function completeJob(jobId: string, result: JobResult) {
  return await db.job.update({
    where: { id: jobId },
    data: {
      status: "completed",
      result: JSON.stringify(result),
    },
  });
}

/**
 * Marks a job as failed
 */
export async function failJob(jobId: string, error: string) {
  return await db.job.update({
    where: { id: jobId },
    data: {
      status: "failed",
      error,
    },
  });
}

/**
 * Gets a job by ID
 */
export async function getJob(jobId: string, shop: string) {
  return await db.job.findFirst({
    where: {
      id: jobId,
      shop,
    },
  });
}

/**
 * Gets recent jobs for a shop
 */
export async function getRecentJobs(shop: string, limit: number = 10) {
  return await db.job.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * Cleans up old completed jobs (older than 7 days)
 */
export async function cleanupOldJobs() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  return await db.job.deleteMany({
    where: {
      status: { in: ["completed", "failed"] },
      createdAt: { lt: sevenDaysAgo },
    },
  });
}
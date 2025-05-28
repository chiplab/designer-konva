import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// S3 Configuration
const BUCKET_NAME = "shopify-designs";
const REGION = "us-west-1";
const BASE_URL = `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com`;

// Validate AWS credentials are present
if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  console.warn("AWS credentials not found in environment variables");
}

// Initialize S3 client
const s3Client = new S3Client({
  region: REGION,
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  } : undefined,
});

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  isPublic?: boolean;
}

/**
 * Upload a file to S3
 * @param key - The S3 object key (path)
 * @param body - The file content (Buffer or string)
 * @param options - Upload options
 * @returns The public URL of the uploaded file
 */
export async function uploadToS3(
  key: string,
  body: Buffer | string,
  options: UploadOptions = {}
): Promise<string> {
  const { contentType = "application/octet-stream", metadata = {}, isPublic = true } = options;

  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
      Metadata: metadata,
      // ACL removed - using bucket policy for public access instead
    });

    await s3Client.send(command);
    return `${BASE_URL}/${key}`;
  } catch (error) {
    console.error("S3 upload error:", error);
    // Re-throw with more context
    if (error instanceof Error) {
      if (error.message.includes("AccessDenied")) {
        throw new Error("S3 Access Denied: Check IAM permissions and bucket policy");
      }
      if (error.message.includes("ACLs")) {
        throw new Error("Bucket doesn't allow ACLs. Using bucket policy for public access.");
      }
      if (error.message.includes("NoSuchBucket")) {
        throw new Error(`S3 Bucket '${BUCKET_NAME}' not found`);
      }
      if (error.message.includes("Credential")) {
        throw new Error("AWS credentials are missing or invalid");
      }
    }
    throw error;
  }
}

/**
 * Upload a base64 image to S3
 * @param key - The S3 object key (path)
 * @param base64Data - Base64 encoded image data
 * @param contentType - The image content type
 * @returns The public URL of the uploaded image
 */
export async function uploadBase64ImageToS3(
  key: string,
  base64Data: string,
  contentType: string = "image/png"
): Promise<string> {
  // Remove data URL prefix if present
  const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64Clean, "base64");
  
  return uploadToS3(key, buffer, { contentType, isPublic: true });
}

/**
 * Generate a unique key for template thumbnails
 * @param shopDomain - The shop domain
 * @param templateId - The template ID
 * @returns A unique S3 key
 */
export function generateTemplateThumbnailKey(shopDomain: string, templateId: string): string {
  const shopName = shopDomain.replace(".myshopify.com", "");
  const timestamp = Date.now();
  return `templates/${shopName}/${templateId}/thumbnail-${timestamp}.png`;
}

/**
 * Generate a unique key for template assets
 * @param shopDomain - The shop domain
 * @param assetType - Type of asset (e.g., "svg", "image", "font")
 * @param fileName - Original file name
 * @returns A unique S3 key
 */
export function generateAssetKey(
  shopDomain: string,
  assetType: string,
  fileName: string
): string {
  const shopName = shopDomain.replace(".myshopify.com", "");
  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  return `assets/${shopName}/${assetType}/${timestamp}-${sanitizedFileName}`;
}

/**
 * Get a signed URL for temporary access to a private object
 * @param key - The S3 object key
 * @param expiresIn - Expiration time in seconds (default: 3600)
 * @returns A signed URL
 */
export async function getSignedS3Url(key: string, expiresIn: number = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });
  
  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Check if an object exists in S3
 * @param key - The S3 object key
 * @returns True if the object exists
 */
export async function objectExists(key: string): Promise<boolean> {
  try {
    await s3Client.send(new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    }));
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Delete an object from S3
 * @param key - The S3 object key
 */
export async function deleteFromS3(key: string): Promise<void> {
  await s3Client.send(new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  }));
}

// Export constants
export { BUCKET_NAME, REGION, BASE_URL };
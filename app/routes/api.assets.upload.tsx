import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { uploadToS3, generateAssetKey } from "../services/s3.server";

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const assetType = formData.get("assetType") as string || "image";

    if (!file) {
      return json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = {
      image: ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"],
      svg: ["image/svg+xml"],
      font: ["font/ttf", "font/otf", "font/woff", "font/woff2"],
    };

    const allowedMimeTypes = allowedTypes[assetType as keyof typeof allowedTypes] || allowedTypes.image;
    
    if (!allowedMimeTypes.includes(file.type)) {
      return json({ 
        error: `Invalid file type. Allowed types for ${assetType}: ${allowedMimeTypes.join(", ")}` 
      }, { status: 400 });
    }

    // Read file content
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate S3 key
    const s3Key = generateAssetKey(session.shop, assetType, file.name);

    // Upload to S3
    const url = await uploadToS3(s3Key, buffer, {
      contentType: file.type,
      metadata: {
        originalName: file.name,
        shop: session.shop,
        uploadedAt: new Date().toISOString(),
      },
      isPublic: true,
    });

    return json({
      success: true,
      asset: {
        url,
        key: s3Key,
        name: file.name,
        type: file.type,
        size: file.size,
      },
    });
  } catch (error) {
    console.error("Error uploading asset:", error);
    // Provide more specific error message
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return json({ 
      error: "Failed to upload asset", 
      details: errorMessage,
      hint: errorMessage.includes("Missing credentials") ? "Check AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables" : undefined
    }, { status: 500 });
  }
}

// Optional: Add a loader to handle GET requests with signed URLs
export async function loader({ request }: ActionFunctionArgs) {
  return json({ error: "Use POST to upload assets" }, { status: 405 });
}
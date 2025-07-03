import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { uploadToS3, generateAssetKey } from "../services/s3.server";
import { prisma } from "../db.server";
import sharp from "sharp";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const assetType = formData.get("assetType") as string || "image";
    const sessionId = formData.get("sessionId") as string | null;
    const customerId = formData.get("customerId") as string | null;

    // Check if it's an admin request or user request
    let shop: string;
    let isAdminUpload = false;
    
    try {
      const { session } = await authenticate.admin(request);
      shop = session.shop;
      isAdminUpload = true;
    } catch (error) {
      // Not an admin request, get shop from form data
      shop = formData.get("shop") as string;
      if (!shop) {
        return json({ error: "Shop parameter required for non-admin uploads" }, { status: 400 });
      }
    }

    if (!file) {
      return json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = {
      image: ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"],
      userImage: ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"],
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

    // Get image dimensions for image files
    let width: number | undefined;
    let height: number | undefined;
    
    if (file.type.startsWith("image/") && file.type !== "image/svg+xml") {
      try {
        const metadata = await sharp(buffer).metadata();
        width = metadata.width;
        height = metadata.height;
      } catch (error) {
        console.error("Failed to get image dimensions:", error);
      }
    }

    // Generate S3 key
    const s3Key = generateAssetKey(shop, assetType, file.name);

    // Upload to S3
    const url = await uploadToS3(s3Key, buffer, {
      contentType: file.type,
      metadata: {
        originalName: file.name,
        shop,
        uploadedAt: new Date().toISOString(),
      },
      isPublic: true,
    });

    // Save to database if it's a user image
    if (assetType === "userImage" && (sessionId || customerId)) {
      try {
        await prisma.userAsset.create({
          data: {
            shop,
            customerId,
            sessionId,
            url,
            filename: file.name,
            filesize: file.size,
            width,
            height,
            mimetype: file.type,
            tags: []
          }
        });
      } catch (error) {
        console.error("Failed to save asset metadata:", error);
        // Don't fail the upload if metadata save fails
      }
    }

    return json({
      success: true,
      asset: {
        url,
        key: s3Key,
        name: file.name,
        type: file.type,
        size: file.size,
        width,
        height,
      },
    });
  } catch (error) {
    console.error("Error uploading asset:", error);
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
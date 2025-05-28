import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { uploadBase64ImageToS3, generateTemplateThumbnailKey } from "../services/s3.server";

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const formData = await request.formData();
    const name = formData.get("name") as string;
    const canvasData = formData.get("canvasData") as string;
    const thumbnail = formData.get("thumbnail") as string | null;

    if (!name || !canvasData) {
      return json({ error: "Name and canvas data are required" }, { status: 400 });
    }

    // Create template in database first to get the ID
    const template = await db.template.create({
      data: {
        name,
        shop: session.shop,
        canvasData,
        thumbnail: null, // We'll update this after S3 upload
      },
    });

    // Upload thumbnail to S3 if provided
    let thumbnailUrl = null;
    if (thumbnail) {
      try {
        const s3Key = generateTemplateThumbnailKey(session.shop, template.id);
        thumbnailUrl = await uploadBase64ImageToS3(s3Key, thumbnail);
        
        // Update template with S3 URL
        await db.template.update({
          where: { id: template.id },
          data: { thumbnail: thumbnailUrl },
        });
      } catch (s3Error) {
        console.error("Error uploading thumbnail to S3:", s3Error);
        // Continue without thumbnail - non-critical error
      }
    }

    return json({ 
      success: true, 
      template: {
        ...template,
        thumbnail: thumbnailUrl,
      }
    });
  } catch (error) {
    console.error("Error saving template:", error);
    return json({ error: "Failed to save template" }, { status: 500 });
  }
}
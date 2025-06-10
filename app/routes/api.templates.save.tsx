import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { uploadBase64ImageToS3, generateTemplateThumbnailKey } from "../services/s3.server";
import { syncTemplateThumbnailToVariants } from "../services/template-sync.server";

export async function action({ request }: ActionFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const formData = await request.formData();
    const name = formData.get("name") as string;
    const canvasData = formData.get("canvasData") as string;
    const thumbnail = formData.get("thumbnail") as string | null;
    const templateId = formData.get("templateId") as string | null;
    const productLayoutId = formData.get("productLayoutId") as string | null;
    const colorVariant = formData.get("colorVariant") as string | null;

    if (!name || !canvasData) {
      return json({ error: "Name and canvas data are required" }, { status: 400 });
    }

    let template;
    
    if (templateId) {
      // Update existing template
      // First verify the template belongs to this shop
      const existingTemplate = await db.template.findFirst({
        where: {
          id: templateId,
          shop: session.shop,
        },
      });

      if (!existingTemplate) {
        return json({ error: "Template not found or access denied" }, { status: 404 });
      }

      // Update the template
      template = await db.template.update({
        where: { id: templateId },
        data: {
          name,
          canvasData,
          colorVariant: colorVariant || existingTemplate.colorVariant,
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new template - require productLayoutId and colorVariant
      if (!productLayoutId || !colorVariant) {
        return json({ error: "Product layout and color variant are required for new templates" }, { status: 400 });
      }
      
      template = await db.template.create({
        data: {
          name,
          shop: session.shop,
          canvasData,
          productLayoutId,
          colorVariant,
          thumbnail: null, // We'll update this after S3 upload
        },
      });
    }

    // Upload thumbnail to S3 if provided
    let thumbnailUrl = template.thumbnail; // Keep existing thumbnail if not updating
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
        // Return error info for debugging
        return json({ 
          success: true, 
          template: {
            ...template,
            thumbnail: template.thumbnail, // Keep existing thumbnail
          },
          warning: `Thumbnail upload failed: ${s3Error instanceof Error ? s3Error.message : 'Unknown error'}`
        });
      }
    }

    // Sync thumbnail to any bound product variants
    let syncResult = null;
    if (thumbnail) {
      try {
        console.log(`Attempting to sync thumbnail for template ${template.id} to product variants...`);
        syncResult = await syncTemplateThumbnailToVariants(admin, template.id, thumbnail);
        console.log(`Sync result:`, syncResult);
      } catch (syncError) {
        console.error("Error syncing thumbnail to variants:", syncError);
        // Don't fail the save operation if sync fails
      }
    }

    return json({ 
      success: true, 
      template: {
        ...template,
        thumbnail: thumbnailUrl,
      },
      syncResult
    });
  } catch (error) {
    console.error("Error saving template:", error);
    return json({ error: "Failed to save template" }, { status: 500 });
  }
}
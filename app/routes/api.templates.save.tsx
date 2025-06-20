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
    let canvasData = formData.get("canvasData") as string;
    const thumbnail = formData.get("thumbnail") as string | null;
    const frontThumbnail = formData.get("frontThumbnail") as string | null;
    const backThumbnail = formData.get("backThumbnail") as string | null;
    const templateId = formData.get("templateId") as string | null;
    
    // New Shopify references
    const shopifyProductId = formData.get("shopifyProductId") as string | null;
    const shopifyVariantId = formData.get("shopifyVariantId") as string | null;
    
    // Layout system support
    const layoutVariantId = formData.get("layoutVariantId") as string | null;
    
    // Legacy support
    const productLayoutId = formData.get("productLayoutId") as string | null;
    const colorVariant = formData.get("colorVariant") as string | null;
    
    // Parse canvas data to check for dual-sided format
    let parsedCanvasData: any;
    let frontCanvasData: string | null = null;
    let backCanvasData: string | null = null;
    
    try {
      parsedCanvasData = JSON.parse(canvasData);
      
      // Check if it's the new dual-sided format
      if (parsedCanvasData.front || parsedCanvasData.back) {
        frontCanvasData = parsedCanvasData.front ? JSON.stringify(parsedCanvasData.front) : null;
        backCanvasData = parsedCanvasData.back ? JSON.stringify(parsedCanvasData.back) : null;
        
        // For backward compatibility, set canvasData to the front side
        if (frontCanvasData) {
          canvasData = frontCanvasData;
        }
      }
    } catch (e) {
      console.error("Error parsing canvas data:", e);
    }
    
    console.log("Save API received:", {
      name,
      templateId,
      shopifyProductId,
      shopifyVariantId,
      layoutVariantId,
      productLayoutId,
      hasCanvasData: !!canvasData,
      hasFrontData: !!frontCanvasData,
      hasBackData: !!backCanvasData,
      hasThumbnail: !!thumbnail
    });

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
          // New dual-sided fields
          ...(frontCanvasData && { frontCanvasData }),
          ...(backCanvasData && { backCanvasData }),
          // Update Shopify references if provided
          ...(shopifyProductId && { shopifyProductId }),
          ...(shopifyVariantId && { shopifyVariantId }),
          ...(layoutVariantId && { layoutVariantId }),
          // Keep legacy fields for now
          colorVariant: colorVariant || existingTemplate.colorVariant,
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new template
      // Prefer layout system, then Shopify references, then legacy
      if (!layoutVariantId && !shopifyProductId && !productLayoutId) {
        return json({ error: "Product or layout reference is required for new templates" }, { status: 400 });
      }
      
      if (shopifyProductId && !shopifyVariantId) {
        return json({ error: "Variant ID is required when using Shopify product" }, { status: 400 });
      }
      
      template = await db.template.create({
        data: {
          name,
          shop: session.shop,
          canvasData,
          // New dual-sided fields
          frontCanvasData,
          backCanvasData,
          // Layout system
          layoutVariantId,
          // New Shopify references
          shopifyProductId,
          shopifyVariantId,
          // Legacy fields (will be null if using newer systems)
          productLayoutId,
          colorVariant,
          thumbnail: null, // We'll update this after S3 upload
        },
      });
    }

    // Upload thumbnails to S3
    let thumbnailUrl = template.thumbnail; // Keep existing thumbnail if not updating
    let frontThumbnailUrl = template.frontThumbnail;
    let backThumbnailUrl = template.backThumbnail;
    const thumbnailUpdates: any = {};

    // Upload legacy single thumbnail
    if (thumbnail) {
      try {
        const s3Key = generateTemplateThumbnailKey(session.shop, template.id);
        thumbnailUrl = await uploadBase64ImageToS3(s3Key, thumbnail);
        thumbnailUpdates.thumbnail = thumbnailUrl;
      } catch (s3Error) {
        console.error("Error uploading thumbnail to S3:", s3Error);
      }
    }

    // Upload front thumbnail
    if (frontThumbnail) {
      try {
        const s3Key = generateTemplateThumbnailKey(session.shop, template.id, 'front');
        frontThumbnailUrl = await uploadBase64ImageToS3(s3Key, frontThumbnail);
        thumbnailUpdates.frontThumbnail = frontThumbnailUrl;
      } catch (s3Error) {
        console.error("Error uploading front thumbnail to S3:", s3Error);
      }
    }

    // Upload back thumbnail
    if (backThumbnail) {
      try {
        const s3Key = generateTemplateThumbnailKey(session.shop, template.id, 'back');
        backThumbnailUrl = await uploadBase64ImageToS3(s3Key, backThumbnail);
        thumbnailUpdates.backThumbnail = backThumbnailUrl;
      } catch (s3Error) {
        console.error("Error uploading back thumbnail to S3:", s3Error);
      }
    }

    // Update template with all thumbnail URLs
    if (Object.keys(thumbnailUpdates).length > 0) {
      await db.template.update({
        where: { id: template.id },
        data: thumbnailUpdates,
      });
    }

    // Sync thumbnail to any bound product variants
    // For dual-sided templates, prefer frontThumbnail over the legacy thumbnail
    let syncResult = null;
    const thumbnailToSync = frontThumbnail || thumbnail;
    
    if (thumbnailToSync) {
      try {
        console.log(`Attempting to sync thumbnail for template ${template.id} to product variants...`);
        console.log(`Using ${frontThumbnail ? 'front thumbnail' : 'legacy thumbnail'} for sync`);
        syncResult = await syncTemplateThumbnailToVariants(admin, template.id, thumbnailToSync);
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
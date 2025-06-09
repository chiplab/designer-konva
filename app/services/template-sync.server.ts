import type { Prisma } from "@prisma/client";
import { uploadImageToShopify, updateVariantImage } from "./shopify-image.server";
import { renderCanvasToBuffer } from "./canvas-renderer.server";
import db from "../db.server";

const PRODUCT_VARIANTS_QUERY = `#graphql
  query GetProductVariantsWithMetafields {
    productVariants(first: 100) {
      edges {
        node {
          id
          title
          displayName
          product {
            id
            title
          }
          metafield(namespace: "custom_designer", key: "template_id") {
            value
          }
        }
      }
    }
  }
`;

/**
 * Syncs a template's thumbnail to all product variants that are bound to it
 * Returns the count of successfully synced variants and any errors
 */
export async function syncTemplateThumbnailToVariants(
  admin: any,
  templateId: string,
  thumbnailDataUrl: string | null
): Promise<{
  success: boolean;
  syncedCount: number;
  totalCount: number;
  errors: string[];
}> {
  if (!thumbnailDataUrl) {
    return {
      success: false,
      syncedCount: 0,
      totalCount: 0,
      errors: ["No thumbnail provided"],
    };
  }

  try {
    // Get all variants that use this template
    const response = await admin.graphql(PRODUCT_VARIANTS_QUERY);
    const { data } = await response.json();
    
    const variantsToSync = data.productVariants.edges
      .filter((edge: any) => edge.node.metafield?.value === templateId)
      .map((edge: any) => edge.node);

    if (variantsToSync.length === 0) {
      return {
        success: true,
        syncedCount: 0,
        totalCount: 0,
        errors: [],
      };
    }

    // Upload thumbnail to Shopify and update variants
    let successCount = 0;
    const errors: string[] = [];
    
    for (const variant of variantsToSync) {
      try {
        // Upload image to Shopify
        const filename = `template-${templateId}-${variant.id.split('/').pop()}.png`;
        console.log(`Uploading thumbnail for variant ${variant.id} with filename: ${filename}`);
        
        const imageInfo = await uploadImageToShopify(admin, thumbnailDataUrl, filename);
        console.log(`Thumbnail uploaded successfully: ${imageInfo.url}`);
        
        // Update variant image
        await updateVariantImage(admin, variant.id, imageInfo.url);
        successCount++;
        
        console.log(`✓ Updated variant ${variant.id} with template thumbnail`);
      } catch (error) {
        const errorMsg = `Failed to update variant ${variant.displayName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    }
    
    return {
      success: successCount > 0,
      syncedCount: successCount,
      totalCount: variantsToSync.length,
      errors,
    };
  } catch (error) {
    console.error("Error syncing template thumbnail:", error);
    return {
      success: false,
      syncedCount: 0,
      totalCount: 0,
      errors: [error instanceof Error ? error.message : "Unknown error"],
    };
  }
}

/**
 * Syncs a template by server-side rendering it and uploading to Shopify
 * This ensures Shopify can optimize the images properly
 */
export async function syncTemplateWithServerRender(
  admin: any,
  templateId: string,
  session: { shop: string }
): Promise<{
  success: boolean;
  syncedCount: number;
  totalCount: number;
  errors: string[];
}> {
  try {
    // Get the template with canvas data
    const template = await db.template.findFirst({
      where: {
        id: templateId,
        shop: session.shop,
      },
    });

    if (!template) {
      return {
        success: false,
        syncedCount: 0,
        totalCount: 0,
        errors: ["Template not found"],
      };
    }

    console.log(`Server-rendering template: ${template.name}`);
    
    // Render the canvas server-side
    const imageBuffer = await renderCanvasToBuffer(template.canvasData);
    const dataUrl = `data:image/png;base64,${imageBuffer.toString('base64')}`;
    
    // Get all variants that use this template
    const response = await admin.graphql(PRODUCT_VARIANTS_QUERY);
    const { data } = await response.json();
    
    const variantsToSync = data.productVariants.edges
      .filter((edge: any) => edge.node.metafield?.value === templateId)
      .map((edge: any) => edge.node);

    if (variantsToSync.length === 0) {
      return {
        success: true,
        syncedCount: 0,
        totalCount: 0,
        errors: [],
      };
    }

    // Upload server-rendered image to Shopify and update variants
    let successCount = 0;
    const errors: string[] = [];
    
    for (const variant of variantsToSync) {
      try {
        // Upload image to Shopify (this will create a staged upload)
        const filename = `template-${templateId}-${variant.id.split('/').pop()}.png`;
        console.log(`Uploading server-rendered image for variant ${variant.id}`);
        
        const imageInfo = await uploadImageToShopify(admin, dataUrl, filename);
        console.log(`Server-rendered image uploaded successfully: ${imageInfo.url}`);
        
        // Update variant image
        await updateVariantImage(admin, variant.id, imageInfo.url);
        successCount++;
        
        console.log(`✓ Updated variant ${variant.id} with server-rendered image`);
      } catch (error) {
        const errorMsg = `Failed to update variant ${variant.displayName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    }
    
    return {
      success: successCount > 0,
      syncedCount: successCount,
      totalCount: variantsToSync.length,
      errors,
    };
  } catch (error) {
    console.error("Error syncing template with server render:", error);
    return {
      success: false,
      syncedCount: 0,
      totalCount: 0,
      errors: [error instanceof Error ? error.message : "Unknown error"],
    };
  }
}
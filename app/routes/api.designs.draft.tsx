import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import db from "../db.server";
import { 
  generateCustomerDesignKey, 
  uploadCustomerDesignAsset,
  uploadBase64ImageToS3 
} from "../services/s3.server";

export async function action({ request }: ActionFunctionArgs) {
  // Handle CORS preflight requests
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-shopify-shop-domain",
        "Access-Control-Max-Age": "86400", // Cache preflight for 24 hours
      },
    });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const formData = await request.formData();
    const templateId = formData.get("templateId") as string;
    const variantId = formData.get("variantId") as string;
    const productId = formData.get("productId") as string;
    const canvasState = formData.get("canvasState") as string;
    const frontCanvasData = formData.get("frontCanvasData") as string;
    const backCanvasData = formData.get("backCanvasData") as string;
    const isDualSided = formData.get("isDualSided") === "true";
    const thumbnail = formData.get("thumbnail") as string;
    const email = formData.get("email") as string | null;
    
    // Get shop from header (set by Shopify proxy)
    const shop = request.headers.get("x-shopify-shop-domain") || 
                 new URL(request.url).searchParams.get("shop");

    if (!shop) {
      return json({ error: "Shop not found" }, { status: 400 });
    }

    // Validate required fields based on template type
    if (!templateId || !variantId || !productId) {
      return json({ error: "Missing required fields" }, { status: 400 });
    }
    
    if (!isDualSided && !canvasState) {
      return json({ error: "Missing canvas state for single-sided template" }, { status: 400 });
    }
    
    if (isDualSided && (!frontCanvasData || !backCanvasData)) {
      return json({ error: "Missing canvas data for dual-sided template" }, { status: 400 });
    }

    // Verify template exists and belongs to shop
    const template = await db.template.findFirst({
      where: {
        id: templateId,
        shop: shop,
      },
    });

    if (!template) {
      return json({ error: "Template not found" }, { status: 404 });
    }

    // Create draft with 30-day expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Prepare canvas data based on template type
    let finalCanvasState: string;
    if (isDualSided) {
      // For dual-sided templates, store both front and back data
      finalCanvasState = JSON.stringify({
        isDualSided: true,
        frontCanvasData: frontCanvasData,
        backCanvasData: backCanvasData
      });
    } else {
      // For single-sided templates, use the canvas state as-is
      finalCanvasState = canvasState;
    }

    // Create the design record
    const design = await db.customerDesign.create({
      data: {
        shop,
        email,
        templateId,
        productId,
        variantId,
        canvasState: finalCanvasState,
        thumbnail: "", // Will update after upload
        status: "draft",
        expiresAt,
      },
    });

    // Upload canvas state to S3
    const canvasKey = generateCustomerDesignKey(
      shop,
      design.id,
      'draft',
      null,
      'canvas'
    );
    
    await uploadCustomerDesignAsset(canvasKey, finalCanvasState, {
      contentType: 'application/json',
      expiresInDays: 30,
    });

    // Upload thumbnail if provided
    let thumbnailUrl = "";
    if (thumbnail) {
      const thumbnailKey = generateCustomerDesignKey(
        shop,
        design.id,
        'draft',
        null,
        'thumbnail'
      );
      
      thumbnailUrl = await uploadBase64ImageToS3(thumbnailKey, thumbnail, 'image/png');
      
      // Update design with thumbnail URL
      await db.customerDesign.update({
        where: { id: design.id },
        data: { thumbnail: thumbnailUrl },
      });
    }

    return json({
      success: true,
      design: {
        ...design,
        thumbnail: thumbnailUrl,
      },
    }, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-shopify-shop-domain",
      },
    });
  } catch (error) {
    console.error("Error creating draft:", error);
    return json(
      { error: "Failed to create draft" },
      { 
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, x-shopify-shop-domain",
        },
      }
    );
  }
}
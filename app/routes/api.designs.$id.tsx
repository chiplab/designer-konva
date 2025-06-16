import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import db from "~/db.server";
import { 
  generateCustomerDesignKey, 
  uploadCustomerDesignAsset,
  uploadBase64ImageToS3,
  getSignedS3Url
} from "~/services/s3.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { id } = params;
  
  // Get shop from header or query
  const shop = request.headers.get("x-shopify-shop-domain") || 
               new URL(request.url).searchParams.get("shop");

  if (!shop || !id) {
    return json({ error: "Missing shop or design ID" }, { status: 400 });
  }

  try {
    const design = await db.customerDesign.findFirst({
      where: {
        id,
        shop,
      },
      include: {
        template: true,
      },
    });

    if (!design) {
      return json({ error: "Design not found" }, { status: 404 });
    }

    // Check if design is expired
    if (design.expiresAt && new Date(design.expiresAt) < new Date()) {
      return json({ error: "Design has expired" }, { status: 410 });
    }

    // Get canvas data from S3
    const canvasKey = generateCustomerDesignKey(
      shop,
      design.id,
      design.status as 'draft' | 'saved',
      design.customerId,
      'canvas'
    );

    // For now, return the canvas state from DB
    // In production, we'd fetch from S3
    
    return json({
      success: true,
      design: {
        ...design,
        template: {
          id: design.template.id,
          name: design.template.name,
          shopifyProductId: design.template.shopifyProductId,
          shopifyVariantId: design.template.shopifyVariantId,
        },
      },
    });
  } catch (error) {
    console.error("Error loading design:", error);
    return json(
      { error: "Failed to load design" },
      { status: 500 }
    );
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "PUT" && request.method !== "PATCH") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const { id } = params;
  const formData = await request.formData();
  
  // Get shop from header or form data
  const shop = request.headers.get("x-shopify-shop-domain") || 
               formData.get("shop") as string;

  if (!shop || !id) {
    return json({ error: "Missing shop or design ID" }, { status: 400 });
  }

  try {
    // Verify design exists and belongs to shop
    const existingDesign = await db.customerDesign.findFirst({
      where: {
        id,
        shop,
      },
    });

    if (!existingDesign) {
      return json({ error: "Design not found" }, { status: 404 });
    }

    // Prepare update data
    const updateData: any = {};
    
    if (formData.has("name")) {
      updateData.name = formData.get("name") as string;
    }
    
    if (formData.has("status")) {
      updateData.status = formData.get("status") as string;
      
      // If saving from draft, remove expiration
      if (existingDesign.status === "draft" && updateData.status === "saved") {
        updateData.expiresAt = null;
      }
    }
    
    if (formData.has("customerId")) {
      updateData.customerId = formData.get("customerId") as string;
    }
    
    if (formData.has("isPublic")) {
      updateData.isPublic = formData.get("isPublic") === "true";
    }

    // Update canvas state if provided
    if (formData.has("canvasState")) {
      const canvasState = formData.get("canvasState") as string;
      updateData.canvasState = canvasState;
      
      // Upload new canvas state to S3
      const canvasKey = generateCustomerDesignKey(
        shop,
        id,
        (updateData.status || existingDesign.status) as 'draft' | 'saved',
        updateData.customerId || existingDesign.customerId,
        'canvas'
      );
      
      await uploadCustomerDesignAsset(canvasKey, canvasState, {
        contentType: 'application/json',
      });
    }

    // Update thumbnail if provided
    if (formData.has("thumbnail")) {
      const thumbnail = formData.get("thumbnail") as string;
      
      const thumbnailKey = generateCustomerDesignKey(
        shop,
        id,
        (updateData.status || existingDesign.status) as 'draft' | 'saved',
        updateData.customerId || existingDesign.customerId,
        'thumbnail'
      );
      
      const thumbnailUrl = await uploadBase64ImageToS3(thumbnailKey, thumbnail, 'image/png');
      updateData.thumbnail = thumbnailUrl;
    }

    // Update the design
    const updatedDesign = await db.customerDesign.update({
      where: { id },
      data: updateData,
    });

    return json({
      success: true,
      design: updatedDesign,
    });
  } catch (error) {
    console.error("Error updating design:", error);
    return json(
      { error: "Failed to update design" },
      { status: 500 }
    );
  }
}
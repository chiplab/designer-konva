import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import db from "~/db.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const formData = await request.formData();
    const designId = formData.get("designId") as string;
    const customerId = formData.get("customerId") as string;
    const name = formData.get("name") as string | null;
    
    // Get shop from header
    const shop = request.headers.get("x-shopify-shop-domain") || 
                 formData.get("shop") as string;

    if (!shop || !designId || !customerId) {
      return json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify design exists and belongs to shop
    const design = await db.customerDesign.findFirst({
      where: {
        id: designId,
        shop,
      },
    });

    if (!design) {
      return json({ error: "Design not found" }, { status: 404 });
    }

    // Update design to saved status
    const updatedDesign = await db.customerDesign.update({
      where: { id: designId },
      data: {
        status: "saved",
        customerId,
        name: name || `Design from ${new Date().toLocaleDateString()}`,
        expiresAt: null, // Remove expiration
      },
    });

    // TODO: Move S3 files from draft to saved location
    // This would involve copying the files to the new location
    // and deleting the old ones

    return json({
      success: true,
      design: updatedDesign,
    });
  } catch (error) {
    console.error("Error saving design:", error);
    return json(
      { error: "Failed to save design" },
      { status: 500 }
    );
  }
}
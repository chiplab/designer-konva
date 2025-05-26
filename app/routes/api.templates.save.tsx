import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

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

    // Create template in database
    const template = await db.template.create({
      data: {
        name,
        shop: session.shop,
        canvasData,
        thumbnail,
      },
    });

    return json({ success: true, template });
  } catch (error) {
    console.error("Error saving template:", error);
    return json({ error: "Failed to save template" }, { status: 500 });
  }
}
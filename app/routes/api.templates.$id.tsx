import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const { id } = params;

  if (!id) {
    return json({ error: "Template ID is required" }, { status: 400 });
  }

  try {
    const template = await db.template.findFirst({
      where: {
        id,
        shop: session.shop, // Ensure shop isolation
      },
    });

    if (!template) {
      return json({ error: "Template not found" }, { status: 404 });
    }

    return json({ template });
  } catch (error) {
    console.error("Error loading template:", error);
    return json({ error: "Failed to load template" }, { status: 500 });
  }
}
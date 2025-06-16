import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import db from "../db.server";

export async function loader({ params }: LoaderFunctionArgs) {
  const { id } = params;

  if (!id) {
    return json({ error: "Template ID is required" }, { status: 400 });
  }

  try {
    const template = await db.template.findFirst({
      where: {
        id,
      },
      select: {
        id: true,
        name: true,
        canvasData: true,
        // Don't expose sensitive data like shop
      },
    });

    if (!template) {
      return json({ error: "Template not found" }, { status: 404 });
    }

    // Parse the canvas data to return it as an object
    const templateData = {
      ...JSON.parse(template.canvasData),
      id: template.id,
      name: template.name,
    };

    return json({ template: templateData });
  } catch (error) {
    console.error("Error loading template:", error);
    return json({ error: "Failed to load template" }, { status: 500 });
  }
}
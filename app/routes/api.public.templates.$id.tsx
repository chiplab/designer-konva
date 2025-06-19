import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import db from "../db.server";

export async function loader({ params }: LoaderFunctionArgs) {
  const { id } = params;

  console.log(`[Public Template API] Fetching template with ID: ${id}`);

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
      console.error(`[Public Template API] Template not found with ID: ${id}`);
      
      // Let's check if any template exists with a similar ID pattern
      const similarTemplates = await db.template.findMany({
        where: {
          id: { startsWith: id.substring(0, 10) }
        },
        select: {
          id: true,
          name: true,
        },
        take: 5
      });
      
      console.log(`[Public Template API] Similar templates found:`, similarTemplates);
      
      return json({ error: "Template not found" }, { status: 404 });
    }

    console.log(`[Public Template API] Template found: ${template.name} (ID: ${template.id})`);
    
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
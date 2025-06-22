import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import db from "../db.server";

// Handle OPTIONS requests
export async function action({ request }: ActionFunctionArgs) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400", // Cache preflight for 24 hours
      },
    });
  }
  
  return json({ error: "Method not allowed" }, { status: 405 });
}

export async function loader({ request, params }: LoaderFunctionArgs) {

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
        frontCanvasData: true,
        backCanvasData: true,
        frontThumbnail: true,
        backThumbnail: true,
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
      // Include front/back data if available
      frontCanvasData: template.frontCanvasData ? JSON.parse(template.frontCanvasData) : null,
      backCanvasData: template.backCanvasData ? JSON.parse(template.backCanvasData) : null,
      frontThumbnail: template.frontThumbnail,
      backThumbnail: template.backThumbnail,
    };

    return json({ template: templateData }, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Cache-Control": "public, max-age=300", // Cache for 5 minutes
      },
    });
  } catch (error) {
    console.error("Error loading template:", error);
    return json({ error: "Failed to load template" }, { 
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }
}
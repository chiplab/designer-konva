import { json, type LoaderFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";

// This route handles app proxy requests from the theme
// URL pattern: /apps/designer/api/template/:templateId
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { templateId } = params;
  
  // Get shop from Shopify app proxy headers or query params
  const url = new URL(request.url);
  const shop = request.headers.get('x-shopify-shop-domain') || 
               url.searchParams.get('shop') ||
               'printlabs-app-dev.myshopify.com'; // Fallback for testing
  
  console.log('App proxy request:', {
    templateId,
    shop,
    headers: Object.fromEntries(request.headers.entries()),
    url: request.url
  });
  
  if (!shop || !templateId) {
    return json({ error: "Missing required parameters", shop, templateId }, { status: 400 });
  }

  try {
    const template = await prisma.template.findFirst({
      where: {
        id: templateId,
        shop: shop
      }
    });

    if (!template) {
      return json({ error: "Template not found" }, { status: 404 });
    }

    // Parse the canvas data
    const canvasData = JSON.parse(template.canvasData);
    
    // Return template data optimized for canvas renderer
    return json({
      template: {
        id: template.id,
        name: template.name,
        dimensions: canvasData.dimensions,
        backgroundColor: canvasData.backgroundColor,
        designableArea: canvasData.designableArea,
        elements: canvasData.elements,
        assets: canvasData.assets
      }
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
      }
    });
  } catch (error) {
    console.error('Error loading template:', error);
    return json({ error: "Failed to load template" }, { status: 500 });
  }
};
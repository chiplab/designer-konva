import { json, type LoaderFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { templateId } = params;
  
  // For app proxy requests, we need to handle authentication differently
  const url = new URL(request.url);
  const isAppProxy = url.pathname.includes('/api/template/');
  
  let shop = null;
  
  if (isAppProxy) {
    // App proxy requests include shop in query params or headers
    shop = url.searchParams.get('shop') || request.headers.get('x-shopify-shop-domain');
  } else {
    // Regular app requests use session authentication
    try {
      const { session } = await authenticate.admin(request);
      shop = session.shop;
    } catch (error) {
      // If authentication fails, try to get shop from query params
      shop = url.searchParams.get('shop');
    }
  }
  
  if (!shop || !templateId) {
    return json({ error: "Missing required parameters" }, { status: 400 });
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
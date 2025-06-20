import type { LoaderFunctionArgs } from "@remix-run/node";
import db from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  // Determine the base URL for assets
  const url = new URL(request.url);
  const isProxyAccess = url.hostname.includes('myshopify.com');
  
  // Get design or template ID from query params
  const designId = url.searchParams.get("design");
  const templateId = url.searchParams.get("template");
  const returnUrl = url.searchParams.get("return");
  
  // Get shop from header (set by Shopify proxy) or query param
  const shop = request.headers.get("x-shopify-shop-domain") || 
               url.searchParams.get("shop") || 
               "printlabs-app-dev.myshopify.com"; // Default for testing
  
  // Load design or template data
  let templateData = null;
  let designData = null;
  let colorVariant = null;
  
  // Load all template colors for client-side color transformation
  const templateColors = await db.templateColor.findMany({
    orderBy: { chipColor: 'asc' },
  });
  
  if (designId && shop) {
    // Load customer design
    const design = await db.customerDesign.findFirst({
      where: {
        id: designId,
        shop: shop,
      },
      include: {
        template: true,
      },
    });
    
    if (design) {
      // Prepare design data
      designData = {
        id: design.id,
        name: design.name,
        status: design.status,
        templateId: design.templateId,
        variantId: design.variantId,
        productId: design.productId,
      };
      
      // Use canvas data from design
      templateData = {
        id: design.template.id,
        name: design.template.name,
        canvasData: design.canvasState,
        frontCanvasData: design.template.frontCanvasData,
        backCanvasData: design.template.backCanvasData,
      };
      
      // Get the color variant from the template
      colorVariant = design.template.colorVariant;
    }
  } else if (templateId && shop) {
    // Load template directly
    const template = await db.template.findFirst({
      where: {
        id: templateId,
        shop: shop,
      },
    });
    
    if (template) {
      // Prepare template data for embedding
      templateData = {
        id: template.id,
        name: template.name,
        canvasData: template.canvasData,
        frontCanvasData: template.frontCanvasData,
        backCanvasData: template.backCanvasData,
      };
      
      // Get the color variant from the template
      colorVariant = template.colorVariant;
    }
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>Designer - Full Editor</title>
        <style>
          body { 
            margin: 0; 
            padding: 0; 
            font-family: Arial, sans-serif; 
            height: 100vh;
            overflow: hidden;
          }
          #canvas-root { 
            height: 100vh;
            display: flex;
            flex-direction: column;
          }
          .canvas-header {
            padding: 20px;
            background: #f8f9fa;
            border-bottom: 1px solid #ddd;
            flex-shrink: 0;
          }
          .canvas-container {
            flex: 1;
            overflow: hidden;
            position: relative;
            background: #f5f5f5;
          }
        </style>
      </head>
      <body>
        <div id="canvas-root">Loading canvas....</div>
        
        <!-- React and React-DOM from CDN -->
        <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
        <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
        
        <!-- Embed template data if available -->
        ${templateData ? `
        <script>
          window.__INITIAL_TEMPLATE__ = ${JSON.stringify(templateData)};
        </script>
        ` : ''}
        
        <!-- Embed design data if available -->
        ${designData ? `
        <script>
          window.__INITIAL_DESIGN__ = ${JSON.stringify(designData)};
          window.__SHOP_DOMAIN__ = ${JSON.stringify(shop)};
        </script>
        ` : ''}
        
        ${returnUrl ? `
        <script>
          window.__RETURN_URL__ = ${JSON.stringify(returnUrl)};
        </script>
        ` : ''}
        
        <!-- Embed template colors for Design Color feature -->
        <script>
          window.__TEMPLATE_COLORS__ = ${JSON.stringify(templateColors)};
          window.__INITIAL_COLOR_VARIANT__ = ${JSON.stringify(colorVariant)};
        </script>
        
        <!-- Load our standalone canvas bundle (includes Konva) -->
        <script src="standalone/standalone-canvas.js"></script>
        
        <!-- Fallback test if bundle not found -->
        <script>
          // If bundle doesn't load, show a test message
          setTimeout(function() {
            const root = document.getElementById('canvas-root');
            if (root && root.textContent === 'Loading canvas...') {
              root.innerHTML = '<h2>Bundle not found</h2><p>Run: npm run build:standalone</p>';
            }
          }, 1000);
        </script>
      </body>
    </html>
  `;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html",
      "Cache-Control": "no-store",
    },
  });
}
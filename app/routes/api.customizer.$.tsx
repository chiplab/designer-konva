import type { LoaderFunctionArgs } from "@remix-run/node";
import db from "../db.server";

// This is a resource route that returns raw HTML
// URL: /apps/designer/customizer/anything
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const stateParam = url.searchParams.get("state");
  const shop = url.searchParams.get("shop") || 
              request.headers.get('x-shopify-shop-domain') ||
              'printlabs-app-dev.myshopify.com';
  
  console.log('Customizer $ request:', {
    url: request.url,
    shop,
    stateParam: stateParam ? 'present' : 'missing',
  });
  
  let template = null;
  let initialState = null;
  
  if (stateParam && shop) {
    try {
      // Decode state from product-customizer-modal
      const decodedState = JSON.parse(atob(stateParam));
      const { templateId, variantId, textUpdates } = decodedState;
      
      console.log('Decoded state:', { templateId, variantId, textUpdatesCount: Object.keys(textUpdates || {}).length });
      
      // Load the template
      if (templateId) {
        template = await db.template.findFirst({
          where: {
            id: templateId,
            shop: shop,
          },
        });
        
        // Prepare initial state with text updates from modal
        if (template) {
          initialState = {
            templateId,
            variantId,
            textUpdates: textUpdates || {},
            fromModal: true
          };
        }
      }
    } catch (error) {
      console.error('Error parsing state parameter:', error);
    }
  }
  
  console.log('Template lookup result:', {
    templateFound: !!template,
    templateId: template?.id,
    templateName: template?.name,
    hasCanvasData: !!template?.canvasData
  });
  
  if (!template) {
    return new Response(`
      <!DOCTYPE html>
      <html><body>
        <h1>Template not found</h1>
        <p>Could not load template for customization.</p>
        <button onclick="window.history.back()">Go Back</button>
      </body></html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
  
  // Return a complete HTML page
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Customize: ${template.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      background: #f8f9fa;
      overflow: hidden;
    }
    .header {
      position: fixed; top: 0; left: 0; right: 0; height: 60px;
      background: white; border-bottom: 1px solid #e5e5e5;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 20px; z-index: 1000; box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header h1 { margin: 0; font-size: 20px; font-weight: 600; color: #333; }
    .badge {
      background: #e3f2fd; color: #1976d2; padding: 4px 12px;
      border-radius: 12px; font-size: 12px; font-weight: 500; margin-left: 15px;
    }
    .button {
      padding: 8px 16px; background: white; border: 1px solid #ddd;
      border-radius: 4px; font-size: 14px; cursor: pointer;
      display: flex; align-items: center; gap: 5px; margin-right: 10px;
    }
    .button-primary {
      background: #000; color: white; border: none;
      font-weight: 500; padding: 8px 20px;
    }
    .canvas-container {
      position: absolute; top: 60px; left: 0; right: 0; bottom: 0;
      display: flex; justify-content: center; align-items: center; padding: 20px;
    }
    .loading { text-align: center; color: #666; font-size: 16px; }
    .welcome-overlay {
      position: absolute; top: 80px; right: 20px;
      background: rgba(255, 255, 255, 0.95); padding: 15px; border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15); max-width: 300px;
      font-size: 14px; border: 1px solid #e5e5e5; z-index: 1001;
    }
  </style>
</head>
<body>
  <div class="header">
    <div style="display: flex; align-items: center;">
      <h1>Customize: ${template.name}</h1>
      ${initialState?.fromModal ? '<span class="badge">Continuing from preview</span>' : ''}
    </div>
    <div style="display: flex; align-items: center;">
      <button class="button" onclick="window.history.back()">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 12L6 8l4-4" stroke="currentColor" stroke-width="2"/>
        </svg>
        Back
      </button>
      <button class="button button-primary" onclick="saveDesign()">Save Design</button>
    </div>
  </div>
  
  <div class="canvas-container">
    <div class="loading" id="loading">Loading designer...</div>
    <div id="stage-container" style="display: none;"></div>
  </div>
  
  ${initialState?.fromModal ? `
  <div class="welcome-overlay" id="welcomeOverlay">
    <div style="font-weight: 600; margin-bottom: 8px; color: #333;">
      👋 Welcome to the full designer!
    </div>
    <div style="color: #666; line-height: 1.4; margin-bottom: 10px;">
      Your changes from the quick preview have been applied.
    </div>
    <button onclick="document.getElementById('welcomeOverlay').style.display='none'" 
            style="padding: 5px 10px; background: #f0f0f0; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">
      Got it
    </button>
  </div>
  ` : ''}
  
  <script src="https://unpkg.com/konva@9/konva.min.js"></script>
  <script>
    const templateData = ${JSON.stringify(template)};
    const initialState = ${JSON.stringify(initialState)};
    
    console.log('Template data:', templateData);
    console.log('Initial state:', initialState);
    
    function saveDesign() {
      alert('Save functionality coming soon!');
    }
    
    // Initialize when Konva loads
    document.addEventListener('DOMContentLoaded', function() {
      if (window.Konva && templateData) {
        setTimeout(initializeCanvas, 100); // Small delay to ensure DOM is ready
      } else {
        document.getElementById('loading').textContent = 'Failed to load Konva or template data';
      }
    });
    
    function initializeCanvas() {
      try {
        console.log('Starting canvas initialization...');
        
        const canvasData = JSON.parse(templateData.canvasData);
        console.log('Canvas data:', canvasData);
        
        const container = document.getElementById('stage-container');
        const stage = new Konva.Stage({
          container: container,
          width: canvasData.dimensions.width,
          height: canvasData.dimensions.height,
        });
        
        const layer = new Konva.Layer();
        
        // Add text elements
        if (canvasData.elements.textElements) {
          console.log('Adding', canvasData.elements.textElements.length, 'text elements');
          canvasData.elements.textElements.forEach(textEl => {
            const finalText = initialState?.textUpdates?.[textEl.id] || textEl.text;
            console.log('Text element:', textEl.id, 'text:', finalText);
            
            const text = new Konva.Text({
              x: textEl.x,
              y: textEl.y,
              text: finalText,
              fontSize: 24,
              fontFamily: textEl.fontFamily || 'Arial',
              fill: 'black',
              draggable: true
            });
            layer.add(text);
          });
        }
        
        // Add curved text elements  
        if (canvasData.elements.curvedTextElements) {
          console.log('Adding', canvasData.elements.curvedTextElements.length, 'curved text elements');
          canvasData.elements.curvedTextElements.forEach(curvedEl => {
            const finalText = initialState?.textUpdates?.[curvedEl.id] || curvedEl.text;
            console.log('Curved text element:', curvedEl.id, 'text:', finalText);
            
            // For now, just render as regular text - we'll improve this later
            const text = new Konva.Text({
              x: curvedEl.x,
              y: curvedEl.topY + curvedEl.radius,
              text: finalText,
              fontSize: 20,
              fontFamily: curvedEl.fontFamily || 'Arial',
              fill: 'blue',
              draggable: true
            });
            layer.add(text);
          });
        }
        
        stage.add(layer);
        
        // Show the canvas
        document.getElementById('loading').style.display = 'none';
        container.style.display = 'block';
        
        console.log('Canvas initialized successfully!');
        
      } catch (error) {
        console.error('Canvas initialization error:', error);
        document.getElementById('loading').textContent = 'Error: ' + error.message;
      }
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
};
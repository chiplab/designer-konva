import type { LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  // Determine the base URL for assets
  const url = new URL(request.url);
  const isProxyAccess = url.hostname.includes('myshopify.com');
  // When accessed through proxy, we need to use the full app URL
  const appUrl = isProxyAccess ? 'https://app.printlabs.com' : '';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>Standalone Canvas Test</title>
        <style>
          body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
          #canvas-root { margin-top: 20px; }
        </style>
      </head>
      <body>
        <div id="canvas-root">Loading canvas...</div>
        
        <!-- React and React-DOM from CDN -->
        <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
        <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
        
        <!-- Konva from CDN -->
        <script src="https://unpkg.com/konva@9/konva.min.js"></script>
        
        <!-- Load our standalone canvas bundle -->
        <script src="${appUrl}/standalone/standalone-canvas.js"></script>
        
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
import type { LoaderFunctionArgs } from '@remix-run/node';

export async function loader({ request }: LoaderFunctionArgs) {
  // Return raw HTML that loads the designer without Remix hydration
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Product Designer</title>
  <style>
    body { margin: 0; padding: 0; font-family: system-ui; }
    #loading { padding: 20px; text-align: center; }
    #app { padding: 0; }
  </style>
</head>
<body>
  <div id="loading">
    <h2>Loading Designer...</h2>
    <p>Please wait while we initialize the canvas.</p>
  </div>
  <div id="app" style="display: none;"></div>
  
  <script>
    // Show app and hide loading once ready
    window.addEventListener('DOMContentLoaded', function() {
      setTimeout(function() {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        document.getElementById('app').innerHTML = '<h1>Static Designer Loaded!</h1><p>This bypasses Remix hydration entirely.</p><button onclick="alert(\'JavaScript works!\')">Test JS</button>';
      }, 1000);
    });
  </script>
</body>
</html>
  `;
  
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html',
    },
  });
}
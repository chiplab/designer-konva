import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.public.appProxy(request);
  
  const html = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Proxy Test</title>
  </head>
  <body>
    <h1>App Proxy is Working!</h1>
    <p>If you see this, the proxy route is functioning correctly.</p>
    <p>URL: ${request.url}</p>
    <p>Time: ${new Date().toISOString()}</p>
    <button onclick="alert('JavaScript is working!')">Test JS</button>
    <script>
      console.log('JavaScript loaded and executed!');
      document.body.style.backgroundColor = '#e0f0e0';
    </script>
  </body>
</html>
  `;
  
  return new Response(html, {
    headers: {
      "Content-Type": "text/html",
    },
  });
};
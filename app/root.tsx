import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";

export default function App() {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <Meta />
        <Links />
        {/* Inject manifest interceptor for Shopify proxy */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (window.location.hostname.includes('myshopify.com')) {
                const originalFetch = window.fetch;
                window.fetch = function(input, init) {
                  if (!input) return originalFetch.call(this, input, init);
                  
                  let url = typeof input === 'string' ? input : (input.url || '');
                  
                  if (url && url.includes('__manifest') && !url.startsWith('http')) {
                    const newUrl = 'https://app.printlabs.com' + (url.startsWith('/') ? url : '/' + url);
                    if (typeof input === 'string') {
                      return originalFetch.call(this, newUrl, init);
                    } else {
                      return originalFetch.call(this, new Request(newUrl, init || {}), init);
                    }
                  }
                  
                  return originalFetch.call(this, input, init);
                };
              }
            `,
          }}
        />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

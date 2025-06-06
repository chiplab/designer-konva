import { RemixBrowser } from "@remix-run/react";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";

// Override fetch for __manifest requests when accessed through Shopify proxy
if (typeof window !== 'undefined' && window.location.hostname.includes('myshopify.com')) {
  const originalFetch = window.fetch;
  window.fetch = function(input: RequestInfo | URL, init?: RequestInit) {
    let url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    
    // Only rewrite __manifest URLs
    if (url && url.includes('__manifest') && !url.startsWith('http')) {
      const appUrl = 'https://app.printlabs.com';
      url = `${appUrl}/${url.replace(/^\//, '')}`;
      
      if (typeof input === 'string') {
        input = url;
      } else if (input instanceof URL) {
        input = new URL(url);
      } else {
        input = new Request(url, input);
      }
    }
    
    return originalFetch.call(this, input, init);
  };
}

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <RemixBrowser />
    </StrictMode>
  );
});
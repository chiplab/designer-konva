import { RemixBrowser } from "@remix-run/react";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";

// Override fetch to use absolute URLs when accessed through Shopify proxy
if (typeof window !== 'undefined' && window.location.hostname.includes('myshopify.com')) {
  const originalFetch = window.fetch;
  window.fetch = function(input: RequestInfo | URL, init?: RequestInit) {
    let url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    
    // Rewrite relative URLs to absolute URLs
    if (url && !url.startsWith('http')) {
      const appUrl = 'https://app.printlabs.com';
      // Handle URLs that start with / or __
      if (url.startsWith('/') || url.startsWith('__')) {
        url = `${appUrl}/${url.replace(/^\//, '')}`;
      }
      
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
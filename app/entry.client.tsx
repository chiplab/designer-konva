import { RemixBrowser } from "@remix-run/react";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";

// Override fetch to use absolute URLs when accessed through Shopify proxy
if (typeof window !== 'undefined' && window.location.hostname.includes('myshopify.com')) {
  const originalFetch = window.fetch;
  window.fetch = function(input: RequestInfo | URL, init?: RequestInit) {
    if (typeof input === 'string' && input.startsWith('/__manifest')) {
      // Use absolute URL for manifest requests
      const appUrl = 'https://app.printlabs.com';
      input = `${appUrl}${input}`;
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
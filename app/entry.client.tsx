import { RemixBrowser } from "@remix-run/react";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";

// Disable Vite HMR and manifest requests when accessed through Shopify proxy
if (typeof window !== 'undefined' && 
    window.location.hostname.includes('myshopify.com')) {
  // Override import.meta.hot to disable HMR
  if (import.meta.hot) {
    import.meta.hot.dispose = () => {};
    import.meta.hot.invalidate = () => {};
    import.meta.hot.accept = () => {};
    import.meta.hot.on = () => {};
  }
}

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <RemixBrowser />
    </StrictMode>
  );
});
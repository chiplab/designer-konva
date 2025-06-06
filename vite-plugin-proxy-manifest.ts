import type { Plugin } from 'vite';

export function proxyManifestPlugin(): Plugin {
  return {
    name: 'proxy-manifest',
    transformIndexHtml(html) {
      // Inject a script that intercepts manifest requests
      const script = `
        <script>
          (function() {
            // Only run on Shopify proxy domains
            if (!window.location.hostname.includes('myshopify.com')) return;
            
            const appUrl = 'https://app.printlabs.com';
            
            // Only handle __manifest requests, not other assets
            const originalFetch = window.fetch;
            window.fetch = function(input, init) {
              let url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
              
              // Only rewrite __manifest URLs that are relative
              if (url && url.includes('__manifest') && !url.startsWith('http')) {
                url = appUrl + (url.startsWith('/') ? url : '/' + url);
                
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
          })();
        </script>
      `;
      
      // Inject the script at the beginning of the head
      return html.replace('<head>', '<head>' + script);
    },
  };
}
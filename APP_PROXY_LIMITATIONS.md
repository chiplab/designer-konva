# APP_PROXY_LIMITATIONS.md

## Previous Limitations (Now Solved)

Previously, Shopify App Proxy had significant limitations for Remix apps:
- JavaScript assets couldn't load through the proxy (404 errors on `/build/*`)
- No client-side hydration possible
- Limited to server-rendered content only

## Solution Implemented

We've implemented a solution based on the approach from [shopify-app-template-remix#436](https://github.com/Shopify/shopify-app-template-remix/issues/436):

1. **Route Pattern**: Based on app proxy configuration in `shopify.app.toml`
2. **Separate Routes**: Keep admin routes (`app.*.tsx`) separate from proxy routes (`api.*.tsx`)
3. **Import Paths**: Use relative imports (`../shopify.server`) instead of aliases in proxy routes

## Current Implementation

### Routes:
- **Admin Interface**: `app.designer.tsx` - For embedded admin at `/app/designer`
- **Proxy Interface**: `api.designer.designer.tsx` - For storefront at `/apps/designer/designer`

The proxy routing works because:
- App proxy URL: `/api`
- Subpath: `designer`
- Full proxy path: `/apps/designer/designer` → routes to → `/api/designer/designer`

### Access URLs:
- **Admin**: `https://admin.shopify.com/store/your-store/apps/designer-17/designer`
- **Proxy**: `https://your-store.myshopify.com/apps/designer/designer`

## Testing

To test both routes:
1. Run `npm run dev`
2. For admin interface: Go to Shopify admin → Apps → designer → Open designer page
3. For proxy interface: Visit `https://your-store.myshopify.com/apps/designer/designer`

## Important Notes

- The vite configuration has been simplified to avoid conflicts
- Production deployment still requires custom Express server for proxy routing
- Both routes can coexist without interfering with each other
# Shopify Customer Account Authentication Guide

This document captures what we learned about implementing customer authentication in Shopify app proxies and theme extensions.

## Key Discoveries

### 1. App Proxy Authentication Parameters

**Important**: Shopify app proxies pass customer authentication as **query parameters**, not headers!

```typescript
// WRONG - This won't work in app proxy context
const customerId = request.headers.get("x-shopify-customer-id");

// CORRECT - Use query parameters
const customerId = url.searchParams.get("logged_in_customer_id");
```

### 2. Shopify Customer Accounts (New Passwordless System)

The new Customer Accounts use passwordless authentication. The login URL format is:

```javascript
// For customer-facing pages (app proxy/theme extensions)
const loginUrl = `/customer_authentication/login?return_to=${encodeURIComponent(returnPath)}&locale=en`;

// NOT these older URLs:
// ❌ /account/login
// ❌ /auth/login
```

### 3. Query Parameters from App Proxy

When a request comes through the Shopify app proxy, these parameters are included:

```
- shop: The shop domain
- logged_in_customer_id: Customer ID if logged in (null if anonymous)
- path_prefix: The app proxy path (e.g., /apps/designer)
- timestamp: Request timestamp
- signature: HMAC signature for request validation
```

## Implementation Pattern

### 1. Detecting Customer Authentication

```typescript
// In your loader function (Remix)
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  
  // Get customer ID from query params
  const customerId = url.searchParams.get("logged_in_customer_id") || null;
  
  // Pass to frontend
  return new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
}
```

### 2. Frontend Authentication Check

```javascript
// In React components
function MyComponent({ customerId }) {
  const isLoggedIn = !!customerId;
  
  if (!isLoggedIn) {
    // Build login URL with return path
    const currentPath = window.location.pathname + window.location.search;
    const loginUrl = `/customer_authentication/login?return_to=${encodeURIComponent(currentPath)}&locale=en`;
    
    return <a href={loginUrl}>Sign in to save your work</a>;
  }
  
  // Show logged-in content
}
```

### 3. Session Management for Anonymous Users

```javascript
// Generate session ID for anonymous users
useEffect(() => {
  let sessionId = localStorage.getItem('userSessionId');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem('userSessionId', sessionId);
  }
  setSessionId(sessionId);
}, []);
```

### 4. Asset Migration Pattern

When users log in, migrate their anonymous work:

```typescript
// Migration endpoint
export async function action({ request }: ActionFunctionArgs) {
  const { shop, sessionId, customerId } = await request.json();
  
  // Transfer ownership from sessionId to customerId
  await prisma.userAsset.updateMany({
    where: { shop, sessionId, customerId: null },
    data: { customerId, sessionId: null }
  });
}
```

## Best Practices

1. **Always Check Both IDs**: When loading user data, check for both `customerId` and `sessionId`
2. **Migrate on First Access**: Automatically migrate anonymous data when logged-in user first accesses
3. **Clear Session After Migration**: Remove sessionId from localStorage after successful migration
4. **Use Proper Return URLs**: Include full path and query params in return_to parameter
5. **Handle Proxy Paths**: Detect if running through proxy and adjust API paths accordingly

## Common Pitfalls

1. **Wrong Header Names**: Don't look for headers like `x-shopify-customer-id` in app proxy context
2. **Wrong Login URLs**: Don't use `/account/login` - use `/customer_authentication/login`
3. **Missing Return Path**: Always include return_to parameter for seamless UX
4. **Forgetting Query Params**: Include all original query params in the return URL

## Testing Checklist

- [ ] Test anonymous user flow (sessionId only)
- [ ] Test login redirect with return_to
- [ ] Verify customer ID detection after login
- [ ] Test asset/data migration
- [ ] Verify sessionId cleanup after migration
- [ ] Test in both admin and storefront contexts

## Future Considerations

For "My Saved Designs" feature:
1. Use the same customer ID detection pattern
2. Implement similar migration for saved designs
3. Consider email-based lookup as fallback
4. Add share tokens for public design sharing
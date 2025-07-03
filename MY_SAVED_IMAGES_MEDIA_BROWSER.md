# My Saved Images - Media Browser Feature

## Overview

The Media Browser is a full-featured image management system integrated into the Designer Canvas that allows users to:
- Upload and store images in AWS S3
- Browse previously uploaded images
- Save images temporarily (session-based) or permanently (customer-based)
- Access their image library across design sessions

## Architecture

### Database Schema

```prisma
model UserAsset {
  id          String   @id @default(cuid())
  shop        String
  customerId  String?  // Shopify customer ID when logged in
  sessionId   String?  // Browser session for anonymous users
  url         String   // S3 URL
  filename    String
  filesize    Int
  width       Int?
  height      Int?
  mimetype    String
  tags        String[] @default([])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([shop, customerId])
  @@index([shop, sessionId])
  @@index([createdAt])
}
```

### Key Components

1. **MediaBrowser Component** (`app/components/MediaBrowser.tsx`)
   - Modal interface matching the Font Browser design
   - Drag-and-drop upload functionality
   - Grid layout for image browsing
   - Search functionality (by filename and tags)
   - Session/Customer ID awareness

2. **API Endpoints**
   - `/api/assets/upload` - Handles image uploads to S3 and saves metadata
   - `/api/assets/list` - Retrieves user's saved images

3. **Integration Points**
   - DesignerCanvas: "Browse Images" button replaces "Add Image"
   - Full Designer (`full.tsx`): Passes customer ID from Shopify headers
   - Standalone Canvas: Propagates customer ID to components

## Authentication Flow

### Current Implementation

1. **Anonymous Users (Not Logged In)**
   - Images saved with `sessionId` (UUID stored in localStorage)
   - Yellow warning banner: "You are not signed in. Images will be saved temporarily."
   - "Sign in to save permanently →" link

2. **Authenticated Users (Logged In)**
   - Images saved with `customerId` from Shopify Customer Account
   - No warning banner shown
   - All uploads permanently associated with customer account

### Authentication URLs

- **Admin Route** (`/app/designer`): Uses `/auth/login` (merchant authentication)
- **Proxy Route** (`/apps/designer/full`): Uses `/account/login` (customer authentication)

The Media Browser detects which environment it's in:
```javascript
href={window.location.hostname.includes('.myshopify.com') ? '/account/login' : '/auth/login'}
```

### Customer ID Flow

1. `full.tsx` loader checks for `x-shopify-customer-id` header
2. Customer ID passed to frontend via `window.__CUSTOMER_ID__`
3. `standalone-canvas.tsx` retrieves and passes to DesignerCanvas
4. DesignerCanvas passes to MediaBrowser component
5. MediaBrowser uses for API calls and UI state

## Proxy Support

The Media Browser supports both admin and proxy access:

### API Path Detection
```javascript
const isProxyAccess = window.location.hostname.includes('.myshopify.com');
const apiPath = isProxyAccess ? '/apps/designer/api/assets/list' : '/api/assets/list';
```

### Proxy Configuration (shopify.app.toml)
```toml
[app_proxy]
url = "https://your-tunnel.trycloudflare.com"
subpath = "designer"
prefix = "apps"
```

## Features

### Image Upload
- Drag-and-drop or click to browse
- Image validation (must be image MIME type)
- Automatic S3 upload with structured paths
- Metadata extraction (dimensions via Sharp)
- Progress indicator during upload

### Image Management
- Grid view with image previews
- File information (name, size, dimensions)
- Click to select and insert into canvas
- Responsive layout
- Search functionality (coming soon)

### Storage Strategy
- AWS S3 for image storage
- PostgreSQL for metadata and associations
- Session-based storage for anonymous users
- Customer-based storage for authenticated users

## Usage

### For Users
1. Click "Browse Images" button in the designer
2. Upload new images or select from existing library
3. Sign in to save images permanently
4. Access saved images across all designs

### For Developers
```typescript
// Import and use MediaBrowser
import MediaBrowser from './MediaBrowser';

<MediaBrowser
  isOpen={showMediaBrowser}
  onClose={() => setShowMediaBrowser(false)}
  onSelectImage={handleImageSelection}
  shop={shop}
  sessionId={sessionId}
  customerId={customerId}
/>
```

## Known Issues & TODO

### Authentication Redirect Issue
Currently, after customer login via `/account/login`, users are redirected to their Shopify account orders page (`https://shopify.com/{shop_id}/account/orders`) instead of back to the designer.

**Planned Fix:**
1. Add return URL parameter to login link
2. Implement proper OAuth callback handling
3. Use Shopify's Customer Account API redirect_uri parameter

### Future Enhancements
1. Image tagging and categorization
2. Bulk upload support
3. Image editing capabilities (crop, resize)
4. Shared team libraries
5. Integration with external image services
6. Improved search with filters

## Technical Notes

### Session Management
- Session IDs are UUIDs stored in localStorage
- Persists across page reloads
- Used as fallback when no customer ID available

### CORS Configuration
- S3 bucket configured with appropriate CORS headers
- Supports cross-origin image loading for canvas operations

### Performance Considerations
- Images loaded on-demand
- Pagination support ready for large libraries
- Efficient metadata queries with proper indexing

## Security

- Shop isolation: Users only see images from their shop
- Customer isolation: Logged-in users only see their own images
- Session isolation: Anonymous users only see session-specific images
- S3 URLs are public but unguessable
- No directory listing on S3 bucket

## Migration Path

For existing users upgrading to customer accounts:
1. Session-based images remain accessible via session ID
2. After login, new uploads use customer ID
3. Future: Tool to migrate session images to customer account
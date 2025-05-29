# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
- `npm run dev` - Start development server with Shopify CLI (includes Prisma migrations and Remix dev)
- `npm run build` - Build the application for production
- `npm run lint` - Run ESLint checks
- `npm run setup` - Generate Prisma client and deploy migrations (required for initial setup and production)

### Shopify CLI Commands
- `npm run config:link` - Link app configuration to Shopify Partners
- `npm run generate` - Generate Shopify app extensions or other resources
- `npm run deploy` - Deploy app to Shopify
- `npm run config:use` - Switch between app configurations
- `npm run env` - Show/manage environment variables

### Database Commands
- `npm run prisma` - Access Prisma CLI directly
- Prisma migrations are handled automatically during `npm run dev`
- For production: `npm run setup` handles both `prisma generate` and `prisma migrate deploy`

## Architecture Overview

See `VISION.md` for the complete product vision and architecture roadmap for building a Shopify product customization system.

### Tech Stack
- **Framework**: Remix (React-based full-stack framework)
- **Database**: SQLite with Prisma ORM (easily configurable for other databases)
- **UI**: Shopify Polaris components + App Bridge for embedded Shopify admin integration
- **API**: Shopify Admin GraphQL API (January 2025 version)
- **Authentication**: Shopify App OAuth with session storage via Prisma
- **Storage**: AWS S3 for asset storage (images, SVGs, fonts)
- **Canvas**: Konva.js for design canvas and React-Konva for React integration

### Project Structure
- `app/` - Main application code (Remix convention)
  - `routes/` - File-based routing with nested routes
  - `components/` - Reusable React components (e.g., DesignerCanvas)
  - `services/` - Service modules (e.g., s3.server.ts for AWS S3 operations)
  - `shopify.server.ts` - Shopify app configuration and authentication
  - `db.server.ts` - Database connection
- `prisma/` - Database schema and migrations
- `extensions/` - Shopify app extensions (theme extensions, app proxy)
- `public/` - Static assets (local fallback for S3 assets)

### Key Configuration Files
- `shopify.app.toml` - Shopify app configuration (scopes: write_products)
- `shopify.web.toml` - Web component configuration 
- `vite.config.ts` - Build configuration with Shopify-specific HMR setup
- `prisma/schema.prisma` - Database schema with Session and Template models
- `.env` - Environment variables (AWS credentials, Shopify API keys)
- `S3_SETUP.md` - AWS S3 bucket configuration guide

### Authentication & API Access
- All admin routes require authentication via `authenticate.admin(request)`
- GraphQL queries use `admin.graphql()` method from authenticated context
- Session data stored in SQLite database via Prisma adapter
- App is embedded in Shopify admin by default

### Routes Pattern
- `app._index.tsx` - Main dashboard with product creation demo
- `app.designer.tsx` - Embedded designer interface with Konva canvas
- `app.templates.tsx` - Template management (list, assign to products)
- `app.product-bindings.tsx` - View template-variant associations
- `app.metafield-setup.tsx` - One-time metafield configuration
- `api.templates.*.tsx` - Template CRUD operations
- `api.assets.*.tsx` - Asset upload and management endpoints
- `api.customizer.$.tsx` - Full-screen designer resource route
- `proxy.designer.tsx` - Standalone designer (accessed via app proxy)
- `auth.*.tsx` - Authentication flow handling
- `webhooks.*.tsx` - Webhook endpoints for app lifecycle events

### Important Notes
- Uses modern Remix v2 features with Vite bundler
- Configured for App Store distribution
- Supports both development stores and production environments
- Environment variables managed through Shopify CLI (`npm run env`)
- Database migrations handled automatically in development

## Curved Text Implementation

### Overview
The curved text feature in `proxy.designer.tsx` provides advanced typography controls for product customization, allowing text to be rendered along circular paths with dynamic radius adjustment and orientation flipping.

### Key Concepts

1. **Top-Edge Pinning**: When the text orientation is flipped, the text's top edge remains fixed at its original position. This creates an intuitive user experience where the text appears to "flip around" its top edge rather than jumping to a new location.

2. **Text Flipping**: The implementation supports two orientations:
   - **Normal (not flipped)**: Text curves upward along the path
   - **Flipped**: Text curves downward, with the baseline and text direction inverted

3. **Dynamic Radius**: Users can adjust the curve radius from 50px to 500px:
   - Smaller radius values create tighter, more dramatic curves
   - Larger radius values create gentler, more subtle curves

### Implementation Details

- **SVG Path Rendering**: The curved text is rendered using SVG `<textPath>` elements that follow circular arc paths
- **Path Calculation**: The implementation dynamically calculates the SVG path based on:
  - Current radius value
  - Flip state (normal or inverted)
  - Text dimensions and positioning
- **State Management**: React state manages:
  - `text`: The input text string
  - `radius`: Current curve radius (50-500px)
  - `isFlipped`: Boolean for text orientation
- **Responsive Controls**: Polaris components provide the UI:
  - TextField for text input
  - RangeSlider for radius adjustment
  - Checkbox for flip toggle

### Canvas Architecture
The designer canvas in `proxy.designer.tsx` uses a component-based architecture where each design element (like curved text) can be independently controlled and rendered. The canvas maintains a 600x400px viewport with centered content positioning.

## Template Save System

### Overview
The template save system enables persistent storage of canvas designs using SQLite/Prisma ORM. Following Konva.js best practices, it saves minimal state data rather than full visual serialization, allowing efficient storage and fast reconstruction of designs.

### Data Model

```prisma
model Template {
  id          String   @id @default(cuid())
  name        String
  shop        String   // Link to Shopify shop
  canvasData  String   // JSON string of canvas state
  thumbnail   String?  // Base64 or URL for preview
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### State Serialization Strategy

The system saves only essential positioning and property data, not visual details:

```typescript
interface CanvasState {
  dimensions: { width: number; height: number };
  backgroundColor: string;
  designableArea: {
    width: number;
    height: number;
    cornerRadius: number;
    x: number;
    y: number;
    visible: boolean;
  };
  elements: {
    textElements: Array<{
      id: string;
      text: string;
      x: number;
      y: number;
      fontFamily: string;
      fontSize?: number;
      fill?: string;
      rotation?: number;
      scaleX?: number;
      scaleY?: number;
    }>;
    curvedTextElements: Array<{
      id: string;
      text: string;
      x: number;
      topY: number;
      radius: number;
      flipped: boolean;
      fontFamily: string;
      fontSize?: number;
      fill?: string;
      rotation?: number;
      scaleX?: number;
      scaleY?: number;
    }>;
    gradientTextElements: Array<{
      id: string;
      text: string;
      x: number;
      y: number;
      fontFamily: string;
      fontSize?: number;
      rotation?: number;
      scaleX?: number;
      scaleY?: number;
    }>;
    svgElements: Array<{
      id: string;
      x: number;
      y: number;
      width: number;
      height: number;
      rotation?: number;
      scaleX?: number;
      scaleY?: number;
    }>;
    imageElements: Array<{
      id: string;
      url: string;
      x: number;
      y: number;
      width: number;
      height: number;
      rotation?: number;
    }>;
  };
  assets: {
    baseImage?: string; // URL reference
    svgAssets?: string[]; // URL references
  };
}
```

### Implementation Guidelines

1. **Serialization Functions** (in DesignerCanvas.tsx):
   - `getCanvasState()`: Extracts current state from React components
   - `loadCanvasState(state)`: Restores canvas from saved state

2. **API Routes**:
   - `api.templates.save.tsx`: POST endpoint to save/update templates
     - Creates new template if no templateId provided
     - Updates existing template if templateId is in form data
     - Verifies shop ownership before updates
   - `api.templates.$id.tsx`: GET endpoint to load specific template
   - `api.templates.tsx`: GET endpoint to list all shop templates

3. **Save Process**:
   - Extract minimal state using `getCanvasState()`
   - Wait for all images to fully load before thumbnail generation
   - Generate thumbnail via `stage.toDataURL()` with error handling
   - Include templateId in form data if updating existing template
   - Save to database with shop isolation
   - Return template ID for future reference

4. **Load Process**:
   - Fetch template by ID and shop
   - Parse JSON canvas data
   - Load fonts before applying state
   - Restore state using `loadCanvasState()`

5. **Critical Element Properties**:
   - **IMPORTANT**: All elements must save transformation properties to preserve visual state
   - Text elements: fontSize, fill, rotation, scaleX, scaleY
   - Gradient text: fontSize, rotation, scaleX, scaleY (gradient is hardcoded)
   - SVG elements: rotation, scaleX, scaleY (dimensions updated on transform)
   - Curved text: fontSize, fill, rotation, scaleX, scaleY
   - All elements require `onTransformEnd` handlers to capture transformations

### Key Principles

- **Minimal State**: Only save coordinates, text, and essential properties
- **Asset References**: Store URLs/IDs instead of embedding binary data
- **Shop Isolation**: Templates are scoped to individual Shopify shops
- **Reconstruction**: Visual details are recreated from minimal state
- **Version Safety**: Consider adding version field for future migrations

### Auto-Save Considerations

- Implement debounced auto-save (e.g., 5-second delay)
- Use localStorage for temporary saves before authentication
- Sync to database after successful authentication
- Provide visual feedback for save status

## Template-Variant Binding System

### Overview
The template-variant binding system uses Shopify metafields to associate designer templates with specific product variants, enabling product customization workflows.

### Metafield Configuration

```
Namespace: custom_designer
Key: template_id
Type: single_line_text_field
Owner: ProductVariant
```

### Implementation Components

1. **Metafield Setup Route** (`app.metafield-setup.tsx`):
   - Creates metafield definition via GraphQL mutation
   - One-time setup to enable metafield in Shopify admin
   - Makes metafield visible and editable in variant admin UI

2. **Template Management** (`app.templates.tsx`):
   - Lists all templates with thumbnails and metadata
   - "Assign to products" action to link templates to variants
   - "Delete" action with confirmation modal
   - Uses ResourcePicker to select product variants
   - Updates variant metafields via GraphQL mutation
   - Supports bulk assignment to multiple variants
   - Shop-scoped deletion with ownership verification

3. **Product Bindings View** (`app.product-bindings.tsx`):
   - Lists all variants with assigned templates
   - Shows product info, variant details, and template name
   - Provides overview of template usage across catalog

### GraphQL Operations

**Creating/Updating Metafield:**
```graphql
mutation productVariantUpdate($input: ProductVariantInput!) {
  productVariantUpdate(input: $input) {
    productVariant {
      id
      metafield(namespace: "custom_designer", key: "template_id") {
        id
        value
      }
    }
  }
}
```

**Reading Metafield:**
```graphql
query GetProductVariantsWithMetafields {
  productVariants(first: 100) {
    edges {
      node {
        id
        metafield(namespace: "custom_designer", key: "template_id") {
          value
        }
      }
    }
  }
}
```

### Workflow

1. **Setup**: Run metafield setup once per store (visit /app/metafield-setup)
2. **Create**: Design templates in the designer
3. **Assign**: Link templates to product variants via "Assign to products" action
4. **View**: Check bindings in Product Bindings page
5. **Customize**: Load template when customer clicks "Customize" (future theme extension)

### Future Theme Extension Integration

The metafield enables theme integration:
```liquid
{% if product.selected_variant.metafields.custom_designer.template_id %}
  <button data-template-id="{{ product.selected_variant.metafields.custom_designer.template_id }}">
    Customize This Product
  </button>
{% endif %}
```

### Implementation Notes

1. **Metafield Mutation**: Use `metafieldsSet` mutation instead of `productVariantUpdate`:
   ```graphql
   mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
     metafieldsSet(metafields: $metafields) {
       metafields { id namespace key value }
       userErrors { field message code }
     }
   }
   ```

2. **Variant Selection**: Replaced deprecated ResourcePicker with custom Modal + ChoiceList
3. **Error Handling**: Added comprehensive logging and user feedback
4. **Type Safety**: Fixed TypeScript errors with proper type assertions

## AWS S3 Asset Storage

### Overview
The system uses AWS S3 for cloud-based asset storage, replacing base64 encoding for better performance and scalability. Templates store S3 URLs instead of embedding binary data.

### Configuration

1. **Environment Variables** (in `.env`):
   ```
   AWS_ACCESS_KEY_ID=your-access-key
   AWS_SECRET_ACCESS_KEY=your-secret-key
   ```

2. **S3 Bucket Settings**:
   - Bucket: `shopify-designs`
   - Region: `us-west-1`
   - Public read access via bucket policy (ACLs disabled for security)
   - CORS configured for Shopify domains

### Implementation Components

1. **S3 Service Module** (`app/services/s3.server.ts`):
   - Upload files and base64 images to S3
   - Generate unique keys for assets
   - Handle errors with descriptive messages
   - Support for public/private assets

2. **Asset Upload Endpoint** (`api.assets.upload.tsx`):
   - Accepts file uploads from the designer
   - Validates file types (images, SVGs, fonts)
   - Returns S3 URL for immediate use

3. **UI Integration**:
   - Asset selector dropdown in designer
   - File upload input for new assets
   - Visual indicators for S3 vs local assets
   - Support in both embedded and standalone designers

### Asset Management Flow

1. **Upload**: Files are uploaded to S3 with structured paths:
   ```
   templates/{shop}/{templateId}/thumbnail-{timestamp}.png
   assets/{shop}/{assetType}/{timestamp}-{filename}
   ```

2. **Reference**: Templates store S3 URLs in the `assets` section:
   ```typescript
   assets: {
     baseImage: "https://shopify-designs.s3.us-west-1.amazonaws.com/...",
     svgAssets: ["https://..."]
   }
   ```

3. **Display**: Canvas loads assets directly from S3 URLs

### Key Principles

- **No ACLs**: Bucket uses IAM policies instead of ACLs for security
- **Public Read**: Assets are publicly readable via bucket policy
- **Shop Isolation**: Assets organized by shop domain
- **Fallback Support**: Local assets available for development
- **Error Handling**: Detailed error messages for debugging

### Troubleshooting

See `S3_SETUP.md` for detailed setup instructions and common issues:
- Bucket policy configuration
- CORS settings
- IAM permissions
- Environment variable setup

## Canvas Image Handling

### S3 CORS Requirements
For images hosted on S3 to work properly with canvas operations:
1. S3 bucket MUST have CORS configured (see S3_SETUP.md)
2. Apply CORS using: `aws s3api put-bucket-cors --bucket shopify-designs --cors-configuration file://s3-cors-config-cli.json --region us-west-1`
3. Wait 2-3 minutes for CORS changes to propagate

### Cross-Origin Image Loading
To prevent "tainted canvas" errors when generating thumbnails:
- All external images (S3, CDNs) use `useImage(url, 'Anonymous')`
- Local images from `/public` don't need crossOrigin setting
- The canvas automatically detects URL type and applies appropriate settings

### Thumbnail Generation
The save process includes robust image loading:
1. Waits for all canvas images to fully load before generating thumbnails
2. Uses event listeners with timeout fallbacks (5 seconds max)
3. Implements error handling with lower quality fallback options
4. Logs warnings for failed image loads but continues with save process

### Best Practices
- Ensure S3 CORS is properly configured before using S3-hosted images
- Use 'Anonymous' (capital A) for crossOrigin parameter in useImage
- S3 uploads include proper cache control headers
- Canvas operations handle missing or failed images gracefully
- Monitor console for CORS errors when images fail to display
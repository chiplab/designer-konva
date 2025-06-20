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
- **Database Access**: PostgreSQL via AWS RDS, accessed through SSH tunnel on localhost:5432
- **RDS Tunnel**: Use `npm run db:tunnel` or `./scripts/rds-tunnel.sh` to establish SSH tunnel
- **Database Studio**: Use `npm run db:studio` to open Prisma Studio UI

## Architecture Overview

See `VISION.md` for the complete product vision and architecture roadmap for building a Shopify product customization system.

### Tech Stack
- **Framework**: Remix (React-based full-stack framework)
- **Database**: PostgreSQL with Prisma ORM (AWS RDS hosted, accessed via localhost:5432 tunnel)
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
- `api.templates.*.tsx` - Template CRUD operations (save, load, generate variants)
- `api.assets.upload.tsx` - Asset upload endpoint
- `api.test-template-render.tsx` - Server-side template rendering for testing
- `auth.*.tsx` - Authentication flow handling
- `webhooks.*.tsx` - Webhook endpoints for app lifecycle events

**Note**: Several unused API routes have been removed to simplify the codebase:
- Removed `api.customizer.$.tsx` (unused full-screen designer route)
- Removed `api.assets.$.tsx` (replaced by direct S3 URLs)
- Removed other legacy/unused API endpoints

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
     - **Automatically syncs thumbnails to bound product variants**
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

## Automatic Template Thumbnail Syncing

### Overview
The system automatically syncs template thumbnails to Shopify product variant images, ensuring preview consistency across the store.

### Implementation

1. **Template Sync Service** (`app/services/template-sync.server.ts`):
   - Finds all variants using a specific template via metafields
   - Uploads thumbnail to Shopify as variant image
   - Handles errors gracefully without failing save operations
   - Returns detailed sync results

2. **Automatic Sync on Save**:
   - When a template is saved, thumbnails automatically sync to all bound variants
   - Non-blocking operation - template saves succeed even if sync fails
   - Logs detailed sync results for debugging

3. **Manual Re-sync**:
   - "Re-sync preview images" action in template list
   - Updates all variants with latest template thumbnail
   - Shows success/error messages via toast notifications

### Benefits
- Product pages show actual template preview as variant image
- Customers see accurate representation before customizing
- Reduces need for manual image management
- Maintains consistency across product catalog

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

### Theme Extension Integration

The system includes a fully functional theme extension for product customization:

1. **Product Customizer Block** (`extensions/canvas-api-pdp/blocks/product_customizer.liquid`):
   - Adds customization button to product pages
   - Only shows for variants with assigned templates
   - Integrates seamlessly with any Shopify theme

2. **Product Customizer Modal** (`extensions/canvas-api-pdp/assets/product-customizer-modal.js`):
   - **Position-aware slide-out panel**: Detects product info section and slides over it
   - **Smart positioning**: On desktop, covers only the product title/description area
   - **Product image integration**: Replaces main product image with live preview
   - **Dynamic variant loading**: Loads the correct template for the selected variant
   - **Variant image updates**: Updates product images when switching variants
   - **Simplified customization**: Text-only editing for quick personalization
   - **Advanced editor link**: Button to open full designer for complex edits
   - **Responsive design**: Full-screen on mobile, contained overlay on desktop
   
3. **Canvas Text Renderer** (`extensions/canvas-api-pdp/assets/canvas-text-renderer.js`):
   - Lightweight Konva-based renderer for text customization
   - Loads templates via API and allows text updates
   - Supports background gradients from template data
   - Handles bold text weights correctly (fontStyle: 'bold' for Konva)
   - Generates preview images for cart line items

### Product Customizer Modal Features

The modal provides a streamlined customization experience:
- **Automatic preview updates**: Shows variant's synced template thumbnail
- **Live product image replacement**: Updates main product image during customization
- **Variant-aware templates**: Loads the correct template for each product variant
- **Dynamic image switching**: Updates all product images when variant changes
- **Text-only interface**: Simple text inputs for each editable element
- **Add to cart integration**: Saves customization data as line item properties
- **Position detection**: Automatically positions over product info section
- **Gradient background support**: Renders template background gradients correctly
- **Bold text rendering**: Properly handles bold fonts in canvas renderer

### State Management Between Full Designer and Product Customizer

The system maintains two types of state for product customization:

1. **Text-Only State** (`customization_global_text`):
   - Saved when users make text changes in the product customizer modal
   - Contains only text updates, preserving variant-specific colors and backgrounds
   - Applied on top of the current variant's template design

2. **Full Canvas State** (`customization_global_state`):
   - Saved ONLY when users click "Done" in the full designer (`app/routes/full.tsx`)
   - Contains complete design state: backgrounds, colors, positions, etc.
   - Becomes the authoritative design for ALL variants (except base images)
   - Once saved, all variants use this state as their base design

### State Flow:

1. **Before Full Designer**:
   - Each variant uses its own template with specific colors/backgrounds
   - Text changes made in product customizer preserve variant properties
   - Users see different colors when switching variants

2. **After Full Designer** (user clicks "Done"):
   - Full canvas state is saved globally
   - ALL variants now use this saved state as their design base
   - Base images remain variant-specific for product identification
   - Further text changes apply on top of this global design state

3. **Variant Switching Behavior**:
   - System checks for global canvas state first
   - If found: Loads variant's base image + applies global design
   - If not found: Checks for text-only updates and applies them to variant's template
   - Preview automatically regenerates when switching variants

### Implementation Details:

- **Message Listener** (lines 1146-1163): Saves full canvas state when receiving "design-saved" from full designer
- **saveTextState()** (lines 1579-1587): Only saves text updates, not full canvas state
- **handleVariantChange()** (lines 1606-1686): Applies appropriate state based on what's available
- **generateVariantPreviewWithCanvasState()**: Renders previews with full canvas state + variant base image

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
- All external images (S3, CDNs) use `useImage(url, 'anonymous')`
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
- Use 'anonymous' (lowercase) for crossOrigin parameter in useImage
- S3 uploads include proper cache control headers
- Canvas operations handle missing or failed images gracefully
- Monitor console for CORS errors when images fail to display

## UI/UX Design Decisions

### Native Shopify UI Integration
The designer interface uses Shopify Polaris components with the `fullWidth` prop on Page components to match native Shopify Product pages. This removes max-width constraints and provides a seamless, integrated experience within the Shopify admin.

### Element Interaction Patterns

1. **Floating Toolbar**: When an element is selected, a floating toolbar appears above the transformer with:
   - Duplicate button (📋) - Also accessible via Ctrl/Cmd+D
   - Delete button (🗑️) - Also accessible via Delete/Backspace keys
   - Positioned dynamically to follow elements as they move

2. **Keyboard Shortcuts**:
   - Delete/Backspace: Remove selected element
   - Ctrl/Cmd+D: Duplicate selected element
   - Escape: Cancel text editing

3. **Visual Feedback**:
   - Blue transformer borders for selected elements
   - Hover effects on all interactive buttons
   - Clear visual indicators for active states

### Simplified Element Types

The designer supports three core element types:
1. **Regular Text**: Standard text with font, size, and color controls
2. **Curved Text**: Text along circular paths with radius and flip controls
3. **Images**: User-uploaded images with resize and rotation support

**Removed Features**:
- SVG elements were removed to simplify the interface
- Gradient text as a separate element type was removed

### Color System

1. **Predefined Color Palette**: 13 carefully selected colors matching common design needs:
   - White (#ffffff)
   - Red (#c8102e)
   - Blue (#0057b8)
   - Green (#009639)
   - Black (#000000)
   - Purple (#5f259f)
   - Yellow (#fff110)
   - Grey (#a2aaad)
   - Orange (#ff8200)
   - Ivory (#f1e6b2)
   - Light Blue (#71c5e8)
   - Pink (#f8a3bc)
   - Brown (#9e652e)

2. **Gold Gradient**: A special gradient option that applies a vertical gradient:
   - Top: Gold (#FFD700)
   - Middle: Orange (#FFA500)
   - Bottom: Dark Goldenrod (#B8860B)
   - Available for both regular and curved text

3. **Visual Presentation**: 
   - Circular color swatches for intuitive selection
   - Hover effects with scale and shadow
   - Active state indicated by blue border
   - Gradient swatch shows actual gradient preview

### Curved Text Positioning

The curved text implementation maintains the visual top edge position when adjusting the diameter:
- **Normal orientation**: Top edge stays fixed while bottom expands/contracts
- **Flipped orientation**: Visual top (which is the bottom edge when flipped) stays fixed
- This creates an intuitive user experience where text appears anchored at its top

## Advanced Designer UI Improvements

### Image Upload with Aspect Ratio Preservation
- Images are uploaded to S3 and maintain their original aspect ratios
- Maximum size of 400px (width or height) while preserving proportions
- Images are automatically centered in the designable area upon upload
- Supports both user images and base template images

### Context-Aware Floating Toolbar
The designer now features a sophisticated two-part toolbar system:

1. **Fixed Top Toolbar** (VistaPrint-style):
   - Positioned 80px from top, centered horizontally
   - Contains all element controls in a clean, consistent location
   - Shows contextually based on selected element type:
     - **All elements**: Duplicate and Delete buttons
     - **Text elements**: Font family dropdown, font size input, color picker
     - **Curved text**: Additional curve radius slider and flip button
   - Professional styling with proper separators and hover states

2. **Floating Text Input**:
   - Appears above selected text elements (follows transformer position)
   - Real-time text editing as you type (no need to press Enter)
   - Blue border indicates active editing state
   - 300px width for comfortable text entry
   - Escape key to deselect

### Font Controls in Toolbar
- **Font Family**: Dropdown without label (self-explanatory)
- **Font Size**: "Size:" label with number input (removed slider for space)
- **Color Picker**: Compact swatch that expands on click
  - Shows current color as a circle
  - Click to reveal full color palette
  - Automatically closes when clicking outside

### Curved Text Controls in Toolbar
- **Curve Slider**: Labeled "Curve:" with compact 80px slider
- **Diameter Display**: Shows current diameter value
- **Flip Button**: Icon-based (↕️) for space efficiency

### Improved Selection Behavior
- Click anywhere on empty canvas to deselect elements
- Clicking on background, base image, or non-draggable elements deselects
- Transformer properly detaches when deselecting
- Color picker automatically closes on deselection

### Keyboard Shortcuts
- **Delete/Backspace**: Remove selected element
- **Ctrl/Cmd+D**: Duplicate selected element
- **Escape**: Deselect element (when in text input)

## Font System

### Overview
The application uses a curated library of 49 fonts hosted on AWS S3, replacing direct Google Fonts integration for better performance and reliability.

### Font Infrastructure

1. **Font Storage**: All fonts are stored in S3 at `https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/`
2. **Font Loading**: Dynamic font loading using the FontFace API with fallback support
3. **Font Categories**: Sans Serif, Serif, Display, Script, and Monospace
4. **Caching**: Fonts are cached in the browser after first load

### Key Components

- **Font Constants** (`app/constants/fonts.ts`): Defines all 50 curated fonts with metadata
- **Font Loader Service** (`app/services/font-loader.ts`): Handles dynamic font loading and caching
- **Font Setup Script** (`scripts/setup-fonts.mjs`): Downloads fonts from Google Fonts and uploads to S3

### Usage in Designer

1. Fonts are loaded on-demand when selected in the font picker
2. Priority fonts (Arial, Roboto, Open Sans, Montserrat, Playfair Display) are preloaded on designer initialization
3. Font loading state is tracked and shown in the UI (✓ = loaded, ⏳ = loading)
4. Templates automatically load all required fonts when opened

### Frontend Rendering

The canvas text renderer (`canvas-text-renderer.js`) includes font loading support:
- Maps font families to S3 URLs
- Loads fonts before rendering templates
- Ensures consistent rendering between designer and frontend

### Running Font Setup

To download and upload fonts to S3:
```bash
npm run setup-fonts
```

This script:
1. Downloads fonts from Google Fonts API
2. Uploads them to S3 with proper caching headers
3. Creates placeholders for system fonts

### Font Preview Images

For performance optimization, the font picker displays preview images instead of loading all fonts:

```bash
# Generate previews with actual TTF fonts (recommended)
node scripts/generate-font-previews-with-ttf.mjs

# Alternative: Simple styled previews
node scripts/generate-font-previews-simple.mjs
```

The TTF-based script:
1. Downloads TTF files from Google Fonts for each font
2. Registers them with node-canvas 
3. Generates accurate 300x60px preview images at 50px font size
4. Uploads to S3 and cleans up TTF files
5. Works for all 49 Google Fonts in our library

Preview images are stored at:
`https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/{font-id}/preview.png?v=3`

The DesignerCanvas component displays these preview images in the font picker dropdown, only loading the actual font when selected.

## Shopify Product-Based Template System

### Overview
Templates are now directly tied to Shopify products and variants, replacing the legacy ProductLayout model. This enables automatic color variant generation - create one template and automatically generate 48 color variants.

### Data Models

```prisma
model Template {
  id               String    @id @default(cuid())
  name             String
  shop             String
  
  // Shopify references
  shopifyProductId String?   // Shopify product GID
  shopifyVariantId String?   // Specific variant this template is for
  
  // Color variant tracking
  masterTemplateId String?   // References the original template (for color variants)
  isColorVariant   Boolean   @default(false)
  colorVariant     String?   // Color name (e.g., "red", "blue")
  
  // Legacy field (kept for backward compatibility)
  productLayoutId  String?
  
  // Template data
  canvasData       String    // JSON string of canvas state
  thumbnail        String?   // S3 URL for preview
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  @@index([shop])
  @@index([shopifyProductId])
  @@index([masterTemplateId])
}

model TemplateColor {
  id          String @id @default(cuid())
  chipColor   String @unique  // "white", "red", "blue", etc.
  color1      String          // Primary color hex
  color2      String          // Secondary color hex  
  color3      String          // Tertiary color hex
  color4      String?         // Optional fourth color
  color5      String?         // Optional fifth color
}
```

### Color Variant Generation

The system uses a sophisticated color mapping system to automatically generate 48 variants from a single master template:

1. **Design Once**: Create a template for one variant (e.g., "Red / 8 Spot")
2. **Automatic Generation**: Click "Generate color variants" to create templates for all other colors
3. **Smart Color Replacement**: The system identifies which colors from the palette are used and replaces them intelligently

### Color Mapping System

Each color in the TemplateColor table defines up to 5 color positions that can be used in designs:
- **color1**: Primary color (main design color)
- **color2**: Secondary color (accent or lighter shade)
- **color3**: Tertiary color (darker shade or contrast)
- **color4**: Optional fourth color
- **color5**: Optional fifth color

The color generator (`app/services/template-color-generator.server.ts`) processes:
- Text fill colors
- Text stroke colors
- Background colors (solid and gradients)
- Gradient color stops (linear and radial)

### Canvas State with Background Gradients

Templates now save background gradient information:

```typescript
interface CanvasState {
  backgroundColor: string; // Can be hex color or 'linear-gradient'
  backgroundGradient?: {
    type: 'linear' | 'radial';
    colorStops: number[]; // [position1, color1, position2, color2, ...]
  };
  // ... other properties
}
```

### Template Management Features

1. **Multi-Select and Bulk Delete**:
   - Select multiple templates using checkboxes
   - Bulk delete selected templates with confirmation modal
   - Implemented in `app.templates.tsx` using Polaris ResourceList

2. **Generate Color Variants**:
   - Available on master templates (those with shopifyProductId)
   - Creates variants for all 12 other colors automatically
   - Maintains exact design while swapping colors
   - Links to appropriate Shopify variants by pattern matching

3. **Template Types**:
   - **Master Template**: Original design with shopifyProductId (shows "Master Template" badge)
   - **Color Variant**: Auto-generated from master (shows "Color Variant" badge)
   - **Regular Template**: Standalone template without product association

### Color Palette

The designer includes 13 predefined colors matching the poker chip colors:

```typescript
const COLORS = [
  { value: '#ffffff', label: 'White' },
  { value: '#c8102e', label: 'Red' },
  { value: '#0057b8', label: 'Blue' },
  { value: '#009639', label: 'Green' },
  { value: '#000000', label: 'Black' },
  { value: '#5f259f', label: 'Purple' },
  { value: '#fff110', label: 'Yellow' },
  { value: '#a2aaad', label: 'Grey' },
  { value: '#ff8200', label: 'Orange' },
  { value: '#f1e6b2', label: 'Ivory' },
  { value: '#71c5e8', label: 'Light Blue' },
  { value: '#f8a3bc', label: 'Pink' },
  { value: '#9e652e', label: 'Brown' },
  { value: 'gold-gradient', label: 'Gold' } // Special gradient option
];
```

### Workflow

1. **Create Product in Shopify**: Set up product with all color/pattern variants
2. **Design Master Template**: Create template for one variant
3. **Generate Color Variants**: System creates templates for all other colors
4. **Automatic Assignment**: Templates are matched to variants by color and pattern
5. **Preview Sync**: Template thumbnails sync to variant images automatically

### Implementation Notes

- The system preserves the original ProductLayout references for backward compatibility
- Color replacement is position-based, not value-based, ensuring consistent swapping
- Templates track their lineage via masterTemplateId
- Server-side rendering (`api.test-template-render.tsx`) supports all color features

## Best Practices and Patterns

### Route Cleanup and Organization
- Keep API routes focused and single-purpose
- Remove unused routes to reduce codebase complexity
- Use descriptive route names that clearly indicate their function
- Avoid duplicate or overlapping functionality across routes

### Product Customizer Implementation
1. **Variant-Specific Templates**: Always load the template for the currently selected variant
2. **Dynamic Updates**: Update UI elements (images, previews) when variants change
3. **Background Gradients**: Use template data for gradients, not hardcoded values
4. **Font Rendering**: Use `fontStyle: 'bold'` for Konva.js (not `fontWeight`)
5. **Error Handling**: Gracefully handle missing templates or failed loads

### Code Quality
- Remove debug code and console.logs before committing
- Use proper error boundaries and fallbacks
- Maintain consistent patterns across similar components
- Document complex logic with inline comments

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
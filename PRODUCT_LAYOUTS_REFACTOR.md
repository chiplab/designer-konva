# Product Layouts Refactor Plan

## Overview
This document outlines the refactoring of the Product Layouts system to create a cleaner architecture with proper separation of concerns between layout management and template design.

## Current Issues
- No true "Layout" entity - templates directly reference Shopify products
- Base images are stored within templates, creating duplication
- Base image selection happens in the designer via dropdown
- No single source of truth for variant base images

## New Architecture

### Hierarchy
```
Shopify Product (with "Is Layout Source" metafield)
    ↓
Product Layout (one per product)
    ↓
Layout Variants (one per product variant, stores base image)
    ↓
Templates (created from layout variants)
```

### Key Benefits
1. **Single Source of Truth**: Base images managed in one place (Layout Variants)
2. **Better Organization**: Clear hierarchy with proper separation
3. **Performance**: S3-stored base images for fast loading
4. **Easier Updates**: Change base image in layout, all templates inherit
5. **Cleaner Designer**: No base image dropdown needed

## Database Schema

### New Models

```prisma
model ProductLayout {
  id               String           @id @default(cuid())
  shop             String
  shopifyProductId String
  productTitle     String
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt
  layoutVariants   LayoutVariant[]
  
  @@unique([shop, shopifyProductId])
  @@index([shop])
}

model LayoutVariant {
  id                String         @id @default(cuid())
  layoutId          String
  shopifyVariantId  String
  variantTitle      String
  baseImageUrl      String         // S3 URL for fast loading
  shopifyImageUrl   String?        // Original Shopify URL for reference
  position          Int            // Display order
  color             String?        // Extracted color (e.g., "Red", "Blue")
  pattern           String?        // Extracted pattern (e.g., "8 Spot", "Solid")
  productLayout     ProductLayout  @relation(fields: [layoutId], references: [id], onDelete: Cascade)
  templates         Template[]
  
  @@unique([layoutId, shopifyVariantId])
  @@index([layoutId])
}
```

### Updated Template Model
```prisma
model Template {
  // ... existing fields ...
  layoutVariantId  String?
  layoutVariant    LayoutVariant? @relation(fields: [layoutVariantId], references: [id])
  // Remove direct shopifyProductId/shopifyVariantId references eventually
}
```

## Implementation Phases

### Phase 1: Database Setup
1. Create migration for new models
2. Update Prisma schema
3. Run migrations

### Phase 2: Update Metafield
1. Change "Is Template Source" to "Is Layout Source" in Shopify
2. Update any existing products

### Phase 3: Product Layouts Page Refactor
Transform `/app/routes/app.product-layouts.tsx` from reporting view to layout management:

1. **Create Layout Flow**:
   - "Create Product Layout" button
   - Modal showing products with "Is Layout Source" = true
   - On selection: fetch all variants with images
   - Create ProductLayout record
   - For each variant:
     - Download image from Shopify
     - Upload to S3: `/layouts/{shop}/{layoutId}/variants/{variantId}/base-image.jpg`
     - Create LayoutVariant record with S3 URL
     - Extract color/pattern from variant title

2. **Layout Management View**:
   - Grid/list of existing layouts
   - Show product title, variant count
   - Actions: View variants, Delete layout
   - Variant preview grid showing base images

### Phase 4: Template Creation Flow Update
1. **Templates Page** (`/app/routes/app.templates.tsx`):
   - Change "Create template" to show layout selector
   - Modal displays available layouts with previews
   - Selection passes layoutVariantId to designer

2. **Designer Route** (`/app/routes/app.designer.tsx`):
   - Accept `layoutVariantId` parameter
   - Load LayoutVariant and pass base image to canvas
   - Remove layout selection from designer

3. **Designer Canvas** (`/app/components/DesignerCanvas.tsx`):
   - Remove base image dropdown completely
   - Accept base image URL as prop
   - Simplify state management

### Phase 5: S3 Image Management
1. **Upload Service**:
   ```typescript
   async function uploadLayoutVariantImage(
     shopifyImageUrl: string,
     layoutId: string,
     variantId: string
   ): Promise<string> {
     // Download from Shopify
     // Resize/optimize (max 2000px)
     // Upload to S3
     // Return S3 URL
   }
   ```

2. **Storage Structure**:
   ```
   shopify-designs/
     layouts/
       {shop}/
         {layoutId}/
           variants/
             {variantId}/
               base-image.jpg
   ```

### Phase 6: Update Full Designer
- Modify `/app/routes/full.tsx` to load base image from LayoutVariant
- Ensure fast loading from S3 URLs

## Migration Strategy
1. Delete all existing templates (development phase)
2. Create layouts for products that need them
3. Recreate templates using new layout system

## Performance Optimizations
1. **S3 Benefits**:
   - ~50-100ms load times (vs 200-500ms from Shopify API)
   - No API rate limits
   - Reliable availability
   - Can implement CDN if needed

2. **Image Processing**:
   - Resize variants to reasonable max size (2000px)
   - Convert to optimized JPEG
   - Set proper cache headers

## Future Enhancements
1. **Layout Refresh**: Button to re-fetch images from Shopify if products update
2. **Bulk Operations**: Create layouts for multiple products at once
3. **Template Inheritance**: Layouts could define constraints/guidelines for templates
4. **Automated Sync**: Watch for Shopify product updates and refresh images

## Success Metrics
- Cleaner codebase with proper separation of concerns
- Faster designer loading times
- Easier template management
- Single source of truth for base images
- Foundation for advanced features (batch operations, inheritance, etc.)
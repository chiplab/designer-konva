# Shopify Product-Based Template System with Color Variants

## Overview

Transform the template system to use Shopify products as the source of truth, combined with a color-based template generation system that reduces template creation from 49 to just 1.

## Phase 1: Verify & Setup Infrastructure

### 1.1 Test Product Access
- Navigate to `/app/test-product` to verify access to unpublished product (ID: 9797597331751)
- Confirm all 49 variants are visible with proper naming convention: "{Color} / {Edge Pattern}"

### 1.2 Add Product Metafield Definition
```
Namespace: custom_designer
Key: is_template_source
Type: boolean
Owner: Product
```

### 1.3 Update Database Schema
```prisma
model Template {
  id               String    @id @default(cuid())
  name             String
  shop             String
  
  // New Shopify references (replacing productLayoutId)
  shopifyProductId String    // Shopify product GID
  shopifyVariantId String    // Specific variant this template is for
  
  // Color variant tracking
  masterTemplateId String?   // References the original template (for color variants)
  isColorVariant   Boolean   @default(false)
  
  // Keep existing fields
  canvasData       String    // JSON string of canvas state
  thumbnail        String?   // Base64 or URL for preview
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

## Phase 2: Migration & Core Features

### 2.1 Create Migration Script
- Archive existing ProductLayout data
- Update existing templates to reference Shopify variants
- Remove ProductLayout model and related code

### 2.2 Update Designer Flow
- Replace ProductLayout selector with Shopify product/variant selector
- Only show products with `is_template_source = true` metafield
- Auto-load variant's image as canvas background
- Pass variant details to designer component

### 2.3 Implement Color System
Seed TemplateColor table with provided mappings:

| Chip Color | Color 1 | Color 2 | Color 3 | Color 4 | Color 5 |
|------------|---------|---------|---------|---------|---------|
| White      | #ffffff | #cccccc | #424242 | null    | null    |
| Red        | #c8102e | #ffaaaa | #6b0615 | #60a8dc | #ff6d74 |
| Blue       | #0057b8 | #7fa8db | #1a4786 | #ebe70e | #1982ea |
| Green      | #009639 | #e0eed5 | #006325 | #841d80 | #60bc82 |
| Black      | #000000 | #cccccc | #424242 | #ffffff | #5b5959 |
| Purple     | #5f259f | #aaaaff | #3f186b | #45b757 | #8e63bf |
| Yellow     | #fff110 | #febd11 | #7c6800 | #215baa | #cb9f2c |
| Grey       | #a2aaad | #97872a | #424242 | #983351 | #cccccc |
| Orange     | #ff8200 | #ffcfa3 | #87451e | #d2007d | #fcb36a |
| Ivory      | #f1e6b2 | #f7f4e8 | #b5ac85 | #7c9fcd | #fff2c1 |
| Light Blue | #71c5e8 | #b8d6e0 | #5ca0bd | #cb4a3b | #96e1ff |
| Pink       | #f8a3bc | #ffd6e1 | #d38a9f | #33ba9f | #ffc4d4 |
| Brown      | #9e652e | #c49a73 | #734921 | #000000 | #e8a86d |

## Phase 3: Template Generation Logic

### 3.1 Color Replacement Service
Create `app/services/template-color-generator.server.ts`:
- Parse template's canvasData JSON
- Identify all color usage (text fill, stroke colors, etc.)
- Map colors from source template to target colors
- Generate new canvasData for each color variant

### 3.2 Single Template → 49 Variants Workflow
1. Admin designs template for one variant (e.g., "Red / 8 Spot")
2. System identifies which colors are used from the Red palette
3. Click "Generate All Color Variants" button
4. For each color in TemplateColor table:
   - Replace colors in canvas data
   - Create new Template record
   - Link to appropriate Shopify variant
   - Set `masterTemplateId` and `isColorVariant = true`

### 3.3 Smart Variant Matching
- Parse variant title to extract color and pattern
- Match "Blue / 8 Spot" → find blue variant with 8-spot pattern
- Auto-assign generated templates to correct variants

## Phase 4: Production Workflow

### 4.1 Customer Product Creation
1. Duplicate master "Composite Poker Chips" product in Shopify
2. Rename to customer-facing name (e.g., "Business Logo Poker Chips")
3. Update product description, pricing, etc.
4. Publish the duplicate
5. Templates automatically apply via variant metafields

### 4.2 Template Management UI Updates
- Show templates grouped by master design
- Display color variants as a collapsible group
- Edit master template → option to regenerate all color variants
- Bulk operations for managing variant groups
- Visual indicator for master vs color variant templates

## Phase 5: API Endpoints

### 5.1 Product/Variant Fetching
- `GET /api/template-products` - Fetch products with `is_template_source = true`
- Include variant details, images, and metafields

### 5.2 Template Generation
- `POST /api/templates/generate-variants`
  - Input: masterTemplateId
  - Process: Generate all color variants
  - Output: Created template IDs and status

### 5.3 Variant Assignment
- Automatic assignment based on variant naming convention
- Manual override option if needed

## Implementation Benefits

1. **Efficiency**: Create 1 template instead of 49
2. **Consistency**: All color variants maintain exact same design
3. **Flexibility**: Easy to update all variants by regenerating from master
4. **Organization**: Templates grouped by design, not scattered
5. **Reliability**: Leverages Shopify's robust product/variant system
6. **Scalability**: Easy to add new products with same pattern

## Migration Checklist

- [ ] Test product access via `/app/test-product`
- [ ] Create product metafield definition
- [ ] Update database schema
- [ ] Migrate existing template data
- [ ] Remove ProductLayout code
- [ ] Update designer UI for product selection
- [ ] Implement color generation service
- [ ] Add variant generation UI
- [ ] Update template management page
- [ ] Test full workflow end-to-end
- [ ] Document new workflow for team

## Notes

- Keep ProductLayout table during transition for data backup
- Consider adding "template version" tracking for regeneration history
- Plan for handling edge cases (missing colors, partial variants, etc.)
- Ensure proper error handling for Shopify API rate limits
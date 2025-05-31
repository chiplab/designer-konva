# Preview Image Sync Implementation Plan

## Overview
Replace standard Shopify product images with customizable template previews that load instantly via Shopify's CDN, then progressively enhance to become interactive.

## Architecture

### Phase 1: Preview Generation (Current)
1. **Template Assignment**: When assigning a template to a product variant
2. **Preview Generation**: Create a static preview image with placeholder text
3. **Image Upload**: Upload to Shopify as the variant's primary image
4. **CDN Distribution**: Shopify handles responsive sizing, WebP conversion, etc.

### Phase 2: Progressive Enhancement
1. **Page Load**: Product page shows the preview image instantly (via Shopify)
2. **JavaScript Load**: Our scripts load asynchronously
3. **Interactive Layer**: Add customization UI on top of the static image
4. **Seamless Transition**: Replace static image with interactive canvas

## Implementation Steps

### 1. Server-Side Preview Generation ✅
- [x] Create `api.template.preview.tsx` endpoint
- [x] Create `preview-generator.server.ts` service
- [ ] Implement full Konva server-side rendering
- [ ] Generate preview with placeholder text

### 2. Shopify Integration ✅
- [x] Add "Sync preview images" action to templates page
- [ ] Upload generated images to Shopify
- [ ] Set as variant featured image
- [ ] Store original image reference in metafields

### 3. Theme Integration ✅
- [x] Create `product_preview.liquid` block
- [ ] Detect template-enabled products
- [ ] Load interactive layer progressively
- [ ] Handle variant switching

### 4. Performance Optimization
- [ ] Lazy load Konva only when needed
- [ ] Use Intersection Observer for below-fold products
- [ ] Implement service worker for offline support

## Benefits

1. **Instant Visual Feedback**: Customers immediately see customizable products
2. **SEO Optimized**: Search engines index the preview images
3. **Perfect Performance**: Leverages Shopify's image infrastructure
4. **Universal Compatibility**: Works with any theme
5. **Graceful Degradation**: Functions even without JavaScript

## Next Steps

1. Complete server-side Konva rendering
2. Implement Shopify image upload
3. Test with various themes
4. Add analytics tracking
5. Create merchant documentation

## Technical Considerations

- **Image Format**: PNG for transparency support
- **Resolution**: 2x for retina displays (2000x2000 max)
- **File Size**: Optimize to < 500KB
- **Placeholder Text**: "Your Text Here" in subtle gray
- **Visual Indicators**: Small "Customizable" badge

## Migration Strategy

For existing products:
1. Bulk action to generate all previews
2. Background job to process
3. Progress tracking in admin
4. Rollback capability
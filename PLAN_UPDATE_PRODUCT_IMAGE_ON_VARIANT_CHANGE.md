# Plan: Update Product Image on Variant Change

## Feature Overview

### Goal
Automatically update the main product image with customizations when users switch between color variants (e.g., Green to Purple), ensuring the product display always reflects the current customizations.

### Context
- Users can customize products with text via the ProductCustomizerModal
- Customizations are saved in localStorage as `customization_global_text`
- When switching variants, the product image should show the new variant with applied customizations
- We have three reliable detection methods from the swatch protection system

## Technical Architecture

### Detection Methods to Leverage
1. **URL Monitoring** (Primary)
   - Polls every 100ms for `?variant=` parameter changes
   - Most reliable method across all themes
   
2. **Click Event Capture** (Secondary)
   - Listens for clicks on color radio inputs
   - Provides immediate feedback
   
3. **MutationObserver** (Tertiary)
   - Watches variant picker elements for DOM changes
   - Handles theme-specific DOM morphing

### Integration Points

```javascript
// Existing swatch protection handleVariantChange
const handleVariantChange = function(event) {
  // ... existing swatch protection logic ...
  
  // NEW: Check for customizations and update product image
  updateProductImageIfCustomized(variantId);
}
```

## Implementation Details

### 1. Global Modal Registry

Create a registry to track active ProductCustomizerModal instances:

```javascript
// Add to ProductCustomizerModal class
class ProductCustomizerModal {
  static activeInstance = null;
  
  constructor(options) {
    // ... existing code ...
    ProductCustomizerModal.activeInstance = this;
  }
  
  close() {
    // ... existing code ...
    if (ProductCustomizerModal.activeInstance === this) {
      ProductCustomizerModal.activeInstance = null;
    }
  }
}
```

### 2. Enhanced Variant Change Handler

Add product image update logic to the global swatch protection system:

```javascript
// In the global IIFE after handleVariantChange
const updateProductImageIfCustomized = (variantId) => {
  // Check if we have saved customizations
  const savedTextState = localStorage.getItem('customization_global_text');
  if (!savedTextState) return;
  
  // Check if we have an active modal instance
  const modal = window.ProductCustomizerModal?.activeInstance;
  if (!modal) return;
  
  // Debounce to prevent rapid updates
  clearTimeout(window.productImageUpdateTimer);
  window.productImageUpdateTimer = setTimeout(() => {
    modal.updateProductImageForVariant(variantId);
  }, 200);
};
```

### 3. New Modal Method: updateProductImageForVariant

```javascript
async updateProductImageForVariant(variantId) {
  console.log('[ProductCustomizer] Updating product image for variant:', variantId);
  
  // Get the template for this variant
  const templateId = this.getTemplateIdForVariant(variantId);
  if (!templateId) return;
  
  // Create a temporary renderer to generate preview
  const tempRenderer = new CanvasTextRenderer();
  await tempRenderer.loadTemplate(templateId);
  
  // Apply saved text customizations
  const savedTextState = this.loadGlobalTextState();
  if (savedTextState) {
    tempRenderer.applyTextUpdates(savedTextState);
  }
  
  // Generate preview
  const preview = await tempRenderer.generatePreview();
  
  // Update main product image
  if (preview) {
    this.updateMainProductImage(preview);
  }
  
  // Cleanup
  tempRenderer.destroy();
}
```

### 4. Helper Method: getTemplateIdForVariant

```javascript
getTemplateIdForVariant(variantId) {
  // Try multiple methods to find template ID
  
  // Method 1: Check current window.productData
  if (window.productData?.variants) {
    const variant = window.productData.variants.find(v => v.id == variantId);
    if (variant?.metafields?.custom_designer?.template_id) {
      return variant.metafields.custom_designer.template_id;
    }
  }
  
  // Method 2: Query DOM for variant input
  const variantInput = document.querySelector(`input[data-variant-id="${variantId}"]`);
  if (variantInput?.dataset.templateId) {
    return variantInput.dataset.templateId;
  }
  
  // Method 3: Make API call if needed
  // ... implement if other methods fail ...
  
  return null;
}
```

## Performance Considerations

### Caching Strategy
```javascript
// Cache generated previews to avoid regeneration
class PreviewCache {
  static cache = new Map();
  static maxSize = 10;
  
  static set(variantId, preview) {
    // LRU cache implementation
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(variantId, preview);
  }
  
  static get(variantId) {
    const preview = this.cache.get(variantId);
    if (preview) {
      // Move to end (most recently used)
      this.cache.delete(variantId);
      this.cache.set(variantId, preview);
    }
    return preview;
  }
}
```

### Debouncing
- Variant change events: 200ms debounce
- Preview generation: Use requestAnimationFrame
- Cache previews to avoid regeneration

## Edge Cases and Handling

### 1. Dual-Sided Templates
```javascript
// Handle front/back preview for dual-sided templates
if (this.isDualSided) {
  // Generate front preview
  const frontPreview = await this.generateVariantPreview('front');
  this.updateMainProductImage(frontPreview);
  
  // Optionally update back preview if visible
  if (this.isShowingBack) {
    const backPreview = await this.generateVariantPreview('back');
    this.updateMainProductImage(backPreview, true);
  }
}
```

### 2. No Customizations
- Check for saved state before attempting updates
- Restore original product images if customizations are cleared

### 3. Modal Not Yet Opened
- Only update if modal has been opened at least once
- Track initialization state

### 4. Rapid Variant Switching
- Implement debouncing (200ms)
- Cancel pending preview generations
- Use preview cache

## Testing Scenarios

### Basic Flow
1. Open product page with customizable variants
2. Click "Customize this design"
3. Add text customizations
4. Close modal
5. Switch from Green to Purple variant
6. **Expected**: Main product image updates to show Purple variant with text

### Edge Case Testing

#### Test 1: Rapid Switching
1. Add customizations
2. Rapidly switch between 3+ color variants
3. **Expected**: Final variant shows correct preview, no flashing

#### Test 2: Dual-Sided Template
1. Customize both front and back of a dual-sided product
2. Close modal
3. Switch variants
4. **Expected**: Front image updates with customizations

#### Test 3: Clear Customizations
1. Add customizations
2. Clear all text (empty inputs)
3. Save and close
4. Switch variants
5. **Expected**: Original product images restored

#### Test 4: Multiple Products
1. Customize Product A
2. Navigate to Product B
3. Customize Product B
4. Switch variants on Product B
5. **Expected**: Only Product B images update

### Performance Testing
- Monitor console for excessive API calls
- Check preview generation time
- Verify cache is working (subsequent switches should be faster)
- Ensure no memory leaks with repeated switching

## Implementation Steps

1. **Create feature branch**: `feat/update-product-image-on-variant-change`

2. **Modify product-customizer-modal.js**:
   - Add static activeInstance property
   - Implement updateProductImageForVariant method
   - Add preview caching
   - Enhance global swatch protection system

3. **Test thoroughly**:
   - All test scenarios above
   - Cross-browser testing
   - Mobile responsiveness

4. **Optimize**:
   - Implement preview cache
   - Add performance logging
   - Fine-tune debounce timings

5. **Document**:
   - Update CLAUDE.md with new feature
   - Add inline code comments
   - Create user-facing documentation if needed

## Success Criteria

- ✅ Product images update automatically on variant change when customizations exist
- ✅ Updates are smooth and debounced (no flashing)
- ✅ Works with all three detection methods
- ✅ Handles dual-sided templates correctly
- ✅ Performance is acceptable (< 500ms update time)
- ✅ No memory leaks or excessive API calls
- ✅ Graceful handling of edge cases

## Future Enhancements

1. **Batch Preview Generation**: Pre-generate previews for all variants when customizing
2. **Smart Caching**: Persist preview cache in localStorage
3. **Progressive Loading**: Show low-res preview immediately, update with high-res
4. **Animation**: Smooth transition between variant images
5. **Multi-Image Support**: Update all product images (gallery, thumbnails)
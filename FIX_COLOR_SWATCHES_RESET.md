# Fix Color Swatches Resetting on Variant Change

## Problem Description

When a user:
1. Opens "Customize this Product"
2. Changes text to "CAT" (front) and "DOG" (back)
3. Clicks "Done"
4. Changes variant from Green to Purple

**Issue**: The color swatches reset to default "FRONT" and "BACK" text instead of maintaining "CAT" and "DOG".

## Root Cause Analysis

1. **Swatch Generation**: When text is customized, `generateServerSideSwatches()` creates new swatch previews with the custom text
2. **Missing Persistence**: These generated swatches are applied to the DOM but NOT saved to localStorage
3. **Variant Change Flow**:
   - `restoreOriginalVariantSwatches()` clears existing swatches
   - System looks for saved swatches in localStorage with key `variant_previews_${edgePattern}`
   - No saved swatches found, so defaults are restored

## Solution

### 1. Save Generated Swatches to localStorage

In `product-customizer-modal.js`, modify the `generateServerSideSwatches()` method around line 1405:

```javascript
// After successfully updating swatches (around line 1406)
if (result.success && result.swatches) {
  // ... existing code to update DOM ...
  
  // NEW: Save swatches to localStorage
  const currentVariantTitle = this.getVariantTitle();
  if (currentVariantTitle) {
    const parts = currentVariantTitle.split(' / ');
    const edgePattern = parts.length > 1 ? parts[1].trim() : null;
    
    if (edgePattern) {
      // Create preview data structure
      const previewData = {
        previews: {},
        timestamp: Date.now()
      };
      
      // Map color names to preview URLs
      Object.entries(result.swatches).forEach(([variantId, dataUrl]) => {
        const input = document.querySelector(`input[data-variant-id="${variantId}"]`);
        if (input && input.value) {
          const color = input.value;
          previewData.previews[color] = dataUrl;
        }
      });
      
      // Save to localStorage
      const variantPreviewsKey = `variant_previews_${edgePattern}`;
      localStorage.setItem(variantPreviewsKey, JSON.stringify(previewData));
      console.log(`[ProductCustomizer] Saved ${Object.keys(previewData.previews).length} swatch previews for pattern: ${edgePattern}`);
    }
  }
}
```

### 2. Ensure Swatches are Generated and Saved on Close

The swatches should be saved when:
- Text is changed and auto-saved
- Modal is closed with "Done"
- Before variant changes

## Implementation Steps

1. **Update `generateServerSideSwatches()`**:
   - Add localStorage save logic after successful generation
   - Extract edge pattern from variant title
   - Create preview data with color-to-URL mapping
   - Save with pattern-based key

2. **Verify `restoreVariantSwatchesOnLoad()` works correctly**:
   - It already looks for `variant_previews_${edgePattern}` key
   - It applies saved previews to matching color swatches
   - No changes needed here

3. **Test Flow**:
   - Customize text to "CAT" and "DOG"
   - Verify swatches update with custom text
   - Close modal
   - Change variant
   - Verify swatches maintain "CAT" and "DOG" text

## Expected Behavior

After implementation:
- Color swatches will persist customized text across variant changes
- Each pattern (e.g., "8 Spot", "Solid") will have its own set of saved swatches
- Swatches will expire after 30 days (existing logic)
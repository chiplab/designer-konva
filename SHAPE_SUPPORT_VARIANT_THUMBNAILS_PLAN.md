# Plan: Complete Shape Support for All Variant Thumbnail Generation

## Problem Analysis
There are three different systems for generating variant thumbnails/swatches, and shape support is inconsistent:

1. **Client-side variant preview** (`generateVariantPreviewWithCanvasState`) - ✅ Has shape support
2. **Server-side thumbnail generation** (`template-thumbnail-generator.server.ts`) - ⚠️ Has shape support but with inconsistent property naming
3. **Server-side swatch generation** (`variant-swatch-generator.server.ts`) - ❌ Missing shape support entirely

## Issues to Fix

### 1. Fix Property Naming Inconsistency in `template-thumbnail-generator.server.ts`
- Line 271: Change `elementType: 'shape'` to `type: 'shape'`
- Line 412: Change `} else if (element.elementType === 'shape') {` to `} else if (element.type === 'shape') {`

This ensures consistency with how shapes are stored in the database and accessed in client-side code.

### 2. Add Shape Support to `variant-swatch-generator.server.ts`
After line 488 (after the imageElements section), add shape rendering code:

```javascript
// Shape elements
if (state.elements.shapeElements) {
  state.elements.shapeElements.forEach((element: any) => {
    const commonProps = {
      x: (element.x + (element.width || 0) / 2) * scale, // Center-based positioning
      y: (element.y + (element.height || 0) / 2) * scale,
      fill: element.fill || '#ffffff',
      stroke: element.stroke || '#000000',
      strokeWidth: element.stroke ? ((element.strokeWidth || 2) * scale) : 0,
      rotation: element.rotation || 0,
      scaleX: element.scaleX || 1,
      scaleY: element.scaleY || 1,
    };
    
    if (element.type === 'rect') {
      const rect = new Konva.Rect({
        ...commonProps,
        width: element.width * scale,
        height: element.height * scale,
        offsetX: (element.width * scale) / 2,
        offsetY: (element.height * scale) / 2,
      });
      contentGroup.add(rect);
    } else if (element.type === 'ellipse') {
      const ellipse = new Konva.Ellipse({
        ...commonProps,
        radiusX: (element.width * scale) / 2,
        radiusY: (element.height * scale) / 2,
      });
      contentGroup.add(ellipse);
    } else if (element.type === 'ring') {
      const ring = new Konva.Ring({
        ...commonProps,
        innerRadius: (element.innerRadius || 25) * scale,
        outerRadius: (element.outerRadius || 50) * scale,
      });
      contentGroup.add(ring);
    }
  });
}
```

## Testing Steps
1. Create a template with shapes (rectangle, ellipse, ring)
2. Generate color variants
3. Process pending thumbnails (tests server-side thumbnail generation)
4. Visit a product page:
   - Click "Customize" button (tests server-side swatch generation via `generateServerSideSwatches`)
   - Switch between variants (tests client-side preview generation)
5. Verify shapes appear correctly in all three scenarios

## Summary
This plan will ensure shapes work consistently across all three variant thumbnail/swatch generation systems by:
1. Fixing the property naming mismatch in server-side thumbnail generation
2. Adding missing shape support to server-side swatch generation
3. Maintaining the already-working client-side preview generation
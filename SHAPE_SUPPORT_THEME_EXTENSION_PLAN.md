# Plan: Add Shape Support to Product Customizer Modal

## Overview
Add full shape rendering support (rectangle, ellipse, ring) to the vanilla JS Konva implementation in `product-customizer-modal.js` and `canvas-text-renderer.js`, matching the features from `DesignerCanvas.tsx`.

## Implementation Steps

### 1. Update CanvasTextRenderer Class (canvas-text-renderer.js)
- Add shape rendering support in the `render()` method after line 506
- Handle shape elements from template data:
  - Rectangle shapes with fill, stroke, rotation, and scale
  - Ellipse shapes with radiusX/radiusY based on width/height
  - Ring shapes with inner/outer radius
- Ensure shapes respect z-index ordering alongside other elements

### 2. Extend Template Loading (canvas-text-renderer.js)
- Update `loadTemplate()` and `loadDesign()` to handle `shapeElements` arrays
- No font loading needed for shapes, but ensure proper element structure

### 3. Add Shape Support to getCanvasState (canvas-text-renderer.js)
- Include `shapeElements` in the state returned by `getCanvasState()` method
- Ensure shape properties are preserved (type, dimensions, colors, transforms)

### 4. Enhance Dual-Sided Support (canvas-text-renderer.js)
- Update `switchToFront()` and `switchToBack()` to handle shape elements
- Include shapes in `getDualSidedCanvasState()` for both front and back

### 5. Update Product Customizer Modal (product-customizer-modal.js)
- No UI changes needed - shapes are view-only in the modal
- Ensure preview generation includes shapes when updating variants
- Shape rendering will be handled automatically by the updated CanvasTextRenderer

## Shape Data Structure
Based on DesignerCanvas.tsx, shapes have this structure:
```javascript
{
  id: string,
  type: 'rect' | 'ellipse' | 'ring',
  x: number,
  y: number,
  width: number,
  height: number,
  innerRadius?: number, // For ring only
  outerRadius?: number, // For ring only
  fill?: string,
  stroke?: string,
  strokeWidth?: number,
  rotation?: number,
  scaleX?: number,
  scaleY?: number,
  zIndex?: number
}
```

## Key Features to Match
1. **Center-based positioning**: Shapes use x/y as top-left, but Konva uses center positioning
2. **Fill and stroke**: Support solid colors with optional stroke
3. **Transformations**: Rotation and scale properties
4. **Z-index ordering**: Shapes rendered in correct layer order with other elements
5. **Clipping**: Shapes respect the designable area clipping

## Testing Approach
1. Create templates with shapes in DesignerCanvas
2. Load templates in product customizer modal
3. Verify shapes render correctly
4. Test variant switching with shape-containing templates
5. Ensure preview generation includes shapes

This implementation will provide full feature parity for shapes between the React-based designer and the vanilla JS theme extension.
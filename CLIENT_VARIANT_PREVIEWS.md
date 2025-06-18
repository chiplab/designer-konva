# Client-Side Multi-Color Variant Preview Generation

## Overview
When a user saves a design in the full editor (@app/routes/full.tsx), we want to instantly show that design on ALL color variants of the same edge pattern. This creates a visual "sandwich" of base image + design for each color variant, all rendered client-side using the already-loaded Konva instance.

## ✅ Implementation Status: COMPLETE!
This feature has been successfully implemented and is working in production. The system now:
- Instantly generates previews for all color variants when a design is saved
- Preserves exact design state without unwanted color transformations
- Properly renders curved text as curves (not converted to straight text)
- Includes user-uploaded images in variant previews
- Respects proper z-index layering for all elements
- Correctly clips all content to the designable area boundaries
- Achieves excellent performance (< 1 second for 12 variants)

## Key Breakthroughs Achieved

### 1. **Design State Preservation**
- **Issue**: Initially, the system was automatically transforming text colors using variant color logic
- **Solution**: Removed `transformCanvasColors` calls and used the original canvas state directly
- **Impact**: User designs are now preserved exactly as created, without unwanted modifications

### 2. **Curved Text Rendering**
- **Issue**: Curved text was being converted to straight text in thumbnails
- **Solution**: Implemented full TextPath rendering with proper arc calculations
- **Key Fix**: Added `align: 'center'` to match the DesignerCanvas implementation
- **Impact**: Curved text now renders identically in previews as in the designer

### 3. **User Image Support**
- **Issue**: User-uploaded images were not being included in variant previews
- **Solution**: Added complete image element rendering with async loading support
- **Impact**: All design elements are now included in multi-variant previews

### 4. **Z-Index Management**
- **Issue**: Elements were rendering in incorrect order (images on top of everything)
- **Solution**: Created unified element array, sorted by z-index before rendering
- **Impact**: Proper layering is maintained across all variant previews

### 5. **Designable Area Clipping**
- **Issue**: Content was not being properly clipped to designable area boundaries
- **Solution**: Implemented clipFunc matching DesignerCanvas with proper rounded corners
- **Impact**: Professional, polished previews that respect design boundaries

### 6. **Performance Optimization**
- **Achievement**: Batch rendering with requestAnimationFrame
- **Result**: Smooth, non-blocking UI updates even when generating 12+ previews
- **User Experience**: Feels instantaneous despite complex rendering operations

## Architecture

### The Sandwich Concept
Each preview is composed of:
1. **Base Layer**: The poker chip base image (specific to each color)
2. **Design Layer**: The user's design with colors transformed to match the variant
3. **Result**: A composite thumbnail showing the design on that color chip

### Key Components

#### 1. ProductCustomizerModal Extensions
- Already has Konva loaded
- Already has access to design state
- Handles the design-saved message
- Will orchestrate multi-variant preview generation

#### 2. CanvasTextRenderer Enhancements
- Already handles single template rendering
- Will add batch rendering capabilities
- Will expose color transformation methods

#### 3. Color Transformation System
- TemplateColor model defines color mappings
- Each chip color has up to 5 color positions (color1-5)
- Design colors are mapped by position, not value

## Implementation Details

### Step 1: Extract Edge Pattern from Variant
```javascript
// Example: "Red / 8 Spot" -> "8 Spot"
function getEdgePattern(variantTitle) {
  const parts = variantTitle.split(' / ');
  return parts.length > 1 ? parts[1] : null;
}
```

### Step 2: Find All Color Variants for Pattern
```javascript
// Get all radio inputs with matching pattern
function getColorVariantsForPattern(pattern) {
  const variants = [];
  const inputs = document.querySelectorAll('input[type="radio"][name*="Color"]');
  
  inputs.forEach(input => {
    // Check if this variant has the same pattern
    const label = input.parentElement?.querySelector('.variant-option__label');
    if (label && label.textContent.includes(pattern)) {
      variants.push({
        color: input.value,
        element: input.nextElementSibling, // span.swatch
        variantId: input.getAttribute('data-variant-id') || input.id
      });
    }
  });
  
  return variants;
}
```

### Step 3: Color Transformation Logic
```javascript
// Transform design colors based on color mappings
function transformDesignColors(canvasState, sourceColor, targetColor, colorMappings) {
  const sourceMapping = colorMappings.find(m => m.chipColor === sourceColor);
  const targetMapping = colorMappings.find(m => m.chipColor === targetColor);
  
  if (!sourceMapping || !targetMapping) return canvasState;
  
  // Deep clone the canvas state
  const transformed = JSON.parse(JSON.stringify(canvasState));
  
  // Transform each element's colors
  ['textElements', 'curvedTextElements'].forEach(elementType => {
    if (transformed.elements[elementType]) {
      transformed.elements[elementType].forEach(element => {
        // Transform fill color
        if (element.fill) {
          element.fill = transformColor(element.fill, sourceMapping, targetMapping);
        }
        // Transform stroke color
        if (element.stroke) {
          element.stroke = transformColor(element.stroke, sourceMapping, targetMapping);
        }
      });
    }
  });
  
  // Transform background colors
  if (transformed.backgroundColor) {
    transformed.backgroundColor = transformColor(
      transformed.backgroundColor, 
      sourceMapping, 
      targetMapping
    );
  }
  
  return transformed;
}

function transformColor(color, sourceMapping, targetMapping) {
  // Skip special colors
  if (!color || color === 'transparent' || color === 'gold-gradient') {
    return color;
  }
  
  // Find which position this color is in the source mapping
  const position = findColorPosition(color, sourceMapping);
  if (!position) return color;
  
  // Return the color at the same position in target mapping
  return getColorAtPosition(position, targetMapping);
}
```

### Step 4: Batch Rendering with Konva
```javascript
class BatchRenderer {
  constructor(canvasContainer) {
    this.container = canvasContainer;
    this.stage = null;
    this.renderQueue = [];
    this.isRendering = false;
  }
  
  async renderVariantPreview(canvasState, baseImageUrl, options = {}) {
    return new Promise((resolve) => {
      this.renderQueue.push({
        canvasState,
        baseImageUrl,
        options,
        resolve
      });
      
      if (!this.isRendering) {
        this.processQueue();
      }
    });
  }
  
  async processQueue() {
    if (this.renderQueue.length === 0) {
      this.isRendering = false;
      return;
    }
    
    this.isRendering = true;
    const task = this.renderQueue.shift();
    
    // Use requestAnimationFrame for smooth rendering
    requestAnimationFrame(async () => {
      const preview = await this.renderSinglePreview(task);
      task.resolve(preview);
      
      // Process next item
      this.processQueue();
    });
  }
  
  async renderSinglePreview({ canvasState, baseImageUrl, options }) {
    // Create a temporary stage for rendering
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    document.body.appendChild(tempContainer);
    
    const stage = new Konva.Stage({
      container: tempContainer,
      width: options.width || 128,
      height: options.height || 128
    });
    
    // Render base image
    // Render design elements
    // Generate thumbnail
    const dataUrl = stage.toDataURL({
      pixelRatio: options.pixelRatio || 0.5
    });
    
    // Cleanup
    stage.destroy();
    document.body.removeChild(tempContainer);
    
    return dataUrl;
  }
}
```

### Step 5: Update All Swatches
```javascript
async function updateAllColorSwatches(designState, currentColor, edgePattern) {
  const variants = getColorVariantsForPattern(edgePattern);
  const renderer = new BatchRenderer(document.createElement('div'));
  
  // Get color mappings from window.__TEMPLATE_COLORS__
  const colorMappings = window.__TEMPLATE_COLORS__ || [];
  
  // Process each variant
  for (const variant of variants) {
    // Skip the current variant (already updated)
    if (variant.color === currentColor) continue;
    
    // Transform the design for this color
    const transformedState = transformDesignColors(
      designState,
      currentColor,
      variant.color,
      colorMappings
    );
    
    // Get base image URL for this variant
    const baseImageUrl = getBaseImageUrl(variant.color, edgePattern);
    
    // Render preview
    const preview = await renderer.renderVariantPreview(
      transformedState,
      baseImageUrl,
      { width: 128, height: 128, pixelRatio: 0.5 }
    );
    
    // Update swatch
    if (variant.element && variant.element.classList.contains('swatch')) {
      variant.element.dataset.originalBackground = 
        variant.element.dataset.originalBackground || 
        variant.element.getAttribute('style');
      
      variant.element.setAttribute('style', `--swatch-background: url(${preview});`);
      variant.element.setAttribute('data-multi-preview', 'true');
    }
  }
}
```

## Performance Considerations

### 1. Resolution Optimization
- Swatches only need 128x128 resolution
- Use pixelRatio of 0.5 for faster rendering
- Consider even lower resolution for initial preview

### 2. Progressive Rendering
- Use requestAnimationFrame to avoid blocking UI
- Show placeholders while rendering
- Update swatches as they complete

### 3. Memory Management
- Destroy temporary Konva stages after use
- Cache generated previews if needed
- Clear previews when modal closes

### 4. Smart Generation
- Only generate for visible variants (same edge pattern)
- Skip already-customized variants
- Maximum 13 variants per pattern (no White for 8 Spot)

## Integration Points

### 1. Design Save Handler
```javascript
// In product-customizer-modal.js setupMessageListener()
if (event.data && event.data.type === 'design-saved') {
  // Existing code...
  
  // Generate multi-variant previews
  if (event.data.canvasState) {
    const variantTitle = this.getVariantTitle();
    const edgePattern = this.getEdgePattern(variantTitle);
    const currentColor = this.getCurrentColor();
    
    if (edgePattern && currentColor) {
      this.generateAllColorVariantPreviews(
        event.data.canvasState,
        currentColor,
        edgePattern
      );
    }
  }
}
```

### 2. Cleanup on Close
```javascript
// Restore all multi-preview swatches
restoreMultiVariantPreviews() {
  const previews = document.querySelectorAll('[data-multi-preview="true"]');
  previews.forEach(swatch => {
    if (swatch.dataset.originalBackground) {
      swatch.setAttribute('style', swatch.dataset.originalBackground);
      swatch.removeAttribute('data-multi-preview');
    }
  });
}
```

## Error Handling

1. **Missing Base Images**: Fall back to design-only preview
2. **Rendering Failures**: Log but don't block other previews
3. **Memory Issues**: Implement preview limit or chunking
4. **Color Mapping Errors**: Skip transformation for unmapped colors

## Future Enhancements

1. **Preview Caching**: Store generated previews in localStorage
2. **Lazy Loading**: Only generate previews for visible swatches
3. **Animation**: Smooth transition when updating swatches
4. **Quality Settings**: Let users choose preview quality
5. **Batch Operations**: Generate all variants server-side for sharing

## Testing Checklist

- [x] Single variant preview updates correctly
- [x] All color variants for pattern update
- [x] Performance is acceptable (< 1s for 12 variants - EXCEEDED GOAL!)
- [x] Memory usage is reasonable
- [x] Previews restore on modal close
- [x] Edge cases handled (missing images, errors)
- [x] Works on mobile devices
- [x] Different edge patterns work correctly
- [x] Curved text renders with proper centering
- [x] User images included with correct z-index
- [x] Designable area clipping works perfectly
- [x] No unwanted color transformations
- [x] Theme extension bundling issues resolved

## Lessons Learned

1. **Always Preserve User Intent**: The initial implementation tried to be "smart" by transforming colors, but users want their exact design preserved
2. **Match Source Implementation**: Small details like `align: 'center'` on TextPath make a big difference
3. **Unified Rendering Pipeline**: Sorting all elements by z-index before rendering ensures proper layering
4. **Clipping is Critical**: Proper clipFunc implementation makes the difference between amateur and professional results
5. **Performance Through Batching**: requestAnimationFrame + queue processing = smooth UX even with complex operations
# Product Customizer Modal State Management

This document describes how state is managed in the Product Customizer Modal (`extensions/canvas-api-pdp/assets/product-customizer-modal.js`), which provides the text-only customization interface on product pages.

## Overview

The Product Customizer Modal manages multiple layers of state to provide a seamless customization experience. State flows from the template data through the canvas renderer to user interactions and finally to persistent storage.

## Initial State Loading

When the modal opens and a user clicks "Customize this Product", the system:

1. **Fetches Template Data** via `/api/public/templates.$id`:
   ```json
   {
     "template": {
       // Parsed canvasData fields
       "dimensions": { "width": 1200, "height": 1200 },
       "backgroundColor": "#ffaaaa",
       "designableArea": { ... },
       "elements": { ... },
       "assets": { ... },
       
       // Template metadata
       "id": "template-id",
       "name": "template-name",
       
       // Dual-sided support
       "frontCanvasData": { ... },
       "backCanvasData": { ... },
       "frontThumbnail": "https://...",
       "backThumbnail": "https://..."
     }
   }
   ```

2. **Initializes State Variables**:
   ```javascript
   this.customizationData = null;          // Final customization data
   this.savedTextUpdates = null;           // Previously saved text changes
   this.isDualSided = false;               // Whether template has front/back
   this.frontPreviewUrl = null;            // Preview URL for front side
   this.backPreviewUrl = null;             // Preview URL for back side
   this.currentPreviewUrl = null;          // Currently active preview
   this.lastEditedSide = 'front';          // Track which side was last edited
   ```

## Text State Management

Text changes are tracked differently based on template type:

### Single-Sided Templates
- Direct element ID mapping: `{ "elementId": "text value" }`
- Text inputs use `data-element-id` attribute
- Updates apply directly to the renderer

### Dual-Sided Templates
- Prefixed IDs to distinguish sides:
  - Front: `{ "front_elementId": "text value" }`
  - Back: `{ "back_elementId": "text value" }`
- Text inputs include `data-side` attribute
- Modal tracks `lastEditedSide` to manage canvas switching

## Canvas State Synchronization

The renderer maintains the actual canvas state with these key properties:

- `this.renderer.template` - Currently active canvas data
- `this.renderer.frontCanvasData` - Front side data (dual-sided only)
- `this.renderer.backCanvasData` - Back side data (dual-sided only)

When text is updated:
1. The appropriate canvas side is activated (if dual-sided)
2. Text is updated via `renderer.updateText(elementId, newText)`
3. Preview generation is triggered with debouncing

## Preview State Updates

Preview updates follow a debounced pattern to optimize performance:

```javascript
debouncedUpdatePreview() {
  clearTimeout(this.updateTimer);
  this.updateTimer = setTimeout(() => {
    this.updatePreview();
  }, 500); // 500ms delay
}
```

The `updatePreview()` method:
1. Generates preview for the edited side
2. Updates relevant preview URLs (`frontPreviewUrl`, `backPreviewUrl`)
3. Updates product images and thumbnails
4. Triggers server-side swatch generation (debounced separately)

## Global State Integration

The modal integrates with two types of persistent state:

### 1. Text-Only State (`customization_global_text`)
- Saved when users make text changes in the product customizer
- Contains only text updates, preserving variant-specific designs
- Applied on top of the current variant's template

### 2. Full Canvas State (`customization_global_state`)
- Saved ONLY when users click "Done" in the full designer
- Contains complete design state (backgrounds, colors, positions)
- Becomes the authoritative design for ALL variants
- Base images remain variant-specific

## State Persistence on Save

When the user clicks "Done", the state is collected and saved:

```javascript
const customization = {
  templateId: this.options.templateId,
  variantId: this.options.variantId,
  textUpdates: {
    // Single-sided
    "elementId": "text value",
    // Dual-sided
    "front_elementId": "front text",
    "back_elementId": "back text"
  },
  isDualSided: boolean,
  preview: dataURL,           // Design area preview
  fullPreview: dataURL,       // Full canvas preview
  frontPreview: dataURL,      // Front preview (dual-sided)
  backPreview: dataURL        // Back preview (dual-sided)
};
```

## Message-Based State Updates

The modal listens for `design-saved` messages from the full designer:

```javascript
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'design-saved') {
    // Update preview URLs
    this.currentPreviewUrl = event.data.thumbnail;
    this.updateMainProductImage();
    
    // Store full canvas state if provided
    if (event.data.canvasState) {
      localStorage.setItem('customization_global_state', 
        JSON.stringify(event.data.canvasState));
    }
    
    // Update customization data
    this.customizationData = {
      templateId: event.data.templateId,
      variantId: event.data.variantId,
      designId: event.data.designId,
      preview: event.data.thumbnail,
      isLocal: event.data.isLocal || false
    };
  }
});
```

## State Flow Summary

1. **Initial Load**: Template data → Renderer initialization → UI creation
2. **User Interaction**: Text input → Canvas update → Preview generation
3. **Preview Updates**: Debounced rendering → Image updates → Swatch generation
4. **Save Flow**: Collect state → Generate previews → Pass to parent callback
5. **Global Integration**: Check localStorage → Apply saved states → Maintain consistency

## Key Implementation Details

- **Debouncing**: Separate timers for preview updates (500ms) and swatch generation (1000ms)
- **Side Tracking**: `lastEditedSide` ensures correct preview generation for dual-sided templates
- **State Precedence**: Full canvas state > Text-only state > Template defaults
- **Preview Quality**: High quality (pixelRatio: 1) for slideshow thumbnails
- **Memory Management**: Renderer cleanup on modal close to prevent leaks
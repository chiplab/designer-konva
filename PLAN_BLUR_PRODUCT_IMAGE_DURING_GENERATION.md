# Plan: Blur Product Image During Konva Generation

## Problem
When switching variants with customizations, users see the default (non-customized) product image for ~1 second while Konva generates the new preview.

## Solution: Blur/Fade Transition

### Implementation Steps

1. **Add CSS Transitions** to `product-customizer-modal.js`:
```css
.product-image-transitioning {
  transition: opacity 0.3s ease, filter 0.3s ease;
  opacity: 0.3;
  filter: blur(10px);
}
```

2. **Modify `updateProductImageForVariant`**:
```javascript
async updateProductImageForVariant(variantId) {
  // 1. Immediately blur the current image
  const mainImage = this.findMainProductImage();
  if (mainImage) {
    mainImage.classList.add('product-image-transitioning');
  }
  
  // 2. Check cache first (existing code)
  const cachedPreview = PreviewCache.get(variantId);
  if (cachedPreview) {
    // Smooth transition to cached image
    this.transitionToNewImage(mainImage, cachedPreview);
    return;
  }
  
  // 3. Generate preview (existing code)
  // ... konva generation ...
  
  // 4. Smooth transition when ready
  if (preview) {
    this.transitionToNewImage(mainImage, preview);
  }
}

transitionToNewImage(imageElement, newSrc) {
  if (!imageElement) return;
  
  // Preload the new image
  const tempImg = new Image();
  tempImg.onload = () => {
    imageElement.src = newSrc;
    // Remove blur after image loads
    setTimeout(() => {
      imageElement.classList.remove('product-image-transitioning');
    }, 50);
  };
  tempImg.src = newSrc;
}
```

3. **Optional Enhancement**: Show last customized preview
```javascript
// Store last preview regardless of variant
localStorage.setItem('last_customized_preview', preview);

// On variant change, show last preview immediately (blurred)
const lastPreview = localStorage.getItem('last_customized_preview');
if (lastPreview && mainImage) {
  mainImage.src = lastPreview;
  mainImage.classList.add('product-image-transitioning');
}
```

### Benefits
- Immediate visual feedback
- No jarring switch from customized → default → customized
- Smooth transitions
- Works with existing cache system

### Timeline
- CSS injection: Immediate on modal init
- Blur effect: < 50ms after variant change
- Total perceived delay: Reduced from 1s to ~300ms transition
# Layer Ordering Implementation Plan

## Overview
This document outlines the implementation plan for adding layer ordering (z-index) functionality to the Konva canvas designer. The goal is to allow users to change the stacking order of elements on the canvas.

## Current Architecture

### Element Storage
Elements are currently stored in separate state arrays:
- `textElements`: Regular text elements
- `gradientTextElements`: Text with gradient fill
- `curvedTextElements`: Text along curved paths  
- `imageElements`: Uploaded images

### Rendering Order
Elements are rendered in a fixed order within the canvas Group:
1. Background color (if set)
2. Images (bottom layer)
3. Text elements
4. Gradient text elements
5. Curved text elements (top layer)

## Proposed Solution

### 1. Unified Element Management

Create a single unified array to manage all elements with their layer order:

```typescript
interface UnifiedCanvasElement {
  id: string;
  type: 'text' | 'gradientText' | 'curvedText' | 'image';
  zIndex: number;
  // Element-specific data based on type
  data: TextElement | GradientTextElement | CurvedTextElement | ImageElement;
}

// Single state for all elements
const [canvasElements, setCanvasElements] = React.useState<UnifiedCanvasElement[]>([]);
```

### 2. Migration Strategy

To maintain backward compatibility:
1. Keep existing state arrays for now
2. Create a computed unified array that combines all elements
3. Sort by zIndex for rendering
4. Gradually migrate to single array in future

```typescript
// Computed unified array
const unifiedElements = React.useMemo(() => {
  const elements: UnifiedCanvasElement[] = [];
  
  // Add all element types with default zIndex based on current order
  imageElements.forEach((img, idx) => {
    elements.push({
      id: img.id,
      type: 'image',
      zIndex: idx,
      data: img
    });
  });
  
  textElements.forEach((text, idx) => {
    elements.push({
      id: text.id,
      type: 'text',
      zIndex: imageElements.length + idx,
      data: text
    });
  });
  
  // ... similar for other element types
  
  return elements.sort((a, b) => a.zIndex - b.zIndex);
}, [textElements, gradientTextElements, curvedTextElements, imageElements]);
```

### 3. Layer Control Functions

```typescript
const moveToFront = (elementId: string) => {
  const maxZIndex = Math.max(...unifiedElements.map(el => el.zIndex));
  updateElementZIndex(elementId, maxZIndex + 1);
};

const moveToBack = (elementId: string) => {
  // Shift all elements up and set selected to 0
  const elements = unifiedElements.map(el => ({
    ...el,
    zIndex: el.id === elementId ? 0 : el.zIndex + 1
  }));
  redistributeZIndexes(elements);
};

const moveUp = (elementId: string) => {
  const element = unifiedElements.find(el => el.id === elementId);
  if (!element) return;
  
  const nextHigher = unifiedElements
    .filter(el => el.zIndex > element.zIndex)
    .sort((a, b) => a.zIndex - b.zIndex)[0];
    
  if (nextHigher) {
    swapZIndexes(element.id, nextHigher.id);
  }
};

const moveDown = (elementId: string) => {
  const element = unifiedElements.find(el => el.id === elementId);
  if (!element) return;
  
  const nextLower = unifiedElements
    .filter(el => el.zIndex < element.zIndex)
    .sort((a, b) => b.zIndex - a.zIndex)[0];
    
  if (nextLower) {
    swapZIndexes(element.id, nextLower.id);
  }
};
```

### 4. UI Integration

Add layer controls to the fixed toolbar when an element is selected:

```jsx
{/* Layer Controls Group */}
{selectedId && (
  <>
    <div style={{ width: '1px', background: '#e0e0e0', height: '24px', margin: '0 4px' }} />
    
    <button
      onClick={() => moveDown(selectedId)}
      title="Move Down (Ctrl+[)"
      style={layerButtonStyle}
    >
      ⬇️
    </button>
    
    <button
      onClick={() => moveUp(selectedId)}
      title="Move Up (Ctrl+])"
      style={layerButtonStyle}
    >
      ⬆️
    </button>
    
    <button
      onClick={() => moveToBack(selectedId)}
      title="Send to Back"
      style={layerButtonStyle}
    >
      ⏬
    </button>
    
    <button
      onClick={() => moveToFront(selectedId)}
      title="Bring to Front"
      style={layerButtonStyle}
    >
      ⏫
    </button>
  </>
)}
```

### 5. Rendering Updates

Update the render method to use the unified sorted array:

```jsx
{unifiedElements.map((element) => {
  switch (element.type) {
    case 'image':
      return <ImageElement key={element.id} imageElement={element.data} ... />;
    case 'text':
      return <Text key={element.id} {...element.data} ... />;
    case 'curvedText':
      return <Group key={element.id} ...>
        <TextPath ... />
      </Group>;
    // ... etc
  }
})}
```

### 6. Save/Load Updates

Update the canvas state serialization to include z-index:

```typescript
interface CanvasState {
  // ... existing properties
  elements: {
    unified?: Array<{
      id: string;
      type: string;
      zIndex: number;
      data: any;
    }>;
    // Keep existing arrays for backward compatibility
    textElements: Array<...>;
    // ... etc
  };
}
```

### 7. Keyboard Shortcuts

Add keyboard event handlers:

```typescript
React.useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!selectedId) return;
    
    if (e.ctrlKey || e.metaKey) {
      if (e.key === ']') {
        e.preventDefault();
        moveUp(selectedId);
      } else if (e.key === '[') {
        e.preventDefault();
        moveDown(selectedId);
      }
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [selectedId]);
```

## Implementation Phases

### Phase 1: Basic Layer Ordering
1. Add zIndex tracking to existing elements
2. Implement basic move up/down functionality
3. Add UI controls to toolbar

### Phase 2: Full Integration  
1. Create unified element management
2. Update rendering to use sorted order
3. Add keyboard shortcuts

### Phase 3: Persistence
1. Update save/load to preserve layer order
2. Add migration for existing templates
3. Test thoroughly

## Technical Considerations

1. **Performance**: Use React.useMemo for sorting to avoid unnecessary re-renders
2. **State Management**: Maintain backward compatibility during migration
3. **User Experience**: Provide visual feedback when layer order changes
4. **Edge Cases**: Handle elements at top/bottom of stack appropriately

## Testing Plan

1. Test moving elements up/down in various configurations
2. Verify layer order persists after save/load
3. Test with overlapping elements to ensure visual correctness
4. Verify keyboard shortcuts work correctly
5. Test performance with many elements

## Future Enhancements

1. Layer panel showing all elements in order
2. Drag-and-drop reordering in layer panel
3. Lock/unlock layers
4. Show/hide layers
5. Group elements together
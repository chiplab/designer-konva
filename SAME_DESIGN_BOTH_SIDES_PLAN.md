# Same Design on Both Sides Feature Plan

## Overview
This feature adds a toggle switch to the DesignerCanvas component that allows users to apply the same design to both front and back sides of a product. This is particularly useful for products like poker chips where both sides typically have identical designs.

## User Story
As a user designing poker chips or similar two-sided products, I want to be able to design once and have it automatically apply to both sides, so I don't have to manually duplicate my work.

## Technical Implementation

### 1. State Management
**Location**: `app/components/DesignerCanvas.tsx` (around line 169)

Add new state variable:
```typescript
const [sameDesignBothSides, setSameDesignBothSides] = React.useState(false);
```

### 2. UI Modifications

#### Toggle Switch UI
**Location**: In the sides switcher section (around line 2598)

Add after the Front/Back button group:
```typescript
{/* Same Design Toggle - Only show if template has dual sides */}
{((initialTemplate?.frontCanvasData && initialTemplate?.backCanvasData) || layoutVariant?.backBaseImageUrl) && (
  <div style={{ display: 'inline-flex', alignItems: 'center', marginLeft: '20px' }}>
    <label style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '8px',
      fontSize: '14px',
      color: '#333',
      cursor: 'pointer'
    }}>
      <input
        type="checkbox"
        checked={sameDesignBothSides}
        onChange={(e) => setSameDesignBothSides(e.target.checked)}
        style={{ cursor: 'pointer' }}
      />
      Same artwork on both sides?
    </label>
  </div>
)}
```

#### Back Button Visibility
Modify the Back button to be disabled when toggle is on:
```typescript
<button
  onClick={() => !sameDesignBothSides && setCurrentSide('back')}
  disabled={sameDesignBothSides}
  style={{
    // ... existing styles
    opacity: sameDesignBothSides ? 0.5 : 1,
    cursor: sameDesignBothSides ? 'not-allowed' : 'pointer',
  }}
>
  Back
</button>
```

### 3. State Synchronization

#### Add useEffect for Toggle Changes
```typescript
// Sync front to back when enabling same design mode
React.useEffect(() => {
  if (sameDesignBothSides) {
    // Copy all front elements to back
    setBackTextElements([...frontTextElements]);
    setBackGradientTextElements([...frontGradientTextElements]);
    setBackCurvedTextElements([...frontCurvedTextElements]);
    setBackImageElements([...frontImageElements]);
    setBackShapeElements([...frontShapeElements]);
    setBackBackgroundColor(frontBackgroundColor);
    
    // Force current side to front
    setCurrentSide('front');
    
    // Show notification
    setNotification({
      message: 'Front design copied to back side',
      type: 'success'
    });
    setTimeout(() => setNotification(null), 3000);
  }
}, [sameDesignBothSides]);
```

#### Add useEffect for Front Changes
When `sameDesignBothSides` is true, automatically sync front changes to back:
```typescript
// Auto-sync front to back when same design mode is on
React.useEffect(() => {
  if (sameDesignBothSides && currentSide === 'front') {
    setBackTextElements([...frontTextElements]);
    setBackGradientTextElements([...frontGradientTextElements]);
    setBackCurvedTextElements([...frontCurvedTextElements]);
    setBackImageElements([...frontImageElements]);
    setBackShapeElements([...frontShapeElements]);
    setBackBackgroundColor(frontBackgroundColor);
  }
}, [
  sameDesignBothSides,
  frontTextElements,
  frontGradientTextElements,
  frontCurvedTextElements,
  frontImageElements,
  frontShapeElements,
  frontBackgroundColor
]);
```

### 4. Canvas State Serialization

#### Modify getCanvasState Function
**Location**: Around line 1202

Update the function to handle same design mode:
```typescript
const getCanvasState = () => {
  // ... existing helper functions ...
  
  // Create front state as usual
  const frontState = {
    dimensions,
    backgroundColor: frontBackgroundColor,
    backgroundGradient: getBackgroundGradient(frontBackgroundColor),
    designableArea,
    elements: {
      textElements: ensureZIndex(frontTextElements),
      curvedTextElements: ensureZIndex(frontCurvedTextElements),
      gradientTextElements: ensureZIndex(frontGradientTextElements),
      imageElements: ensureZIndex(frontImageElements),
      shapeElements: ensureZIndex(frontShapeElements)
    },
    assets: {
      baseImage: frontBaseImageUrl,
    }
  };
  
  // For back state, use front elements if same design mode is on
  const backState = sameDesignBothSides ? {
    dimensions,
    backgroundColor: frontBackgroundColor,
    backgroundGradient: getBackgroundGradient(frontBackgroundColor),
    designableArea,
    elements: {
      textElements: ensureZIndex(frontTextElements),
      curvedTextElements: ensureZIndex(frontCurvedTextElements),
      gradientTextElements: ensureZIndex(frontGradientTextElements),
      imageElements: ensureZIndex(frontImageElements),
      shapeElements: ensureZIndex(frontShapeElements)
    },
    assets: {
      baseImage: backBaseImageUrl, // Keep separate base image
    }
  } : {
    // ... existing back state logic ...
  };
  
  // Return dual-sided format
  return {
    front: frontState,
    back: backState,
    sameDesignBothSides, // Include toggle state in saved data
    // ... legacy format ...
  };
};
```

### 5. Load Canvas State

#### Update loadCanvasState Function
**Location**: Around line 1293

Add support for loading the toggle state:
```typescript
const loadCanvasState = async (state: any) => {
  if (!state) return;
  
  // Load toggle state if present
  if (state.sameDesignBothSides !== undefined) {
    setSameDesignBothSides(state.sameDesignBothSides);
  }
  
  // ... rest of existing load logic ...
};
```

## Visual Design

### Toggle Switch Styling
- Position: Inline with sides switcher, 20px left margin
- Style: Native checkbox with label
- Font: 14px, matching existing controls
- Color: #333 text to match other labels
- Disabled state: Back button opacity 0.5 when toggle is on

### User Feedback
- Success notification when design is copied to back
- Back button visually disabled when toggle is on
- Clear label text explaining the feature

## Testing Considerations

1. **Toggle On**:
   - Back button should be disabled
   - All changes to front should auto-sync to back
   - Saving should preserve both sides with same design

2. **Toggle Off**:
   - Back button should be enabled
   - Front and back can be edited independently
   - Previous back design should be preserved

3. **Edge Cases**:
   - Loading templates with toggle state
   - Switching between products with/without dual sides
   - Undo/redo functionality with toggle enabled

## Benefits

1. **Efficiency**: Design once, apply to both sides automatically
2. **Consistency**: Ensures perfect matching between sides
3. **Flexibility**: Can be toggled off for independent side design
4. **User-Friendly**: Simple checkbox interface
5. **Non-Destructive**: Turning off toggle preserves both designs

## Future Enhancements

1. Add option to copy back to front (reverse sync)
2. Add "Copy to other side" button for one-time copy
3. Remember toggle preference per product type
4. Add visual indicator showing sides are synced
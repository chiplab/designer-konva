# Modal Image Preview Update

## Overview
Replaced the live Konva canvas in the product customizer modal with a static image preview that updates when users change text. This approach mirrors how tools like Zazzle work and can provide better performance, especially on mobile devices.

## Implementation Details

### What Changed
1. **Hidden Konva Stage**: The actual Konva canvas is now hidden (`display: none`)
2. **Image Preview**: Added an `<img>` element that displays the rendered canvas
3. **Debounced Updates**: Text changes trigger image regeneration with a 500ms delay
4. **Loading State**: Shows subtle opacity change during updates

### How It Works
```javascript
// When text changes:
1. Update the Konva stage (hidden)
2. Start 500ms debounce timer
3. Show loading state (opacity 0.3)
4. Generate new image using stage.toDataURL()
5. Update image src
6. Hide loading state
```

### Benefits
- **Better Performance**: No continuous canvas rendering
- **Simpler DOM**: Just an image element to display
- **Mobile Friendly**: Images perform better than canvases on mobile
- **Familiar UX**: Users are accustomed to this pattern from other customization tools

### Configuration
- **Update Delay**: 500ms (can be adjusted in `debouncedUpdatePreview`)
- **Resolution**: 50% for faster updates and smaller file sizes
- **Loading Indicator**: Subtle opacity change to show updates

### User Experience
1. User types in text field
2. After 500ms pause in typing, preview updates
3. Smooth transition with loading state
4. Final result identical to full designer

This approach provides a good balance between responsiveness and performance, especially important for mobile shoppers.
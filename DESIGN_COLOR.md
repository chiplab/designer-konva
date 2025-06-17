# Design Color Feature

## Overview
The Design Color feature allows customers to change the color theme of a design independently from the physical chip color. This enables previewing designs in different color schemes without changing the actual product variant.

## Concept
- **Chip Color**: The physical color of the poker chip product (e.g., Red chip, Blue chip)
- **Design Color**: The color theme applied to the design elements (text, graphics, backgrounds)
- A customer can order a "Red chip" with a "Blue design" theme

## Architecture

### Color Mapping System
Each color in the system has 5 color positions defined in the TemplateColor table:
- `color1`: Primary color (main design color)
- `color2`: Secondary color (lighter shade)
- `color3`: Tertiary color (darker shade)
- `color4`: Optional accent color
- `color5`: Optional additional color

### Available Design Colors (13 total)
- White, Red, Blue, Green, Black, Purple, Yellow, Grey, Orange, Ivory, Light Blue, Pink, Brown

### Color Transformation
When a Design Color is selected:
1. All elements using the current color1 are replaced with the new color1
2. All elements using the current color2 are replaced with the new color2
3. This continues for all 5 color positions
4. Gradients transform all their color stops accordingly

### Affected Elements
Design Color changes apply to:
- Text fill colors
- Text stroke colors
- Curved text fill colors
- Curved text stroke colors
- Background colors (solid)
- Background gradients (linear and radial)

### NOT Affected
- Gold gradient (remains unchanged)
- Base chip image
- Uploaded images

## Implementation Details

### Initial State
- Templates have a `colorVariant` field indicating their generated color
- This becomes the initial Design Color selection
- Example: "Blue / 8 Spot" template shows "Blue" as the selected Design Color

### Data Storage
- Transformed colors are saved directly in the `canvasState`
- No need to store original colors separately
- CustomerDesign contains the final transformed state

### User Flow
1. User opens designer with a template (e.g., Red variant)
2. Design Color dropdown shows "Red" selected
3. User changes to "Blue"
4. All red colors transform to corresponding blue colors
5. User clicks "Done"
6. Design saves with blue colors in canvasState

### Client-Side Transformation
The transformation happens in real-time on the client:
```javascript
// Example: Transform from Red to Blue
const redColors = { color1: '#c8102e', color2: '#ffaaaa', ... };
const blueColors = { color1: '#0057b8', color2: '#7fa8db', ... };

// For each element, replace colors by position
if (element.fill === redColors.color1) {
  element.fill = blueColors.color1;
}
```

## Technical Considerations

### Performance
- Color transformation is applied client-side for instant feedback
- No server round-trips needed for preview
- Transformation logic reuses existing color mapping system

### Future Enhancements
- Track original template color for reference
- Allow custom color selection beyond the 13 presets
- Apply Design Color to SVG elements
- Batch apply Design Color to multiple designs

## Integration Points

### Full Designer (full.tsx)
- Loads TemplateColor mappings
- Provides Design Color dropdown in header
- Applies transformations before saving

### Product Page
- Shows selected Design Color in customization preview
- Maintains Design Color through the customization flow
- Could show "Chip: Red / Design: Blue" for clarity

### Cart
- Design Color is baked into the saved design
- No additional cart properties needed
- Preview shows final design with applied colors
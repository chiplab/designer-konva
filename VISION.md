# Product Designer Architecture Vision

## Overview
Building a Shopify product customization system similar to Zazzle, where customers can design products (starting with poker chips) and seamlessly purchase them. The system integrates a Konva-based designer tool with Shopify's native product/variant structure.

## Core Models & Architecture

### Layout Model
Defines the physical product specifications and designable areas:
```javascript
Layout: {
  id: "poker_chip_base",
  name: "Standard Poker Chip",
  physical_dimensions: { width: 39, height: 39, unit: "mm" },
  design_area: { x: 5, y: 5, width: 29, height: 29 },
  print_bleed: { top: 2, right: 2, bottom: 2, left: 2 },
  safe_area: { x: 7, y: 7, width: 25, height: 25 },
  base_images: {
    "black_8spot": "s3://layouts/poker-chip-black-8spot.png",
    "red_solid": "s3://layouts/poker-chip-red-solid.png",
    "blue_dots": "s3://layouts/poker-chip-blue-dots.png"
  }
}
```

### Template Model
Konva-specific design configuration tied to product variants:
```javascript
Template: {
  id: "template_001",
  layout_id: "poker_chip_base", // References Layout
  name: "Wedding Poker Chip Template",
  canvas_config: { width: 400, height: 400 },
  design_elements: [
    {
      type: "text",
      content: "Your Text Here",
      position: { x: 50, y: 100 },
      constraints: { maxLength: 20, editable: true }
    },
    {
      type: "image",
      placeholder: "upload_area",
      position: { x: 150, y: 50 },
      constraints: { resizable: true, moveable: false }
    }
  ],
  layers: [...], // Konva layer structure
  constraints: {
    max_text_elements: 3,
    allowed_fonts: ["Arial", "Georgia", "Impact"],
    color_restrictions: []
  }
}
```

### Design Model (User Saves)
Customer's personalized version of a template:
```javascript
Design: {
  id: "design_123",
  user_id: "customer_456",
  template_id: "template_001",
  name: "My Wedding Chip Design",
  modified_elements: {
    // Only store what changed from template
    text_001: { content: "John & Jane 2025" },
    image_001: { src: "s3://user-uploads/wedding-photo.jpg" }
  },
  canvas_state: {...}, // Full Konva JSON if needed
  created_at: "2025-05-25T10:00:00Z",
  is_public: false
}
```

## Shopify Integration

### Product Structure
```javascript
// Shopify Product: "Custom Wedding Poker Chips"
// Variants: Black/8-Spot, Red/Solid, Blue/Dots, etc.

ProductVariant.metaobject = {
  template_id: "template_001",
  layout_id: "poker_chip_base"
}
```

## User Flow & Experience

### Customer Journey
1. **Discovery**: Customer finds "Custom Wedding Poker Chips" product page
2. **Variant Selection**: Chooses base style (Black/8-Spot, Red/Solid, etc.)
3. **Customize Button**: Launches Konva designer with appropriate template
4. **Design Process**: 
   - Anonymous editing (localStorage)
   - Real-time preview
   - Auto-save functionality
5. **Authentication**: Shopify passwordless login to save designs
6. **Purchase**: Seamless add-to-cart with customized product image

### Technical Flow
```
Product Page → Select Variant → Load Template → Konva Designer → 
LocalStorage Save → [Optional: Auth + Persistent Save] → 
Generate Image → Update Product → Add to Cart
```

## Technical Implementation

### Image Generation Pipeline
```javascript
// High-quality export for production
const dataURL = stage.toDataURL({
  mimeType: 'image/png',
  quality: 1,
  pixelRatio: 3 // Print quality
});

// Pipeline: Design Save → S3 Upload → Background Processing → 
// Generate Print Files → Update Shopify Product Image
```

### Infrastructure Stack
- **Frontend**: Remix app with Konva.js designer
- **Backend**: Node.js/Remix on AWS ECS Fargate
- **Database**: PostgreSQL for models
- **Storage**: AWS S3 for images and assets
- **Cache**: Redis for sessions and performance
- **CDN**: CloudFront for asset delivery

### Data Relationships
```
Layout (1) → (many) Templates
Template (1) → (many) Designs
Design → belongs_to User
Product Variant → references Template (via MetaObject)
```

## Current Phase: Konva Prototype

**Immediate Goal**: Build the core Konva designer functionality
- Canvas initialization with template loading
- Text/image element manipulation
- Layer management
- Export functionality
- LocalStorage state persistence

**Key Features to Prototype**:
- Drag & drop text/image elements
- Font/color/size controls
- Image upload and positioning
- Design constraints enforcement
- Real-time preview generation
- Export to high-quality image

## Font Management Strategy

### Font Selection for Small Circular Designs

Curated list of 20 fonts optimized for poker chips and similar small circular products:

#### System Fonts (Instant Loading)
- **Arial** - Clean, highly legible, excellent at small sizes
- **Helvetica** - Classic, professional, great contrast  
- **Verdana** - Designed for screen reading, wide letters
- **Tahoma** - Condensed but readable, saves space
- **Impact** - Bold, attention-grabbing for headings

#### Google Fonts - Sans-Serif (High Legibility)
- **Roboto** - Modern, friendly, excellent small-size rendering
- **Open Sans** - Optimized for legibility, neutral design
- **Lato** - Humanist, warm but professional
- **Montserrat** - Geometric, strong presence
- **Source Sans Pro** - Clean, technical, Adobe-designed

#### Google Fonts - Bold/Display (For Impact)
- **Oswald** - Condensed, strong vertical emphasis
- **Raleway** - Elegant, thin-to-bold range
- **Bebas Neue** - Ultra-condensed, great for short text
- **Anton** - Single weight, very bold, compact
- **Fjalla One** - Medium condensed, Scandinavian feel

#### Google Fonts - Serif (Elegant Options)
- **Playfair Display** - High contrast, elegant for formal designs
- **Merriweather** - Optimized for screens, readable serif
- **Crimson Text** - Classic book typography feel

#### Google Fonts - Script (Special Occasions)
- **Dancing Script** - Casual handwriting, wedding/celebration style
- **Pacifico** - Surf-style script, fun and relaxed

### Font Loading Strategy

#### Implementation Architecture
```javascript
const FontManager = {
  // Preload immediately for instant access
  priorityFonts: ['Arial', 'Impact', 'Roboto', 'Oswald', 'Bebas Neue'],
  
  // Organized by use case for UI
  categories: {
    'Clean & Modern': ['Arial', 'Roboto', 'Open Sans', 'Lato'],
    'Bold & Strong': ['Impact', 'Oswald', 'Anton', 'Bebas Neue'], 
    'Elegant': ['Playfair Display', 'Merriweather', 'Raleway'],
    'Fun & Casual': ['Dancing Script', 'Pacifico']
  },
  
  loadedFonts: new Set(),
  
  async loadFont(fontFamily) {
    if (this.loadedFonts.has(fontFamily)) return;
    
    // Google Fonts API integration
    const link = document.createElement('link');
    link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(' ', '+')}:wght@400;700&display=swap`;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    
    // Wait for font to actually load
    await document.fonts.load(`16px "${fontFamily}"`);
    this.loadedFonts.add(fontFamily);
  }
};
```

#### Progressive Loading Pattern
1. **Immediate**: System fonts available instantly
2. **Priority**: Load 5 most popular Google Fonts on app start
3. **On-Demand**: Load additional fonts when user selects category
4. **Lazy**: Load remaining fonts only when user hovers/clicks

#### Konva Integration
```javascript
// Template font constraints
Template: {
  constraints: {
    allowed_fonts: [
      'Arial', 'Impact', 'Roboto', 'Oswald', // Safe choices
      'Dancing Script' // Special occasion upgrade
    ],
    font_categories: ['Clean & Modern', 'Bold & Strong']
  }
}

// Font change handler
async function changeFont(textNode, fontFamily) {
  await FontManager.loadFont(fontFamily);
  textNode.fontFamily(fontFamily);
  layer.batchDraw();
}
```

### Design Considerations for Small Circular Products

**Why These Fonts Work:**
- **Size Performance**: All maintain legibility at 12-16px
- **Contrast Ready**: Work on both light and dark backgrounds  
- **Print Quality**: No thin strokes that disappear in production
- **Space Efficient**: Condensed options for longer text, wide options for emphasis
- **Character Clarity**: Strong differentiation between similar letters (O/0, I/l/1)

**Template Integration:**
- Different font sets per product type (elegant for weddings, bold for sports)
- Automatic fallbacks if font fails to load
- Font size recommendations based on design area constraints

---

*This vision document outlines the full system architecture. The current Claude Code session focuses on building the Konva designer prototype as the foundation for this larger system.*
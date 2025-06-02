# Font Implementation Plan

## Overview
Implement a two-phase font system for the designer tool, starting with a curated selection of 50 fonts (Phase 1) and later expanding to a full font browser (Phase 2).

## Phase 1: Curated Font Library (50 Fonts) ✅ COMPLETED

### Implementation Status
Phase 1 has been successfully implemented with the following components:

### Selected Fonts
Based on VistaPrint's proven selection, covering all major use cases:

#### Sans Serif (15 fonts)
- Arial
- Roboto (Regular, Bold)
- Open Sans (Regular, Bold)
- Lato (Regular, Bold)
- Montserrat (Regular, Bold)
- Raleway
- Poppins
- Archivo
- Archivo Narrow
- Barlow Semi Condensed
- Alumni Sans
- Arimo

#### Serif (8 fonts)
- Times New Roman
- Georgia
- Playfair Display
- Merriweather
- Lora
- Abril Fatface
- Antic Slab
- Bellota

#### Display/Decorative (12 fonts)
- Bebas Neue
- Oswald
- Anton
- Righteous
- Bowlby One
- Boogaloo
- Fredoka One
- Pacifico
- Lobster
- Amaranth
- Bevan
- Blazma

#### Script/Handwriting (10 fonts)
- Alex Brush
- Allison
- Dancing Script
- Great Vibes
- Parisienne
- Sacramento
- Caveat
- Kalam
- Satisfy
- Amatic SC

#### Monospace (5 fonts)
- Courier New
- Roboto Mono
- Source Code Pro
- IBM Plex Mono
- JetBrains Mono

### Implementation Steps

#### 1. Font Storage Setup
```bash
s3://shopify-designs/
  fonts/
    roboto/
      roboto-regular.woff2
      roboto-bold.woff2
      preview.png
    open-sans/
      open-sans-regular.woff2
      open-sans-bold.woff2
      preview.png
    ...
```

#### 2. Font Metadata Structure
```typescript
// app/constants/fonts.ts
export interface FontDefinition {
  id: string;
  family: string;
  displayName: string;
  category: 'sans-serif' | 'serif' | 'display' | 'script' | 'monospace';
  weights: {
    [key: number]: {
      style: 'normal' | 'italic';
      url: string;
    }
  };
  previewUrl: string;
  fallback: string;
}

export const CURATED_FONTS: FontDefinition[] = [
  {
    id: 'roboto',
    family: 'Roboto',
    displayName: 'Roboto',
    category: 'sans-serif',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/roboto/roboto-regular.woff2'
      },
      700: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/roboto/roboto-bold.woff2'
      }
    },
    previewUrl: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/roboto/preview.png',
    fallback: 'sans-serif'
  },
  // ... rest of fonts
];
```

#### 3. Font Loading Service
```typescript
// app/services/font-loader.ts
export class FontLoader {
  private loadedFonts: Set<string> = new Set();
  
  async loadFont(fontDef: FontDefinition, weight: number = 400): Promise<void> {
    const fontKey = `${fontDef.family}-${weight}`;
    
    if (this.loadedFonts.has(fontKey)) {
      return;
    }
    
    const weightData = fontDef.weights[weight];
    if (!weightData) {
      console.warn(`Weight ${weight} not available for ${fontDef.family}`);
      return;
    }
    
    try {
      const font = new FontFace(
        fontDef.family,
        `url(${weightData.url})`,
        {
          weight: weight.toString(),
          style: weightData.style
        }
      );
      
      await font.load();
      document.fonts.add(font);
      this.loadedFonts.add(fontKey);
    } catch (error) {
      console.error(`Failed to load font ${fontDef.family}:`, error);
    }
  }
  
  async preloadFonts(fontIds: string[]): Promise<void> {
    const promises = fontIds.map(id => {
      const fontDef = CURATED_FONTS.find(f => f.id === id);
      if (fontDef) {
        return this.loadFont(fontDef);
      }
    });
    
    await Promise.all(promises);
  }
}
```

#### 4. Designer Canvas Integration
- Add font picker dropdown to the toolbar
- Show font preview images for instant feedback
- Load font on selection
- Update template save structure to include font references

#### 5. Frontend Renderer Integration
- Parse font references from template data
- Load required fonts before rendering
- Fallback to system fonts if loading fails

### Tasks Breakdown

#### Backend Tasks ✅
1. ✅ Create S3 folder structure for fonts
2. ✅ Download and upload 50 fonts to S3 (via setup-fonts.mjs script)
3. ✅ Generate preview images for each font (styled previews showing font characteristics)
4. ✅ Create font metadata constants file (app/constants/fonts.ts)
5. ✅ Implement font loading service (app/services/font-loader.ts)
6. ✅ Update template save/load to handle fonts

#### Frontend Tasks (Designer) ✅
1. ✅ Add font picker UI component (dropdown with preview images)
2. ✅ Integrate font loader service
3. ✅ Update text elements to use selected fonts
4. ✅ Add font info to canvas state serialization

#### Frontend Tasks (Theme Extension) ✅
1. ✅ Add font loading to canvas-text-renderer.js
2. ✅ Ensure fonts load before rendering
3. ✅ Handle font loading errors gracefully

### Implementation Details

#### Font Storage
All fonts are stored in S3 with the following structure:
```
s3://shopify-designs/fonts/{font-id}/
  - {font-id}-regular.woff2
  - {font-id}-bold.woff2 (if available)
  - preview.png (styled preview image)
```

#### Font Loading System
- **Dynamic Loading**: Fonts are loaded on-demand using the FontFace API
- **Caching**: Loaded fonts are cached in memory to prevent duplicate loading
- **Priority Fonts**: Arial, Roboto, Open Sans, and Montserrat preload on mount
- **Preview Images**: Font picker shows preview PNGs for fast initial load

#### Scripts
- `npm run setup-fonts`: Downloads fonts from Google Fonts and uploads to S3
- `npm run generate-font-previews`: Generates styled preview images

#### Key Features Implemented
1. **Visual Font Picker**: Displays font preview images with appropriate styling
2. **Performance Optimized**: Only loads fonts when selected, not all 50 at once
3. **CORS Resolved**: Self-hosting on S3 eliminates cross-origin issues
4. **Latin Subset**: Downloads proper Latin character set (U+0000-00FF)
5. **Canvas Integration**: Full support in both designer and frontend renderer

## Phase 2: Font Browser (Future Enhancement)

### Features
- Modal with 1000+ Google Fonts
- Category filtering (serif, sans-serif, etc.)
- Search functionality
- Font preview with custom text
- Recently used fonts
- Popular fonts section

### Technical Approach
1. Build font metadata database
2. Create paginated font browser UI
3. Implement search/filter backend
4. Add font usage analytics
5. Optimize loading with intersection observer

## Performance Considerations

### Caching Strategy
- CloudFront with 1-year cache headers
- Browser cache for loaded fonts
- LocalStorage for recently used fonts

### Loading Optimization
- Only load fonts when selected
- Preload fonts used in template
- Use font-display: swap for better UX
- Subset fonts to reduce file size

## Migration Path
1. Start with system fonts only (current state)
2. Add Phase 1 curated fonts
3. Migrate existing templates to use font IDs
4. Launch Phase 2 font browser
5. Track usage and optimize curated list

## Success Metrics
- Font loading time < 500ms
- Designer performance unchanged
- 90% of users find suitable font in curated list
- Zero CORS errors
- Offline functionality after first load
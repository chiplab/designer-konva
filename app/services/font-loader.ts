import { FontDefinition, CURATED_FONTS } from '../constants/fonts';

export class FontLoader {
  private static instance: FontLoader;
  private loadedFonts: Set<string> = new Set();
  private loadingFonts: Map<string, Promise<void>> = new Map();

  private constructor() {
    // Check for system fonts that don't need loading
    const systemFonts = ['Arial', 'Times New Roman', 'Georgia', 'Courier New'];
    systemFonts.forEach(font => {
      this.loadedFonts.add(`${font}-400`);
      this.loadedFonts.add(`${font}-700`);
    });
  }

  static getInstance(): FontLoader {
    if (!FontLoader.instance) {
      FontLoader.instance = new FontLoader();
    }
    return FontLoader.instance;
  }

  async loadFont(fontDef: FontDefinition, weight: number = 400): Promise<void> {
    const fontKey = `${fontDef.family}-${weight}`;
    
    // Already loaded
    if (this.loadedFonts.has(fontKey)) {
      return Promise.resolve();
    }

    // Currently loading
    if (this.loadingFonts.has(fontKey)) {
      return this.loadingFonts.get(fontKey)!;
    }

    // System fonts don't need loading
    const systemFonts = ['Arial', 'Times New Roman', 'Georgia', 'Courier New'];
    if (systemFonts.includes(fontDef.family)) {
      this.loadedFonts.add(fontKey);
      return Promise.resolve();
    }

    const weightData = fontDef.weights[weight];
    if (!weightData) {
      console.warn(`Weight ${weight} not available for ${fontDef.family}`);
      return Promise.resolve();
    }

    // Start loading
    const loadPromise = this.loadFontFace(fontDef, weight, weightData);
    this.loadingFonts.set(fontKey, loadPromise);

    try {
      await loadPromise;
      this.loadedFonts.add(fontKey);
    } finally {
      this.loadingFonts.delete(fontKey);
    }
  }

  private async loadFontFace(
    fontDef: FontDefinition,
    weight: number,
    weightData: { style: string; url: string }
  ): Promise<void> {
    try {
      // Check if FontFace API is available
      if (typeof FontFace === 'undefined') {
        // Fallback: inject @font-face rule
        this.injectFontFace(fontDef, weight, weightData);
        return;
      }

      const font = new FontFace(
        fontDef.family,
        `url(${weightData.url})`,
        {
          weight: weight.toString(),
          style: weightData.style,
          display: 'swap'
        }
      );

      await font.load();
      document.fonts.add(font);
      
      // Verify font is actually available
      await document.fonts.ready;
    } catch (error) {
      console.error(`Failed to load font ${fontDef.family}:`, error);
      // Try fallback method
      this.injectFontFace(fontDef, weight, weightData);
    }
  }

  private injectFontFace(
    fontDef: FontDefinition,
    weight: number,
    weightData: { style: string; url: string }
  ): void {
    const styleId = `font-${fontDef.id}-${weight}`;
    
    // Check if already injected
    if (document.getElementById(styleId)) {
      return;
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @font-face {
        font-family: '${fontDef.family}';
        src: url('${weightData.url}') format('woff2');
        font-weight: ${weight};
        font-style: ${weightData.style};
        font-display: swap;
      }
    `;
    document.head.appendChild(style);
  }

  async preloadFonts(fontIds: string[]): Promise<void> {
    const promises = fontIds.map(id => {
      const fontDef = CURATED_FONTS.find(f => f.id === id);
      if (fontDef) {
        // Load both regular and bold weights if available
        const weights = Object.keys(fontDef.weights).map(w => parseInt(w));
        return Promise.all(weights.map(weight => this.loadFont(fontDef, weight)));
      }
      return Promise.resolve();
    });

    await Promise.all(promises);
  }

  isFontLoaded(fontFamily: string, weight: number = 400): boolean {
    return this.loadedFonts.has(`${fontFamily}-${weight}`);
  }

  // For debugging
  getLoadedFonts(): string[] {
    return Array.from(this.loadedFonts);
  }

  // Load font by family name (useful for loading from saved templates)
  async loadFontByFamily(fontFamily: string, weight: number = 400): Promise<void> {
    const fontDef = CURATED_FONTS.find(f => f.family === fontFamily);
    if (fontDef) {
      await this.loadFont(fontDef, weight);
    } else {
      console.warn(`Font family "${fontFamily}" not found in curated fonts`);
    }
  }
}

// Export singleton instance
export const fontLoader = FontLoader.getInstance();
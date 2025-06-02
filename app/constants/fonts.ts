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

const CURATED_FONTS_BASE: Omit<FontDefinition, 'previewUrl'>[] = [
  // Sans Serif Fonts
  {
    id: 'arial',
    family: 'Arial',
    displayName: 'Arial',
    category: 'sans-serif',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/arial/arial-regular.woff2'
      },
      700: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/arial/arial-bold.woff2'
      }
    },
    fallback: 'sans-serif'
  },
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
    fallback: 'sans-serif'
  },
  {
    id: 'open-sans',
    family: 'Open Sans',
    displayName: 'Open Sans',
    category: 'sans-serif',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/open-sans/open-sans-regular.woff2'
      },
      700: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/open-sans/open-sans-bold.woff2'
      }
    },
    fallback: 'sans-serif'
  },
  {
    id: 'lato',
    family: 'Lato',
    displayName: 'Lato',
    category: 'sans-serif',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/lato/lato-regular.woff2'
      },
      700: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/lato/lato-bold.woff2'
      }
    },
    fallback: 'sans-serif'
  },
  {
    id: 'montserrat',
    family: 'Montserrat',
    displayName: 'Montserrat',
    category: 'sans-serif',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/montserrat/montserrat-regular.woff2'
      },
      700: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/montserrat/montserrat-bold.woff2'
      }
    },
    fallback: 'sans-serif'
  },
  {
    id: 'raleway',
    family: 'Raleway',
    displayName: 'Raleway',
    category: 'sans-serif',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/raleway/raleway-regular.woff2'
      }
    },
    fallback: 'sans-serif'
  },
  {
    id: 'poppins',
    family: 'Poppins',
    displayName: 'Poppins',
    category: 'sans-serif',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/poppins/poppins-regular.woff2'
      },
      700: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/poppins/poppins-bold.woff2'
      }
    },
    fallback: 'sans-serif'
  },
  {
    id: 'archivo',
    family: 'Archivo',
    displayName: 'Archivo',
    category: 'sans-serif',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/archivo/archivo-regular.woff2'
      }
    },
    fallback: 'sans-serif'
  },
  {
    id: 'archivo-narrow',
    family: 'Archivo Narrow',
    displayName: 'Archivo Narrow',
    category: 'sans-serif',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/archivo-narrow/archivo-narrow-regular.woff2'
      }
    },
    fallback: 'sans-serif'
  },
  {
    id: 'barlow-semi-condensed',
    family: 'Barlow Semi Condensed',
    displayName: 'Barlow Semi Condensed',
    category: 'sans-serif',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/barlow-semi-condensed/barlow-semi-condensed-regular.woff2'
      }
    },
    fallback: 'sans-serif'
  },
  {
    id: 'alumni-sans',
    family: 'Alumni Sans',
    displayName: 'Alumni Sans',
    category: 'sans-serif',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/alumni-sans/alumni-sans-regular.woff2'
      }
    },
    fallback: 'sans-serif'
  },
  {
    id: 'arimo',
    family: 'Arimo',
    displayName: 'Arimo',
    category: 'sans-serif',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/arimo/arimo-regular.woff2'
      }
    },
    fallback: 'sans-serif'
  },

  // Serif Fonts
  {
    id: 'times-new-roman',
    family: 'Times New Roman',
    displayName: 'Times New Roman',
    category: 'serif',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/times-new-roman/times-new-roman-regular.woff2'
      }
    },
    fallback: 'serif'
  },
  {
    id: 'georgia',
    family: 'Georgia',
    displayName: 'Georgia',
    category: 'serif',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/georgia/georgia-regular.woff2'
      }
    },
    fallback: 'serif'
  },
  {
    id: 'playfair-display',
    family: 'Playfair Display',
    displayName: 'Playfair Display',
    category: 'serif',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/playfair-display/playfair-display-regular.woff2'
      },
      700: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/playfair-display/playfair-display-bold.woff2'
      }
    },
    fallback: 'serif'
  },
  {
    id: 'merriweather',
    family: 'Merriweather',
    displayName: 'Merriweather',
    category: 'serif',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/merriweather/merriweather-regular.woff2'
      }
    },
    fallback: 'serif'
  },
  {
    id: 'lora',
    family: 'Lora',
    displayName: 'Lora',
    category: 'serif',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/lora/lora-regular.woff2'
      }
    },
    fallback: 'serif'
  },
  {
    id: 'abril-fatface',
    family: 'Abril Fatface',
    displayName: 'Abril Fatface',
    category: 'serif',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/abril-fatface/abril-fatface-regular.woff2'
      }
    },
    fallback: 'serif'
  },
  {
    id: 'antic-slab',
    family: 'Antic Slab',
    displayName: 'Antic Slab',
    category: 'serif',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/antic-slab/antic-slab-regular.woff2'
      }
    },
    fallback: 'serif'
  },
  {
    id: 'bellota',
    family: 'Bellota',
    displayName: 'Bellota',
    category: 'serif',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/bellota/bellota-regular.woff2'
      }
    },
    fallback: 'serif'
  },

  // Display Fonts
  {
    id: 'bebas-neue',
    family: 'Bebas Neue',
    displayName: 'Bebas Neue',
    category: 'display',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/bebas-neue/bebas-neue-regular.woff2'
      }
    },
    fallback: 'sans-serif'
  },
  {
    id: 'oswald',
    family: 'Oswald',
    displayName: 'Oswald',
    category: 'display',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/oswald/oswald-regular.woff2'
      }
    },
    fallback: 'sans-serif'
  },
  {
    id: 'anton',
    family: 'Anton',
    displayName: 'Anton',
    category: 'display',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/anton/anton-regular.woff2'
      }
    },
    fallback: 'sans-serif'
  },
  {
    id: 'righteous',
    family: 'Righteous',
    displayName: 'Righteous',
    category: 'display',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/righteous/righteous-regular.woff2'
      }
    },
    fallback: 'sans-serif'
  },
  {
    id: 'bowlby-one',
    family: 'Bowlby One',
    displayName: 'Bowlby One',
    category: 'display',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/bowlby-one/bowlby-one-regular.woff2'
      }
    },
    fallback: 'sans-serif'
  },
  {
    id: 'boogaloo',
    family: 'Boogaloo',
    displayName: 'Boogaloo',
    category: 'display',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/boogaloo/boogaloo-regular.woff2'
      }
    },
    fallback: 'sans-serif'
  },
  {
    id: 'fredoka-one',
    family: 'Fredoka One',
    displayName: 'Fredoka One',
    category: 'display',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/fredoka-one/fredoka-one-regular.woff2'
      }
    },
    fallback: 'sans-serif'
  },
  {
    id: 'pacifico',
    family: 'Pacifico',
    displayName: 'Pacifico',
    category: 'display',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/pacifico/pacifico-regular.woff2'
      }
    },
    fallback: 'cursive'
  },
  {
    id: 'lobster',
    family: 'Lobster',
    displayName: 'Lobster',
    category: 'display',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/lobster/lobster-regular.woff2'
      }
    },
    fallback: 'cursive'
  },
  {
    id: 'amaranth',
    family: 'Amaranth',
    displayName: 'Amaranth',
    category: 'display',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/amaranth/amaranth-regular.woff2'
      }
    },
    fallback: 'sans-serif'
  },
  {
    id: 'bevan',
    family: 'Bevan',
    displayName: 'Bevan',
    category: 'display',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/bevan/bevan-regular.woff2'
      }
    },
    fallback: 'serif'
  },
  {
    id: 'blayzma',
    family: 'Blazma',
    displayName: 'Blazma',
    category: 'display',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/blazma/blazma-regular.woff2'
      }
    },
    fallback: 'sans-serif'
  },

  // Script Fonts
  {
    id: 'alex-brush',
    family: 'Alex Brush',
    displayName: 'Alex Brush',
    category: 'script',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/alex-brush/alex-brush-regular.woff2'
      }
    },
    fallback: 'cursive'
  },
  {
    id: 'allison',
    family: 'Allison',
    displayName: 'Allison',
    category: 'script',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/allison/allison-regular.woff2'
      }
    },
    fallback: 'cursive'
  },
  {
    id: 'dancing-script',
    family: 'Dancing Script',
    displayName: 'Dancing Script',
    category: 'script',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/dancing-script/dancing-script-regular.woff2'
      },
      700: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/dancing-script/dancing-script-bold.woff2'
      }
    },
    fallback: 'cursive'
  },
  {
    id: 'great-vibes',
    family: 'Great Vibes',
    displayName: 'Great Vibes',
    category: 'script',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/great-vibes/great-vibes-regular.woff2'
      }
    },
    fallback: 'cursive'
  },
  {
    id: 'parisienne',
    family: 'Parisienne',
    displayName: 'Parisienne',
    category: 'script',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/parisienne/parisienne-regular.woff2'
      }
    },
    fallback: 'cursive'
  },
  {
    id: 'sacramento',
    family: 'Sacramento',
    displayName: 'Sacramento',
    category: 'script',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/sacramento/sacramento-regular.woff2'
      }
    },
    fallback: 'cursive'
  },
  {
    id: 'caveat',
    family: 'Caveat',
    displayName: 'Caveat',
    category: 'script',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/caveat/caveat-regular.woff2'
      }
    },
    fallback: 'cursive'
  },
  {
    id: 'kalam',
    family: 'Kalam',
    displayName: 'Kalam',
    category: 'script',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/kalam/kalam-regular.woff2'
      }
    },
    fallback: 'cursive'
  },
  {
    id: 'satisfy',
    family: 'Satisfy',
    displayName: 'Satisfy',
    category: 'script',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/satisfy/satisfy-regular.woff2'
      }
    },
    fallback: 'cursive'
  },
  {
    id: 'amatic-sc',
    family: 'Amatic SC',
    displayName: 'Amatic SC',
    category: 'script',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/amatic-sc/amatic-sc-regular.woff2'
      }
    },
    fallback: 'cursive'
  },

  // Monospace Fonts
  {
    id: 'courier-new',
    family: 'Courier New',
    displayName: 'Courier New',
    category: 'monospace',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/courier-new/courier-new-regular.woff2'
      }
    },
    fallback: 'monospace'
  },
  {
    id: 'roboto-mono',
    family: 'Roboto Mono',
    displayName: 'Roboto Mono',
    category: 'monospace',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/roboto-mono/roboto-mono-regular.woff2'
      }
    },
    fallback: 'monospace'
  },
  {
    id: 'source-code-pro',
    family: 'Source Code Pro',
    displayName: 'Source Code Pro',
    category: 'monospace',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/source-code-pro/source-code-pro-regular.woff2'
      }
    },
    fallback: 'monospace'
  },
  {
    id: 'ibm-plex-mono',
    family: 'IBM Plex Mono',
    displayName: 'IBM Plex Mono',
    category: 'monospace',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/ibm-plex-mono/ibm-plex-mono-regular.woff2'
      }
    },
    fallback: 'monospace'
  },
  {
    id: 'jetbrains-mono',
    family: 'JetBrains Mono',
    displayName: 'JetBrains Mono',
    category: 'monospace',
    weights: {
      400: {
        style: 'normal',
        url: 'https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/jetbrains-mono/jetbrains-mono-regular.woff2'
      }
    },
    fallback: 'monospace'
  }
];

// Add preview URLs to all fonts and export
export const CURATED_FONTS: FontDefinition[] = CURATED_FONTS_BASE.map(font => ({
  ...font,
  previewUrl: `https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/${font.id}/preview.png?v=2`
}));

// Helper function to get font by ID
export function getFontById(id: string): FontDefinition | undefined {
  return CURATED_FONTS.find(font => font.id === id);
}

// Helper function to get fonts by category
export function getFontsByCategory(category: FontDefinition['category']): FontDefinition[] {
  return CURATED_FONTS.filter(font => font.category === category);
}

// Default font
export const DEFAULT_FONT = CURATED_FONTS[0]; // Arial
import db from "../db.server";

interface ColorMapping {
  chipColor: string;
  color1: string;
  color2: string;
  color3: string;
  color4?: string | null;
  color5?: string | null;
}

interface CanvasElement {
  fill?: string;
  stroke?: string;
  [key: string]: any;
}

/**
 * Maps a color hex value to its position in the template color palette
 * Returns null if the color doesn't match any in the source palette
 */
function findColorPosition(color: string, sourceColors: ColorMapping): number | null {
  const normalizedColor = color.toLowerCase();
  
  if (normalizedColor === sourceColors.color1.toLowerCase()) return 1;
  if (normalizedColor === sourceColors.color2.toLowerCase()) return 2;
  if (normalizedColor === sourceColors.color3.toLowerCase()) return 3;
  if (sourceColors.color4 && normalizedColor === sourceColors.color4.toLowerCase()) return 4;
  if (sourceColors.color5 && normalizedColor === sourceColors.color5.toLowerCase()) return 5;
  
  return null;
}

/**
 * Replaces a color based on its position in the color mapping
 */
function replaceColorByPosition(position: number, targetColors: ColorMapping): string | null {
  switch (position) {
    case 1: return targetColors.color1;
    case 2: return targetColors.color2;
    case 3: return targetColors.color3;
    case 4: return targetColors.color4;
    case 5: return targetColors.color5;
    default: return null;
  }
}

/**
 * Recursively processes canvas data to replace colors
 */
function processCanvasElement(element: CanvasElement, sourceColors: ColorMapping, targetColors: ColorMapping): CanvasElement {
  const processed = { ...element };
  
  // Process fill color
  if (processed.fill && typeof processed.fill === 'string') {
    const position = findColorPosition(processed.fill, sourceColors);
    if (position) {
      const newColor = replaceColorByPosition(position, targetColors);
      if (newColor) {
        processed.fill = newColor;
      }
    }
  }
  
  // Process stroke color
  if (processed.stroke && typeof processed.stroke === 'string') {
    const position = findColorPosition(processed.stroke, sourceColors);
    if (position) {
      const newColor = replaceColorByPosition(position, targetColors);
      if (newColor) {
        processed.stroke = newColor;
      }
    }
  }
  
  // Process fillLinearGradientColorStops for gradient fills
  if (processed.fillLinearGradientColorStops && Array.isArray(processed.fillLinearGradientColorStops)) {
    const newStops = [...processed.fillLinearGradientColorStops];
    // Process color stops (they alternate between position and color)
    for (let i = 1; i < newStops.length; i += 2) {
      if (typeof newStops[i] === 'string') {
        const position = findColorPosition(newStops[i], sourceColors);
        if (position) {
          const newColor = replaceColorByPosition(position, targetColors);
          if (newColor) {
            newStops[i] = newColor;
          }
        }
      }
    }
    processed.fillLinearGradientColorStops = newStops;
  }
  
  // Process fillRadialGradientColorStops for radial gradient fills
  if (processed.fillRadialGradientColorStops && Array.isArray(processed.fillRadialGradientColorStops)) {
    const newStops = [...processed.fillRadialGradientColorStops];
    // Process color stops (they alternate between position and color)
    for (let i = 1; i < newStops.length; i += 2) {
      if (typeof newStops[i] === 'string') {
        const position = findColorPosition(newStops[i], sourceColors);
        if (position) {
          const newColor = replaceColorByPosition(position, targetColors);
          if (newColor) {
            newStops[i] = newColor;
          }
        }
      }
    }
    processed.fillRadialGradientColorStops = newStops;
  }
  
  // Process nested elements recursively
  Object.keys(processed).forEach(key => {
    if (Array.isArray(processed[key])) {
      processed[key] = processed[key].map((item: any) => 
        typeof item === 'object' ? processCanvasElement(item, sourceColors, targetColors) : item
      );
    } else if (typeof processed[key] === 'object' && processed[key] !== null) {
      processed[key] = processCanvasElement(processed[key], sourceColors, targetColors);
    }
  });
  
  return processed;
}

/**
 * Normalizes color names for matching between database and Shopify
 * Database has: "light-blue" (with hyphen) and "grey" (not gray)
 * Shopify has: "Light Blue" (with space) and "Gray" (not grey)
 */
function normalizeColorName(color: string): string {
  const normalized = color.toLowerCase().trim();
  
  // Special case for "Light Blue" -> "light-blue" (database format)
  if (normalized === 'light blue') {
    return 'light-blue';
  }
  
  // Special case for "Gray" -> "grey" (database format)
  if (normalized === 'gray') {
    return 'grey';
  }
  
  return normalized;
}

/**
 * Gets all available pattern-color combinations from Shopify variants
 */
async function getAllPatternColorCombinations(
  admin: any, 
  productId: string
): Promise<Array<{ pattern: string; color: string }>> {
  const GET_PRODUCT_VARIANTS = `#graphql
    query GetProductVariants($id: ID!) {
      product(id: $id) {
        variants(first: 100) {
          edges {
            node {
              selectedOptions {
                name
                value
              }
            }
          }
        }
      }
    }
  `;
  
  try {
    const response = await admin.graphql(GET_PRODUCT_VARIANTS, {
      variables: { id: productId }
    });
    
    const data = await response.json();
    const variants = data.data?.product?.variants?.edges || [];
    
    // Extract all pattern-color combinations
    const combinations: Array<{ pattern: string; color: string }> = [];
    
    variants.forEach((edge: any) => {
      const colorOption = edge.node.selectedOptions.find((opt: any) => opt.name === "Color");
      const patternOption = edge.node.selectedOptions.find((opt: any) => 
        opt.name === "Edge Pattern" || opt.name === "Pattern"
      );
      
      if (colorOption && patternOption) {
        combinations.push({
          pattern: patternOption.value,
          color: colorOption.value
        });
      }
    });
    
    return combinations;
  } catch (error) {
    console.error("Error getting pattern-color combinations:", error);
    return [];
  }
}

/**
 * Gets available colors for a specific pattern by querying Shopify variants
 */
async function getAvailableColorsForPattern(
  admin: any, 
  productId: string, 
  pattern: string
): Promise<string[]> {
  const GET_PRODUCT_VARIANTS = `#graphql
    query GetProductVariants($id: ID!) {
      product(id: $id) {
        variants(first: 100) {
          edges {
            node {
              selectedOptions {
                name
                value
              }
            }
          }
        }
      }
    }
  `;
  
  try {
    const response = await admin.graphql(GET_PRODUCT_VARIANTS, {
      variables: { id: productId }
    });
    
    const data = await response.json();
    const variants = data.data?.product?.variants?.edges || [];
    
    // Filter variants by pattern and extract unique colors
    const colors = new Set<string>();
    
    variants.forEach((edge: any) => {
      const colorOption = edge.node.selectedOptions.find((opt: any) => opt.name === "Color");
      const patternOption = edge.node.selectedOptions.find((opt: any) => 
        opt.name === "Edge Pattern" || opt.name === "Pattern"
      );
      
      if (colorOption && patternOption && patternOption.value.toLowerCase() === pattern.toLowerCase()) {
        colors.add(colorOption.value.toLowerCase());
      }
    });
    
    return Array.from(colors);
  } catch (error) {
    console.error("Error getting available colors for pattern:", error);
    return [];
  }
}

/**
 * Generates color variants for a template
 * @param masterTemplateId - The ID of the template to generate variants from
 * @param shop - The shop domain
 * @param admin - Shopify admin context for API calls
 * @returns Array of created template IDs
 */
export async function generateColorVariants(masterTemplateId: string, shop: string, admin: any) {
  // Get the master template
  const masterTemplate = await db.template.findFirst({
    where: {
      id: masterTemplateId,
      shop,
    },
  });
  
  if (!masterTemplate) {
    throw new Error("Master template not found");
  }
  
  if (!masterTemplate.colorVariant || !masterTemplate.shopifyProductId) {
    throw new Error("Master template must have a color variant and Shopify product ID");
  }
  
  // Get the master variant details to extract pattern
  let masterPattern = "";
  if (masterTemplate.shopifyVariantId) {
    const GET_VARIANT = `#graphql
      query GetVariant($id: ID!) {
        productVariant(id: $id) {
          selectedOptions {
            name
            value
          }
        }
      }
    `;
    
    try {
      const response = await admin.graphql(GET_VARIANT, {
        variables: { id: masterTemplate.shopifyVariantId }
      });
      const data = await response.json();
      const patternOption = data.data?.productVariant?.selectedOptions?.find(
        (opt: any) => opt.name === "Edge Pattern" || opt.name === "Pattern"
      );
      masterPattern = patternOption?.value || "";
    } catch (error) {
      console.error("Error getting master pattern:", error);
    }
  }
  
  // Get available colors for this pattern from Shopify
  const availableColors = await getAvailableColorsForPattern(
    admin, 
    masterTemplate.shopifyProductId, 
    masterPattern
  );
  
  console.log(`Available colors for pattern "${masterPattern}":`, availableColors);
  console.log(`Master template color: "${masterTemplate.colorVariant}" (type: ${typeof masterTemplate.colorVariant})`);
  
  // Check if colorVariant is null or undefined
  if (!masterTemplate.colorVariant) {
    throw new Error(`Master template has no color variant set`);
  }
  
  // Get the source color mapping
  const sourceColor = await db.templateColor.findUnique({
    where: {
      chipColor: masterTemplate.colorVariant.toLowerCase(),
    },
  });
  
  if (!sourceColor) {
    console.error(`Failed to find color mapping for: "${masterTemplate.colorVariant}"`);
    console.error(`Lowercase version: "${masterTemplate.colorVariant.toLowerCase()}"`);
    
    // List available colors for debugging
    const availableColorMappings = await db.templateColor.findMany({
      select: { chipColor: true },
    });
    console.error(`Available color mappings in DB:`, availableColorMappings.map(c => c.chipColor).join(', '));
    
    throw new Error(`Color mapping not found for ${masterTemplate.colorVariant}`);
  }
  
  // Get target colors that exist for this pattern (excluding the master color)
  const targetColors = await db.templateColor.findMany({
    where: {
      chipColor: {
        in: availableColors.filter(color => 
          normalizeColorName(color) !== normalizeColorName(masterTemplate.colorVariant)
        ),
      },
    },
  });
  
  console.log(`Found ${targetColors.length} target colors to generate for pattern "${masterPattern}"`);
  
  // Parse the canvas data - handle both legacy and dual-sided formats
  let canvasData: any;
  let frontCanvasData: any = null;
  let backCanvasData: any = null;
  
  // Check if template uses new dual-sided format
  if (masterTemplate.frontCanvasData || masterTemplate.backCanvasData) {
    if (masterTemplate.frontCanvasData) {
      frontCanvasData = JSON.parse(masterTemplate.frontCanvasData);
    }
    if (masterTemplate.backCanvasData) {
      backCanvasData = JSON.parse(masterTemplate.backCanvasData);
    }
    // For backward compatibility, also parse regular canvasData if it exists
    if (masterTemplate.canvasData) {
      canvasData = JSON.parse(masterTemplate.canvasData);
    }
  } else {
    // Legacy single-sided format
    canvasData = JSON.parse(masterTemplate.canvasData);
  }
  
  // Get all variants for the product to find matching variant IDs
  const { shopifyProductId } = masterTemplate;
  
  // Generate templates for each color
  const createdTemplates = [];
  
  for (const targetColor of targetColors) {
    try {
      // Process canvas data with color replacement
      let newCanvasData: any = null;
      let newFrontCanvasData: any = null;
      let newBackCanvasData: any = null;
      
      // Process legacy single-sided data if it exists
      if (canvasData) {
        newCanvasData = processCanvasElement(canvasData, sourceColor, targetColor);
        
        // Process top-level backgroundColor
        if (newCanvasData.backgroundColor && typeof newCanvasData.backgroundColor === 'string') {
          const position = findColorPosition(newCanvasData.backgroundColor, sourceColor);
          if (position) {
            const newColor = replaceColorByPosition(position, targetColor);
            if (newColor) {
              newCanvasData.backgroundColor = newColor;
            }
          }
        }
        
        // Process backgroundGradient if present
        if (newCanvasData.backgroundGradient && newCanvasData.backgroundGradient.colorStops) {
          const newStops = [...newCanvasData.backgroundGradient.colorStops];
          // Process color stops (they alternate between position and color)
          for (let i = 1; i < newStops.length; i += 2) {
            if (typeof newStops[i] === 'string') {
              const position = findColorPosition(newStops[i], sourceColor);
              if (position) {
                const newColor = replaceColorByPosition(position, targetColor);
                if (newColor) {
                  newStops[i] = newColor;
                }
              }
            }
          }
          newCanvasData.backgroundGradient.colorStops = newStops;
        }
      }
      
      // Process front side data if it exists
      if (frontCanvasData) {
        newFrontCanvasData = processCanvasElement(frontCanvasData, sourceColor, targetColor);
        
        // Process top-level backgroundColor for front
        if (newFrontCanvasData.backgroundColor && typeof newFrontCanvasData.backgroundColor === 'string') {
          const position = findColorPosition(newFrontCanvasData.backgroundColor, sourceColor);
          if (position) {
            const newColor = replaceColorByPosition(position, targetColor);
            if (newColor) {
              newFrontCanvasData.backgroundColor = newColor;
            }
          }
        }
        
        // Process backgroundGradient for front
        if (newFrontCanvasData.backgroundGradient && newFrontCanvasData.backgroundGradient.colorStops) {
          const newStops = [...newFrontCanvasData.backgroundGradient.colorStops];
          for (let i = 1; i < newStops.length; i += 2) {
            if (typeof newStops[i] === 'string') {
              const position = findColorPosition(newStops[i], sourceColor);
              if (position) {
                const newColor = replaceColorByPosition(position, targetColor);
                if (newColor) {
                  newStops[i] = newColor;
                }
              }
            }
          }
          newFrontCanvasData.backgroundGradient.colorStops = newStops;
        }
      }
      
      // Process back side data if it exists
      if (backCanvasData) {
        newBackCanvasData = processCanvasElement(backCanvasData, sourceColor, targetColor);
        
        // Process top-level backgroundColor for back
        if (newBackCanvasData.backgroundColor && typeof newBackCanvasData.backgroundColor === 'string') {
          const position = findColorPosition(newBackCanvasData.backgroundColor, sourceColor);
          if (position) {
            const newColor = replaceColorByPosition(position, targetColor);
            if (newColor) {
              newBackCanvasData.backgroundColor = newColor;
            }
          }
        }
        
        // Process backgroundGradient for back
        if (newBackCanvasData.backgroundGradient && newBackCanvasData.backgroundGradient.colorStops) {
          const newStops = [...newBackCanvasData.backgroundGradient.colorStops];
          for (let i = 1; i < newStops.length; i += 2) {
            if (typeof newStops[i] === 'string') {
              const position = findColorPosition(newStops[i], sourceColor);
              if (position) {
                const newColor = replaceColorByPosition(position, targetColor);
                if (newColor) {
                  newStops[i] = newColor;
                }
              }
            }
          }
          newBackCanvasData.backgroundGradient.colorStops = newStops;
        }
      }
      
      // Find the corresponding Shopify variant ID
      // This is a simplified version - in production you'd query Shopify API
      // For now, we'll create with null variant ID and update later
      
      // Create the new template
      // Format the color name properly (e.g., "light-blue" -> "Light Blue")
      const formattedColorName = targetColor.chipColor
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      const newTemplate = await db.template.create({
        data: {
          name: masterTemplate.name.replace(
            new RegExp(masterTemplate.colorVariant, 'gi'), 
            formattedColorName
          ),
          shop,
          shopifyProductId,
          shopifyVariantId: null, // Will be updated when we implement variant matching
          // Include both legacy and dual-sided data
          canvasData: newCanvasData ? JSON.stringify(newCanvasData) : masterTemplate.canvasData,
          frontCanvasData: newFrontCanvasData ? JSON.stringify(newFrontCanvasData) : null,
          backCanvasData: newBackCanvasData ? JSON.stringify(newBackCanvasData) : null,
          masterTemplateId,
          isColorVariant: true,
          // Legacy fields
          productLayoutId: masterTemplate.productLayoutId,
          colorVariant: targetColor.chipColor,
        },
      });
      
      createdTemplates.push({
        id: newTemplate.id,
        color: targetColor.chipColor,
      });
      
      console.log(`Created ${targetColor.chipColor} variant: ${newTemplate.id}`);
      
    } catch (error) {
      console.error(`Error creating ${targetColor.chipColor} variant:`, error);
    }
  }
  
  return createdTemplates;
}

/**
 * Generates ALL pattern and color variants from a single master template
 * This will create templates for ALL patterns in the product, not just the master's pattern
 */
export async function generateAllVariants(masterTemplateId: string, shop: string, admin: any) {
  console.log(`generateAllVariants: Starting generation for master template ${masterTemplateId}`);
  
  // First, delete any existing color variants for this master template
  const deletedCount = await db.template.deleteMany({
    where: {
      masterTemplateId,
      isColorVariant: true,
      shop,
    },
  });
  
  console.log(`generateAllVariants: Deleted ${deletedCount.count} existing color variants`);
  
  // Get the master template
  const masterTemplate = await db.template.findFirst({
    where: {
      id: masterTemplateId,
      shop,
    },
  });
  
  if (!masterTemplate) {
    throw new Error("Master template not found");
  }
  
  // Check if we have either legacy or layout-based product reference
  if (!masterTemplate.shopifyProductId && !masterTemplate.layoutVariantId) {
    throw new Error("Master template must have either a Shopify product ID or layout variant");
  }
  
  // Determine product IDs - one for layout (source) and one for selling
  let layoutProductId = null;
  let sellingProductId = masterTemplate.shopifyProductId;
  
  if (masterTemplate.layoutVariantId) {
    const layoutVariant = await db.layoutVariant.findUnique({
      where: { id: masterTemplate.layoutVariantId },
      include: { layout: true },
    });
    if (layoutVariant) {
      layoutProductId = layoutVariant.layout.shopifyProductId;
      console.log(`Master template uses layout from source product: ${layoutProductId}`);
    }
  }
  
  // For getting combinations, use selling product ID if available, otherwise layout product ID
  const productId = sellingProductId || layoutProductId;
  
  if (!productId) {
    throw new Error("Unable to determine product ID for variant generation");
  }
  
  console.log(`Using product ID for combinations: ${productId}`);
  console.log(`Using layout product ID for base images: ${layoutProductId || 'none (will not find base images)'}`)
  
  // Get ALL pattern-color combinations from the product
  const allCombinations = await getAllPatternColorCombinations(
    admin,
    productId
  );
  
  console.log(`Found ${allCombinations.length} total pattern-color combinations`);
  
  // Get unique patterns
  const patterns = [...new Set(allCombinations.map(c => c.pattern))];
  console.log(`Unique patterns: ${patterns.join(', ')}`);
  
  // Debug: log the actual combinations
  console.log('All combinations found:');
  allCombinations.slice(0, 5).forEach(c => {
    console.log(`  - ${c.color} / ${c.pattern}`);
  });
  if (allCombinations.length > 5) {
    console.log(`  ... and ${allCombinations.length - 5} more`);
  }
  
  // We'll get the source color mapping after we determine the master color
  let sourceColor = null;
  
  // Parse the master template's canvas data - handle both legacy and dual-sided formats
  let canvasData: any = null;
  let frontCanvasData: any = null;
  let backCanvasData: any = null;
  
  // Check if template uses new dual-sided format
  if (masterTemplate.frontCanvasData || masterTemplate.backCanvasData) {
    if (masterTemplate.frontCanvasData) {
      frontCanvasData = JSON.parse(masterTemplate.frontCanvasData);
    }
    if (masterTemplate.backCanvasData) {
      backCanvasData = JSON.parse(masterTemplate.backCanvasData);
    }
    // For backward compatibility, also parse regular canvasData if it exists
    if (masterTemplate.canvasData) {
      canvasData = JSON.parse(masterTemplate.canvasData);
    }
  } else {
    // Legacy single-sided format
    canvasData = JSON.parse(masterTemplate.canvasData);
  }
  
  // Use the product ID we already determined
  const productIdForVariants = productId;
  
  // Make layoutProductId available for base image lookups
  const layoutProductIdForBaseImages = layoutProductId;
  
  // Generate templates for ALL combinations (excluding the master's own combination)
  const createdTemplates = [];
  
  // Get master color and pattern - handle both legacy and layout-based templates
  let masterColor = masterTemplate.colorVariant;
  let masterPattern = "";
  
  // If using layout system, get color and pattern from layout variant
  if (!masterColor && masterTemplate.layoutVariantId) {
    const layoutVariant = await db.layoutVariant.findUnique({
      where: { id: masterTemplate.layoutVariantId },
    });
    if (layoutVariant) {
      masterColor = layoutVariant.color;
      masterPattern = layoutVariant.pattern || "";
      console.log(`Using color/pattern from layout variant: ${masterColor}/${masterPattern}`);
    }
  }
  
  if (!masterColor) {
    throw new Error("Unable to determine master template color");
  }
  
  const masterColorNormalized = normalizeColorName(masterColor);
  
  // Now get the source color mapping
  sourceColor = await db.templateColor.findUnique({
    where: {
      chipColor: masterColorNormalized,
    },
  });
  
  if (!sourceColor) {
    throw new Error(`Color mapping not found for ${masterColor} (normalized: ${masterColorNormalized})`);
  }
  
  // Get the master's pattern if it has a variant ID (legacy path)
  if (!masterPattern && masterTemplate.shopifyVariantId) {
    const GET_VARIANT = `#graphql
      query GetVariant($id: ID!) {
        productVariant(id: $id) {
          selectedOptions {
            name
            value
          }
        }
      }
    `;
    
    try {
      const response = await admin.graphql(GET_VARIANT, {
        variables: { id: masterTemplate.shopifyVariantId }
      });
      const data = await response.json();
      const patternOption = data.data?.productVariant?.selectedOptions?.find(
        (opt: any) => opt.name === "Edge Pattern" || opt.name === "Pattern"
      );
      masterPattern = patternOption?.value || "";
    } catch (error) {
      console.error("Error getting master pattern:", error);
    }
  }
  
  console.log(`\nStarting variant generation loop...`);
  console.log(`Master: color="${masterColor}" (normalized="${masterColorNormalized}"), pattern="${masterPattern}"`);
  
  for (const combination of allCombinations) {
    // Skip the master template's own combination
    if (normalizeColorName(combination.color) === masterColorNormalized && 
        combination.pattern.toLowerCase() === masterPattern.toLowerCase()) {
      console.log(`Skipping master template's combination: ${combination.color}/${combination.pattern}`);
      continue;
    }
    
    console.log(`\nProcessing combination: ${combination.color} / ${combination.pattern}`);
    
    try {
      // Get the target color mapping using proper normalization
      const normalizedColorName = normalizeColorName(combination.color);
      const targetColor = await db.templateColor.findUnique({
        where: {
          chipColor: normalizedColorName,
        },
      });
      
      if (!targetColor) {
        console.warn(`Color mapping not found for ${combination.color}, skipping`);
        continue;
      }
      
      // Process canvas data with color replacement - handle both legacy and dual-sided
      let newCanvasData: any = null;
      let newFrontCanvasData: any = null;
      let newBackCanvasData: any = null;
      
      // Process legacy single-sided data if it exists
      if (canvasData) {
        newCanvasData = processCanvasElement(canvasData, sourceColor, targetColor);
        
        // Process top-level backgroundColor
        if (newCanvasData.backgroundColor && typeof newCanvasData.backgroundColor === 'string') {
          const position = findColorPosition(newCanvasData.backgroundColor, sourceColor);
          if (position) {
            const newColor = replaceColorByPosition(position, targetColor);
            if (newColor) {
              newCanvasData.backgroundColor = newColor;
            }
          }
        }
        
        // Process backgroundGradient if present
        if (newCanvasData.backgroundGradient && newCanvasData.backgroundGradient.colorStops) {
          const newStops = [...newCanvasData.backgroundGradient.colorStops];
          for (let i = 1; i < newStops.length; i += 2) {
            if (typeof newStops[i] === 'string') {
              const position = findColorPosition(newStops[i], sourceColor);
              if (position) {
                const newColor = replaceColorByPosition(position, targetColor);
                if (newColor) {
                  newStops[i] = newColor;
                }
              }
            }
          }
          newCanvasData.backgroundGradient.colorStops = newStops;
        }
      }
      
      // Process front side data if it exists
      if (frontCanvasData) {
        newFrontCanvasData = processCanvasElement(frontCanvasData, sourceColor, targetColor);
        
        // Process top-level backgroundColor for front
        if (newFrontCanvasData.backgroundColor && typeof newFrontCanvasData.backgroundColor === 'string') {
          const position = findColorPosition(newFrontCanvasData.backgroundColor, sourceColor);
          if (position) {
            const newColor = replaceColorByPosition(position, targetColor);
            if (newColor) {
              newFrontCanvasData.backgroundColor = newColor;
            }
          }
        }
        
        // Process backgroundGradient for front
        if (newFrontCanvasData.backgroundGradient && newFrontCanvasData.backgroundGradient.colorStops) {
          const newStops = [...newFrontCanvasData.backgroundGradient.colorStops];
          for (let i = 1; i < newStops.length; i += 2) {
            if (typeof newStops[i] === 'string') {
              const position = findColorPosition(newStops[i], sourceColor);
              if (position) {
                const newColor = replaceColorByPosition(position, targetColor);
                if (newColor) {
                  newStops[i] = newColor;
                }
              }
            }
          }
          newFrontCanvasData.backgroundGradient.colorStops = newStops;
        }
      }
      
      // Process back side data if it exists
      if (backCanvasData) {
        newBackCanvasData = processCanvasElement(backCanvasData, sourceColor, targetColor);
        
        // Process top-level backgroundColor for back
        if (newBackCanvasData.backgroundColor && typeof newBackCanvasData.backgroundColor === 'string') {
          const position = findColorPosition(newBackCanvasData.backgroundColor, sourceColor);
          if (position) {
            const newColor = replaceColorByPosition(position, targetColor);
            if (newColor) {
              newBackCanvasData.backgroundColor = newColor;
            }
          }
        }
        
        // Process backgroundGradient for back
        if (newBackCanvasData.backgroundGradient && newBackCanvasData.backgroundGradient.colorStops) {
          const newStops = [...newBackCanvasData.backgroundGradient.colorStops];
          for (let i = 1; i < newStops.length; i += 2) {
            if (typeof newStops[i] === 'string') {
              const position = findColorPosition(newStops[i], sourceColor);
              if (position) {
                const newColor = replaceColorByPosition(position, targetColor);
                if (newColor) {
                  newStops[i] = newColor;
                }
              }
            }
          }
          newBackCanvasData.backgroundGradient.colorStops = newStops;
        }
      }
      
      // Get the correct base image for this color/pattern combination
      // Use layoutProductId (source product) for finding base images, not the selling product
      const productIdForBaseImage = layoutProductIdForBaseImages || productIdForVariants;
      console.log(`Looking for base image: productId="${productIdForBaseImage}", color="${combination.color}", pattern="${combination.pattern}"`);
      const baseImageUrl = await getBaseImageForVariant(
        admin,
        productIdForBaseImage,
        combination.color,
        combination.pattern
      );
      
      // Handle base images for both legacy and dual-sided templates
      if (baseImageUrl) {
        console.log(`✅ Found base image for ${combination.color}/${combination.pattern}: ${baseImageUrl}`);
        
        // For legacy single-sided templates
        if (newCanvasData) {
          if (!newCanvasData.assets) {
            newCanvasData.assets = {};
          }
          newCanvasData.assets.baseImage = baseImageUrl;
        }
        
        // For dual-sided templates, we need to get the layout variant to check for front/back images
        let frontBaseImage = baseImageUrl; // Default to the single base image
        let backBaseImage = baseImageUrl;  // Default to the single base image
        
        if ((newFrontCanvasData || newBackCanvasData) && layoutProductIdForBaseImages) {
          // Try to get specific front/back images from the layout variant
          const layoutForImages = await db.layout.findFirst({
            where: { shopifyProductId: layoutProductIdForBaseImages },
            include: { layoutVariants: true },
          });
          
          if (layoutForImages) {
            const matchingVariant = layoutForImages.layoutVariants.find((lv) => {
              const normalizedLvColor = normalizeColorName(lv.color || '');
              const normalizedTargetColor = normalizeColorName(combination.color);
              return normalizedLvColor === normalizedTargetColor &&
                     lv.pattern?.toLowerCase() === combination.pattern.toLowerCase();
            });
            
            if (matchingVariant) {
              // Use specific front/back images if available
              if (matchingVariant.frontBaseImageUrl) {
                frontBaseImage = matchingVariant.frontBaseImageUrl;
                console.log(`   Using specific front image: ${frontBaseImage}`);
              }
              if (matchingVariant.backBaseImageUrl) {
                backBaseImage = matchingVariant.backBaseImageUrl;
                console.log(`   Using specific back image: ${backBaseImage}`);
              }
            }
          }
        }
        
        // Set base images for front canvas data
        if (newFrontCanvasData) {
          if (!newFrontCanvasData.assets) {
            newFrontCanvasData.assets = {};
          }
          newFrontCanvasData.assets.baseImage = frontBaseImage;
        }
        
        // Set base images for back canvas data
        if (newBackCanvasData) {
          if (!newBackCanvasData.assets) {
            newBackCanvasData.assets = {};
          }
          newBackCanvasData.assets.baseImage = backBaseImage;
        }
      } else {
        console.warn(`❌ No base image found for ${combination.color}/${combination.pattern}, this variant will have no base image`);
        
        // Remove base images from all canvas data
        if (newCanvasData?.assets) {
          delete newCanvasData.assets.baseImage;
        }
        if (newFrontCanvasData?.assets) {
          delete newFrontCanvasData.assets.baseImage;
        }
        if (newBackCanvasData?.assets) {
          delete newBackCanvasData.assets.baseImage;
        }
      }
      
      // Format the color and pattern names properly
      const formattedColorName = combination.color
        .split(/[\s-_]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      // Find the corresponding layout variant for this color/pattern combination
      let layoutVariantIdForNewTemplate = null;
      // Use layoutProductId (source product) to find the layout variant, not selling product
      if (layoutProductIdForBaseImages) {
        const layoutForVariant = await db.layout.findFirst({
          where: {
            shopifyProductId: layoutProductIdForBaseImages,
          },
          include: {
            layoutVariants: true,
          },
        });
        
        if (layoutForVariant) {
          const matchingLayoutVariant = layoutForVariant.layoutVariants.find((lv) => {
            const normalizedLvColor = normalizeColorName(lv.color || '');
            const normalizedTargetColor = normalizeColorName(combination.color);
            return normalizedLvColor === normalizedTargetColor &&
                   lv.pattern?.toLowerCase() === combination.pattern.toLowerCase();
          });
          
          if (matchingLayoutVariant) {
            layoutVariantIdForNewTemplate = matchingLayoutVariant.id;
            console.log(`   Found layout variant for ${combination.color}/${combination.pattern}: ${layoutVariantIdForNewTemplate}`);
          } else {
            console.warn(`   No layout variant found for ${combination.color}/${combination.pattern}`);
          }
        }
      }
      
      // Create the new template with dual-sided support
      const newTemplate = await db.template.create({
        data: {
          name: `${formattedColorName} / ${combination.pattern} Template`,
          shop,
          shopifyProductId: productIdForVariants, // Use the determined product ID
          shopifyVariantId: null, // Will be updated by matching function
          // Include both legacy and dual-sided canvas data
          canvasData: newCanvasData ? JSON.stringify(newCanvasData) : masterTemplate.canvasData,
          frontCanvasData: newFrontCanvasData ? JSON.stringify(newFrontCanvasData) : null,
          backCanvasData: newBackCanvasData ? JSON.stringify(newBackCanvasData) : null,
          masterTemplateId,
          isColorVariant: true,
          // Link to the correct layout variant for this color/pattern
          layoutVariantId: layoutVariantIdForNewTemplate,
          // Legacy fields
          productLayoutId: masterTemplate.productLayoutId,
          colorVariant: targetColor.chipColor, // Use chipColor for database consistency
        },
      });
      
      createdTemplates.push({
        id: newTemplate.id,
        color: combination.color, // Keep original Shopify color for matching
        pattern: combination.pattern,
      });
      
      console.log(`Created ${combination.color}/${combination.pattern} variant: ${newTemplate.id}`);
      
    } catch (error) {
      console.error(`Error creating ${combination.color}/${combination.pattern} variant:`, error);
    }
  }
  
  console.log(`Successfully created ${createdTemplates.length} variants from master template`);
  return createdTemplates;
}

/**
 * Gets the base image URL for a specific color/pattern combination from the Layout system
 */
async function getBaseImageForVariant(
  admin: any,
  sourceProductId: string,
  color: string,
  pattern: string
): Promise<string | null> {
  try {
    console.log(`\n🔍 getBaseImageForVariant called with:`);
    console.log(`   productId: ${sourceProductId}`);
    console.log(`   color: "${color}"`);
    console.log(`   pattern: "${pattern}"`);
    
    // First, find the Layout for this product
    const layout = await db.layout.findFirst({
      where: {
        shopifyProductId: sourceProductId,
      },
      include: {
        layoutVariants: true,
      },
    });
    
    if (!layout) {
      console.warn(`❌ No layout found for product ${sourceProductId}`);
      return null;
    }
    
    console.log(`✅ Found layout with ${layout.layoutVariants.length} variants`);
    
    // Log all available variants for debugging
    console.log(`Available layout variants:`);
    layout.layoutVariants.forEach((v, index) => {
      console.log(`   [${index}] color="${v.color}", pattern="${v.pattern}", url="${v.baseImageUrl}"`);
    });
    
    // Find the LayoutVariant that matches both color and pattern
    const matchingVariant = layout.layoutVariants.find((variant) => {
      if (variant.color && variant.pattern) {
        const normalizedVariantColor = normalizeColorName(variant.color);
        const normalizedTargetColor = normalizeColorName(color);
        
        const isMatch = normalizedVariantColor === normalizedTargetColor &&
                       variant.pattern.toLowerCase() === pattern.toLowerCase();
        
        if (isMatch) {
          console.log(`   ✅ MATCH: variant color="${variant.color}" (normalized="${normalizedVariantColor}") matches target="${color}" (normalized="${normalizedTargetColor}")`);
        }
        
        return isMatch;
      }
      
      return false;
    });
    
    if (matchingVariant) {
      console.log(`✅ Found exact match for ${color}/${pattern}: ${matchingVariant.baseImageUrl}`);
      return matchingVariant.baseImageUrl;
    }
    
    console.log(`❌ No exact match found for ${color}/${pattern}`);
    
    // If no exact match, try to find a variant with the same pattern but any color
    // This is better than using the master template's color for all variants
    const samePatternVariant = layout.layoutVariants.find((variant) => {
      return variant.pattern && variant.pattern.toLowerCase() === pattern.toLowerCase();
    });
    
    if (samePatternVariant) {
      console.warn(`⚠️ No exact match for ${color}/${pattern}, using same pattern variant: ${samePatternVariant.color}/${samePatternVariant.pattern}`);
      return samePatternVariant.baseImageUrl;
    }
    
    console.warn(`❌ No matching variant found for ${color}/${pattern} in layout`);
    return null;
  } catch (error) {
    console.error(`💥 Error getting base image for ${color}/${pattern}:`, error);
    return null;
  }
}

/**
 * Matches generated templates to their corresponding Shopify variants
 * This should be called after generating color variants to set the correct variant IDs
 */
export async function matchTemplatesToVariants(
  admin: any, 
  shopifyProductId: string, 
  templates: Array<{ id: string; color: string; pattern?: string; variantImage?: string }>,
  masterPattern?: string
) {
  console.log("\n========== START matchTemplatesToVariants DEBUG ==========");
  console.log("Input Parameters:");
  console.log("  - shopifyProductId:", shopifyProductId);
  console.log("  - masterPattern:", masterPattern);
  console.log("  - templates count:", templates.length);
  console.log("  - template colors:", templates.map(t => t.color).join(", "));
  
  // Query Shopify for all variants of the product
  const GET_PRODUCT_VARIANTS = `#graphql
    query GetProductVariants($id: ID!) {
      product(id: $id) {
        id
        title
        variants(first: 100) {
          edges {
            node {
              id
              title
              image {
                url
              }
              selectedOptions {
                name
                value
              }
            }
          }
        }
      }
    }
  `;
  
  try {
    console.log("\nFetching variants from Shopify...");
    const response = await admin.graphql(GET_PRODUCT_VARIANTS, {
      variables: { id: shopifyProductId }
    });
    
    const data = await response.json();
    console.log("\nGraphQL Response:");
    console.log("  - Has product data:", !!data.data?.product);
    console.log("  - Product title:", data.data?.product?.title);
    console.log("  - Product ID from response:", data.data?.product?.id);
    
    const variants = data.data?.product?.variants?.edges || [];
    console.log("  - Variants found:", variants.length);
    
    // Log all variants for debugging
    console.log("\nAll Shopify Variants:");
    variants.forEach((edge: any, index: number) => {
      const colorOption = edge.node.selectedOptions.find((opt: any) => opt.name === "Color");
      const patternOption = edge.node.selectedOptions.find((opt: any) => 
        opt.name === "Edge Pattern" || opt.name === "Pattern"
      );
      console.log(`  [${index}] ID: ${edge.node.id}`);
      console.log(`       Title: ${edge.node.title}`);
      console.log(`       Color: ${colorOption?.value || 'NO COLOR OPTION'}`);
      console.log(`       Pattern: ${patternOption?.value || 'NO PATTERN OPTION'}`);
      console.log(`       All options:`, edge.node.selectedOptions);
    });
    
    // Match templates to variants by BOTH color AND pattern
    console.log("\n--- Starting Template Matching ---");
    for (const template of templates) {
      console.log(`\nLooking for variant match for template:`);
      console.log(`  - Template ID: ${template.id}`);
      console.log(`  - Template Color: ${template.color}`);
      console.log(`  - Template Pattern: ${template.pattern || 'none specified'}`);
      console.log(`  - Using Master Pattern: ${masterPattern || 'none'}`);
      
      let foundMatch = false;
      const matchingVariant = variants.find((edge: any) => {
        const colorOption = edge.node.selectedOptions.find((opt: any) => opt.name === "Color");
        const patternOption = edge.node.selectedOptions.find((opt: any) => 
          opt.name === "Edge Pattern" || opt.name === "Pattern"
        );
        
        console.log(`\n  Checking variant ${edge.node.id}:`);
        console.log(`    - Has color option: ${!!colorOption}`);
        console.log(`    - Has pattern option: ${!!patternOption}`);
        
        if (colorOption && patternOption) {
          const normalizedShopifyColor = normalizeColorName(colorOption.value);
          const normalizedTemplateColor = normalizeColorName(template.color);
          
          console.log(`    - Raw Shopify Color: "${colorOption.value}"`);
          console.log(`    - Normalized Shopify Color: "${normalizedShopifyColor}"`);
          console.log(`    - Raw Template Color: "${template.color}"`);
          console.log(`    - Normalized Template Color: "${normalizedTemplateColor}"`);
          console.log(`    - Colors match: ${normalizedShopifyColor === normalizedTemplateColor}`);
          
          // If template has pattern info, use it; otherwise use masterPattern
          const targetPattern = template.pattern || masterPattern || "";
          console.log(`    - Target Pattern: "${targetPattern}"`);
          console.log(`    - Shopify Pattern: "${patternOption.value}"`);
          console.log(`    - Pattern lowercase comparison: "${patternOption.value.toLowerCase()}" === "${targetPattern.toLowerCase()}"`);
          console.log(`    - Patterns match: ${patternOption.value.toLowerCase() === targetPattern.toLowerCase()}`);
          
          // Match both color and pattern using normalized color names
          const isMatch = normalizedShopifyColor === normalizedTemplateColor &&
                         patternOption.value.toLowerCase() === targetPattern.toLowerCase();
          
          console.log(`    - FINAL MATCH RESULT: ${isMatch}`);
          
          if (isMatch) {
            foundMatch = true;
          }
          
          return isMatch;
        } else {
          console.log(`    - Skipping: Missing color or pattern option`);
        }
        
        return false;
      });
      
      if (matchingVariant) {
        console.log(`\n  ✓ MATCH FOUND! Variant ${matchingVariant.node.id}`);
        
        // Update the template with the correct variant ID and image
        console.log(`  Updating template ${template.id} with shopifyVariantId...`);
        await db.template.update({
          where: { id: template.id },
          data: { 
            shopifyVariantId: matchingVariant.node.id,
            // Store the variant image URL for later use
          },
        });
        
        const patternUsed = template.pattern || masterPattern || "";
        console.log(`  Successfully matched ${template.color}/${patternUsed} template to variant ${matchingVariant.node.id}`);
        
        // Return variant info including image URL for canvas update
        template.variantImage = matchingVariant.node.image?.url;
      } else {
        const patternUsed = template.pattern || masterPattern || "";
        console.log(`\n  ✗ NO MATCH FOUND for ${template.color}/${patternUsed}`);
      }
    }
    
    console.log("\n========== END matchTemplatesToVariants DEBUG ==========\n");
    return templates;
  } catch (error) {
    console.error("ERROR in matchTemplatesToVariants:", error);
    console.error("Error details:", JSON.stringify(error, null, 2));
    console.log("========== END matchTemplatesToVariants DEBUG (WITH ERROR) ==========\n");
    return templates;
  }
}
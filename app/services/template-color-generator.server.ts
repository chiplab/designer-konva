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
  console.log(`Master template color: ${masterTemplate.colorVariant}`);
  
  // Get the source color mapping
  const sourceColor = await db.templateColor.findUnique({
    where: {
      chipColor: masterTemplate.colorVariant.toLowerCase(),
    },
  });
  
  if (!sourceColor) {
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
  
  // Parse the canvas data
  const canvasData = JSON.parse(masterTemplate.canvasData);
  
  // Get all variants for the product to find matching variant IDs
  const { shopifyProductId } = masterTemplate;
  
  // Generate templates for each color
  const createdTemplates = [];
  
  for (const targetColor of targetColors) {
    try {
      // Process canvas data with color replacement
      let newCanvasData = processCanvasElement(canvasData, sourceColor, targetColor);
      
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
          canvasData: JSON.stringify(newCanvasData),
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
  
  // Get ALL pattern-color combinations from the product
  const allCombinations = await getAllPatternColorCombinations(
    admin,
    masterTemplate.shopifyProductId
  );
  
  console.log(`Found ${allCombinations.length} total pattern-color combinations`);
  
  // Get unique patterns
  const patterns = [...new Set(allCombinations.map(c => c.pattern))];
  console.log(`Unique patterns: ${patterns.join(', ')}`);
  
  // Get the source color mapping
  const sourceColor = await db.templateColor.findUnique({
    where: {
      chipColor: masterTemplate.colorVariant.toLowerCase(),
    },
  });
  
  if (!sourceColor) {
    throw new Error(`Color mapping not found for ${masterTemplate.colorVariant}`);
  }
  
  // Parse the master template's canvas data
  const canvasData = JSON.parse(masterTemplate.canvasData);
  const { shopifyProductId } = masterTemplate;
  
  // Generate templates for ALL combinations (excluding the master's own combination)
  const createdTemplates = [];
  const masterColorNormalized = normalizeColorName(masterTemplate.colorVariant);
  
  // Get the master's pattern if it has a variant ID
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
  
  for (const combination of allCombinations) {
    // Skip the master template's own combination
    if (normalizeColorName(combination.color) === masterColorNormalized && 
        combination.pattern.toLowerCase() === masterPattern.toLowerCase()) {
      console.log(`Skipping master template's combination: ${combination.color}/${combination.pattern}`);
      continue;
    }
    
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
      
      // Process canvas data with color replacement
      let newCanvasData = processCanvasElement(canvasData, sourceColor, targetColor);
      
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
      
      // Get the correct base image for this color/pattern combination
      const baseImageUrl = await getBaseImageForVariant(
        admin,
        shopifyProductId,
        combination.color,
        combination.pattern
      );
      
      if (baseImageUrl && newCanvasData.assets) {
        console.log(`Setting base image for ${combination.color}/${combination.pattern}: ${baseImageUrl}`);
        newCanvasData.assets.baseImage = baseImageUrl;
      } else {
        console.warn(`No base image found for ${combination.color}/${combination.pattern}, using fallback`);
      }
      
      // Format the color and pattern names properly
      const formattedColorName = combination.color
        .split(/[\s-_]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      // Create the new template
      const newTemplate = await db.template.create({
        data: {
          name: `${formattedColorName} / ${combination.pattern} Template`,
          shop,
          shopifyProductId,
          shopifyVariantId: null, // Will be updated by matching function
          canvasData: JSON.stringify(newCanvasData),
          masterTemplateId,
          isColorVariant: true,
          // Legacy fields
          productLayoutId: masterTemplate.productLayoutId,
          colorVariant: targetColor.chipColor,
        },
      });
      
      createdTemplates.push({
        id: newTemplate.id,
        color: combination.color,
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
 * Gets the base image URL for a specific color/pattern combination from the source product
 */
async function getBaseImageForVariant(
  admin: any,
  sourceProductId: string,
  color: string,
  pattern: string
): Promise<string | null> {
  const GET_PRODUCT_VARIANTS = `#graphql
    query GetProductVariants($id: ID!) {
      product(id: $id) {
        variants(first: 100) {
          edges {
            node {
              id
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
    const response = await admin.graphql(GET_PRODUCT_VARIANTS, {
      variables: { id: sourceProductId }
    });
    
    const data = await response.json();
    const variants = data.data?.product?.variants?.edges || [];
    
    // Find the variant that matches both color and pattern
    const matchingVariant = variants.find((edge: any) => {
      const colorOption = edge.node.selectedOptions.find((opt: any) => opt.name === "Color");
      const patternOption = edge.node.selectedOptions.find((opt: any) => 
        opt.name === "Edge Pattern" || opt.name === "Pattern"
      );
      
      if (colorOption && patternOption) {
        const normalizedShopifyColor = normalizeColorName(colorOption.value);
        const normalizedTargetColor = normalizeColorName(color);
        
        return normalizedShopifyColor === normalizedTargetColor &&
               patternOption.value.toLowerCase() === pattern.toLowerCase();
      }
      
      return false;
    });
    
    return matchingVariant?.node?.image?.url || null;
  } catch (error) {
    console.error(`Error getting base image for ${color}/${pattern}:`, error);
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
  // Query Shopify for all variants of the product
  const GET_PRODUCT_VARIANTS = `#graphql
    query GetProductVariants($id: ID!) {
      product(id: $id) {
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
    const response = await admin.graphql(GET_PRODUCT_VARIANTS, {
      variables: { id: shopifyProductId }
    });
    
    const data = await response.json();
    const variants = data.data?.product?.variants?.edges || [];
    
    // Match templates to variants by BOTH color AND pattern
    for (const template of templates) {
      console.log(`Looking for variant match for template color: ${template.color}`);
      
      const matchingVariant = variants.find((edge: any) => {
        const colorOption = edge.node.selectedOptions.find((opt: any) => opt.name === "Color");
        const patternOption = edge.node.selectedOptions.find((opt: any) => 
          opt.name === "Edge Pattern" || opt.name === "Pattern"
        );
        
        if (colorOption && patternOption) {
          const normalizedShopifyColor = normalizeColorName(colorOption.value);
          const normalizedTemplateColor = normalizeColorName(template.color);
          
          console.log(`  Comparing: Shopify "${colorOption.value}" (${normalizedShopifyColor}) vs Template "${template.color}" (${normalizedTemplateColor})`);
          
          // If template has pattern info, use it; otherwise use masterPattern
          const targetPattern = template.pattern || masterPattern || "";
          
          // Match both color and pattern using normalized color names
          return normalizedShopifyColor === normalizedTemplateColor &&
                 patternOption.value.toLowerCase() === targetPattern.toLowerCase();
        }
        
        return false;
      });
      
      if (matchingVariant) {
        // Update the template with the correct variant ID and image
        await db.template.update({
          where: { id: template.id },
          data: { 
            shopifyVariantId: matchingVariant.node.id,
            // Store the variant image URL for later use
          },
        });
        
        const patternUsed = template.pattern || masterPattern || "";
        console.log(`Matched ${template.color}/${patternUsed} template to variant ${matchingVariant.node.id}`);
        
        // Return variant info including image URL for canvas update
        template.variantImage = matchingVariant.node.image?.url;
      } else {
        const patternUsed = template.pattern || masterPattern || "";
        console.warn(`No matching variant found for ${template.color}/${patternUsed}`);
      }
    }
    
    return templates;
  } catch (error) {
    console.error("Error matching templates to variants:", error);
    return templates;
  }
}
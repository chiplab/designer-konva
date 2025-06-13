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
  
  // Get the source color mapping
  const sourceColor = await db.templateColor.findUnique({
    where: {
      chipColor: masterTemplate.colorVariant.toLowerCase(),
    },
  });
  
  if (!sourceColor) {
    throw new Error(`Color mapping not found for ${masterTemplate.colorVariant}`);
  }
  
  // Get all other colors
  const targetColors = await db.templateColor.findMany({
    where: {
      chipColor: {
        not: masterTemplate.colorVariant.toLowerCase(),
      },
    },
  });
  
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
      const newTemplate = await db.template.create({
        data: {
          name: masterTemplate.name.replace(
            new RegExp(masterTemplate.colorVariant, 'gi'), 
            targetColor.chipColor.charAt(0).toUpperCase() + targetColor.chipColor.slice(1)
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
 * Matches generated templates to their corresponding Shopify variants
 * This should be called after generating color variants to set the correct variant IDs
 */
export async function matchTemplatesToVariants(
  admin: any, 
  shopifyProductId: string, 
  templates: Array<{ id: string; color: string; variantImage?: string }>,
  masterPattern: string
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
      const matchingVariant = variants.find((edge: any) => {
        const colorOption = edge.node.selectedOptions.find((opt: any) => opt.name === "Color");
        const patternOption = edge.node.selectedOptions.find((opt: any) => 
          opt.name === "Edge Pattern" || opt.name === "Pattern"
        );
        
        // Match both color and pattern
        return colorOption && 
               colorOption.value.toLowerCase() === template.color.toLowerCase() &&
               patternOption && 
               patternOption.value.toLowerCase() === masterPattern.toLowerCase();
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
        
        console.log(`Matched ${template.color}/${masterPattern} template to variant ${matchingVariant.node.id}`);
        
        // Return variant info including image URL for canvas update
        template.variantImage = matchingVariant.node.image?.url;
      } else {
        console.warn(`No matching variant found for ${template.color}/${masterPattern}`);
      }
    }
    
    return templates;
  } catch (error) {
    console.error("Error matching templates to variants:", error);
    return templates;
  }
}
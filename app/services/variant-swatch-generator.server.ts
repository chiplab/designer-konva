import db from "../db.server";
import { uploadBase64ImageToS3 } from "./s3.server";

interface SwatchGenerationOptions {
  template: {
    id: string;
    canvasData: string;
    frontCanvasData: string | null;
    backCanvasData: string | null;
    shop: string;
  };
  variantId: string;
  variantColor: string;
  customization: {
    textUpdates?: Record<string, string>;
    canvasState?: any;
  };
  options: {
    size: number;
    quality: number;
    side: 'front' | 'back';
  };
}

/**
 * Generates a swatch for a specific variant with customization applied
 * Returns a base64 data URL
 */
export async function generateVariantSwatch({
  template,
  variantId,
  variantColor,
  customization,
  options
}: SwatchGenerationOptions): Promise<string | null> {
  console.log(`[Swatch Generator] Starting generation for variant ${variantId} (${variantColor})`);
  
  // Save original global state
  const originalGlobals = {
    window: global.window,
    document: global.document,
    HTMLCanvasElement: global.HTMLCanvasElement,
    HTMLImageElement: global.HTMLImageElement,
    Image: global.Image,
    Konva: global.Konva,
    devicePixelRatio: global.devicePixelRatio,
  };
  
  try {
    // First, try to find the variant-specific template
    // Convert numeric variant ID to Shopify GID format
    const variantGid = `gid://shopify/ProductVariant/${variantId}`;
    
    const variantTemplate = await db.template.findFirst({
      where: {
        shopifyVariantId: variantGid,
        shop: template.shop
      },
      select: {
        id: true,
        canvasData: true,
        frontCanvasData: true,
        backCanvasData: true,
      }
    });
    
    // Use variant template if found, otherwise fall back to master template
    const templateToUse = variantTemplate || template;
    
    if (variantTemplate) {
      console.log(`[Swatch Generator] Found variant-specific template ${variantTemplate.id} for variant ${variantGid}`);
    } else {
      console.log(`[Swatch Generator] No variant-specific template found for ${variantGid}, using master template ${template.id}`);
    }
    
    // Determine which canvas data to use
    let canvasDataToUse: string;
    
    // If we have a full canvas state from customization, use that
    if (customization.canvasState) {
      canvasDataToUse = typeof customization.canvasState === 'string' 
        ? customization.canvasState 
        : JSON.stringify(customization.canvasState);
    } else if (options.side === 'front' && templateToUse.frontCanvasData) {
      canvasDataToUse = templateToUse.frontCanvasData;
    } else if (options.side === 'back' && templateToUse.backCanvasData) {
      canvasDataToUse = templateToUse.backCanvasData;
    } else {
      canvasDataToUse = templateToUse.canvasData;
    }
    
    let state = JSON.parse(canvasDataToUse);
    
    // Apply text customizations if provided
    if (customization.textUpdates) {
      state = applyTextCustomizations(state, customization.textUpdates);
    }
    
    // Generate the swatch using server-side rendering
    const dataUrl = await renderSwatch(state, options.size, options.quality);
    
    return dataUrl;
    
  } catch (error) {
    console.error(`[Swatch Generator] Error generating swatch for variant ${variantId}:`, error);
    console.error(`[Swatch Generator] Stack trace:`, error instanceof Error ? error.stack : 'No stack trace');
    return null;
  } finally {
    // Restore original global state
    Object.keys(originalGlobals).forEach(key => {
      if (originalGlobals[key] === undefined) {
        delete global[key];
      } else {
        global[key] = originalGlobals[key];
      }
    });
  }
}


/**
 * Apply text customizations to canvas state
 */
function applyTextCustomizations(state: any, textUpdates: Record<string, string>): any {
  const newState = JSON.parse(JSON.stringify(state));
  
  console.log('[Swatch Generator] Applying text customizations. Available updates:', Object.keys(textUpdates));
  
  // Update text elements
  if (newState.elements) {
    ['textElements', 'curvedTextElements', 'gradientTextElements'].forEach(elementType => {
      if (newState.elements[elementType]) {
        newState.elements[elementType].forEach((element: any) => {
          let textApplied = false;
          
          // Try direct match first
          if (textUpdates[element.id]) {
            console.log(`[Swatch Generator] Direct match found for ${element.id}, updating text to: "${textUpdates[element.id]}"`);
            element.text = textUpdates[element.id];
            textApplied = true;
          } 
          // Try with front_ prefix
          else if (textUpdates[`front_${element.id}`]) {
            console.log(`[Swatch Generator] Front prefix match found for ${element.id}, updating text to: "${textUpdates[`front_${element.id}`]}"`);
            element.text = textUpdates[`front_${element.id}`];
            textApplied = true;
          }
          // Try with back_ prefix
          else if (textUpdates[`back_${element.id}`]) {
            console.log(`[Swatch Generator] Back prefix match found for ${element.id}, updating text to: "${textUpdates[`back_${element.id}`]}"`);
            element.text = textUpdates[`back_${element.id}`];
            textApplied = true;
          }
          
          if (!textApplied) {
            console.log(`[Swatch Generator] No match found for element ${element.id} in ${elementType}. Current text: "${element.text}"`);
          }
        });
      }
    });
  }
  
  return newState;
}

/**
 * Helper function to safely load images
 */
async function loadImageSafely(url: string): Promise<any> {
  const { loadImage } = await import('@napi-rs/canvas');
  const path = await import('path');
  const fs = await import('fs/promises');
  
  try {
    if (url.startsWith('/')) {
      // Local image - try file system
      const publicPath = path.join(process.cwd(), 'public', url);
      console.log('[Swatch Renderer] Trying to load local image:', publicPath);
      
      // Check if file exists
      await fs.access(publicPath);
      const img = await loadImage(publicPath);
      console.log('[Swatch Renderer] Successfully loaded local image, dimensions:', img.width, 'x', img.height);
      return img;
    } else {
      // External URL (S3, etc.)
      console.log('[Swatch Renderer] Loading external image:', url);
      const img = await loadImage(url);
      console.log('[Swatch Renderer] Successfully loaded external image, dimensions:', img.width, 'x', img.height);
      return img;
    }
  } catch (error) {
    console.error('[Swatch Renderer] Failed to load image:', url, error);
    return null;
  }
}

/**
 * Render the swatch using server-side Konva
 */
async function renderSwatch(state: any, size: number, quality: number): Promise<string> {
  console.log(`[Swatch Renderer] Starting render with size ${size}x${size}, quality ${quality}`);
  console.log(`[Swatch Renderer] State dimensions:`, state.dimensions);
  console.log(`[Swatch Renderer] Base image:`, state.assets?.baseImage);
  
  // Dynamically import server-only dependencies
  const { createCanvas } = await import('@napi-rs/canvas');
  const Konva = (await import('konva')).default;
  
  // Set up more complete globals for Konva
  global.window = {
    devicePixelRatio: 1,
    matchMedia: () => ({
      matches: false,
      addListener: () => {},
      removeListener: () => {},
    }),
  } as any;
  
  global.document = {
    createElement: (tagName: string) => {
      if (tagName === 'canvas') {
        const c = createCanvas(1, 1);
        (c as any).style = {};
        return c;
      }
      return {
        style: {},
        addEventListener: () => {},
        removeEventListener: () => {},
        getContext: () => null,
      };
    },
    documentElement: {
      style: {},
      addEventListener: () => {},
      removeEventListener: () => {},
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  } as any;
  
  // Configure Konva for server-side
  (Konva as any).Util.createCanvasElement = () => {
    const c = createCanvas(1, 1);
    // Add style object with padding property
    (c as any).style = {
      padding: 0,
      margin: 0,
      border: 0,
      background: 'transparent',
      position: 'absolute',
      top: 0,
      left: 0,
    };
    return c;
  };
  
  // Create Konva stage at original size
  const originalWidth = state.dimensions.width;
  const originalHeight = state.dimensions.height;
  const scale = size / Math.max(originalWidth, originalHeight);
  
  // Create stage without container
  const stage = new Konva.Stage({
    width: size,
    height: size,
  });
  
  const layer = new Konva.Layer();
  stage.add(layer);
  
  // Render base image FIRST (bottom layer)
  if (state.assets?.baseImage) {
    try {
      console.log(`[Swatch Renderer] Loading base image: ${state.assets.baseImage}`);
      const baseImg = await loadImageSafely(state.assets.baseImage);
      if (baseImg) {
        console.log(`[Swatch Renderer] Creating Konva.Image with base image`);
        const baseImage = new Konva.Image({
          x: 0,
          y: 0,
          image: baseImg,
          width: originalWidth,
          height: originalHeight,
          scaleX: scale,
          scaleY: scale,
        });
        layer.add(baseImage);
        console.log(`[Swatch Renderer] Base image added to layer`);
      }
    } catch (error) {
      console.error(`[Swatch Renderer] Failed to load base image:`, error);
    }
  }
  
  // Create clipping group for designable area if it exists
  let contentGroup = layer;
  if (state.designableArea && state.designableArea.visible) {
    const clipGroup = new Konva.Group({
      clipFunc: (ctx: any) => {
        const { x, y, width, height, cornerRadius } = state.designableArea;
        
        ctx.beginPath();
        if (cornerRadius > 0) {
          ctx.moveTo(x * scale + cornerRadius * scale, y * scale);
          ctx.arcTo(x * scale + width * scale, y * scale, x * scale + width * scale, y * scale + height * scale, cornerRadius * scale);
          ctx.arcTo(x * scale + width * scale, y * scale + height * scale, x * scale, y * scale + height * scale, cornerRadius * scale);
          ctx.arcTo(x * scale, y * scale + height * scale, x * scale, y * scale, cornerRadius * scale);
          ctx.arcTo(x * scale, y * scale, x * scale + width * scale, y * scale, cornerRadius * scale);
        } else {
          ctx.rect(x * scale, y * scale, width * scale, height * scale);
        }
        ctx.closePath();
      },
    });
    layer.add(clipGroup);
    contentGroup = clipGroup;
  }
  
  // Render background inside the designable area
  if (state.backgroundColor && state.backgroundColor !== 'transparent' && state.designableArea) {
    let bgConfig: any = {
      x: state.designableArea.x * scale,
      y: state.designableArea.y * scale,
      width: state.designableArea.width * scale,
      height: state.designableArea.height * scale,
      cornerRadius: (state.designableArea.cornerRadius || 0) * scale,
    };
    
    if (state.backgroundColor === 'linear-gradient' && state.backgroundGradient) {
      bgConfig = {
        ...bgConfig,
        fillLinearGradientStartPoint: { x: 0, y: 0 },
        fillLinearGradientEndPoint: { x: state.designableArea.width * scale, y: 0 },
        fillLinearGradientColorStops: state.backgroundGradient.colorStops || [0, '#c8102e', 1, '#ffaaaa'],
      };
    } else if (state.backgroundColor === 'radial-gradient' && state.backgroundGradient) {
      bgConfig = {
        ...bgConfig,
        fillRadialGradientStartPoint: { x: state.designableArea.width * scale / 2, y: state.designableArea.height * scale / 2 },
        fillRadialGradientEndPoint: { x: state.designableArea.width * scale / 2, y: state.designableArea.height * scale / 2 },
        fillRadialGradientStartRadius: 0,
        fillRadialGradientEndRadius: Math.min(state.designableArea.width, state.designableArea.height) * scale / 2,
        fillRadialGradientColorStops: state.backgroundGradient.colorStops || [0, '#c8102e', 1, '#ffaaaa'],
      };
    } else {
      bgConfig.fill = state.backgroundColor;
    }
    
    const bg = new Konva.Rect(bgConfig);
    contentGroup.add(bg);
  }
  
  // Render elements
  if (state.elements) {
    // Text elements
    if (state.elements.textElements) {
      state.elements.textElements.forEach((element: any) => {
        // Handle special fills
        let fillConfig: any = {};
        if (element.fill === 'gold-gradient') {
          fillConfig = {
            fillLinearGradientStartPoint: { x: 0, y: 0 },
            fillLinearGradientEndPoint: { x: 0, y: (element.fontSize || 24) * scale },
            fillLinearGradientColorStops: [0, '#FFD700', 0.5, '#FFA500', 1, '#B8860B'],
          };
        } else {
          fillConfig = { fill: element.fill || 'black' };
        }
        
        const text = new Konva.Text({
          x: element.x * scale,
          y: element.y * scale,
          text: element.text,
          fontSize: (element.fontSize || 24) * scale,
          fontFamily: element.fontFamily || 'Arial',
          fontStyle: element.fontWeight === 'bold' ? 'bold' : 'normal',
          stroke: element.stroke,
          strokeWidth: (element.strokeWidth || 0) * scale,
          fillAfterStrokeEnabled: true,
          rotation: element.rotation || 0,
          scaleX: element.scaleX || 1,
          scaleY: element.scaleY || 1,
          ...fillConfig,
        });
        contentGroup.add(text);
      });
    }
    
    // Curved text elements
    if (state.elements.curvedTextElements) {
      state.elements.curvedTextElements.forEach((element: any) => {
        // Calculate center position based on flip state
        const centerY = element.flipped ? element.topY - element.radius : element.topY + element.radius;
        
        // Calculate text length and angle span
        const fontSize = element.fontSize || 20;
        const textLength = element.text.length * fontSize * 0.6;
        const circumference = 2 * Math.PI * element.radius;
        const angleSpan = Math.min((textLength / circumference) * 2 * Math.PI, 1.5 * Math.PI);
        
        // Calculate angles based on flip state
        let startAngle, endAngle, sweepFlag;
        
        if (!element.flipped) {
          // Normal text (curves upward)
          startAngle = -Math.PI / 2 - angleSpan / 2;
          endAngle = -Math.PI / 2 + angleSpan / 2;
          sweepFlag = 1;
        } else {
          // Flipped text (curves downward)
          startAngle = Math.PI / 2 + angleSpan / 2;
          endAngle = Math.PI / 2 - angleSpan / 2;
          sweepFlag = 0;
        }
        
        // Calculate path coordinates
        const startX = Math.cos(startAngle) * element.radius;
        const startY = Math.sin(startAngle) * element.radius;
        const endX = Math.cos(endAngle) * element.radius;
        const endY = Math.sin(endAngle) * element.radius;
        
        // Create SVG path data
        const largeArcFlag = angleSpan > Math.PI ? 1 : 0;
        const pathData = `M ${startX},${startY} A ${element.radius},${element.radius} 0 ${largeArcFlag},${sweepFlag} ${endX},${endY}`;
        
        // Handle special fills
        let fillConfig: any = {};
        if (element.fill === 'gold-gradient') {
          fillConfig = {
            fillLinearGradientStartPoint: { x: 0, y: 0 },
            fillLinearGradientEndPoint: { x: 0, y: fontSize * scale },
            fillLinearGradientColorStops: [0, '#FFD700', 0.5, '#FFA500', 1, '#B8860B'],
          };
        } else {
          fillConfig = { fill: element.fill || 'black' };
        }
        
        // Create a group positioned at the center
        const curvedTextGroup = new Konva.Group({
          x: element.x * scale,
          y: centerY * scale,
          rotation: element.rotation || 0,
          scaleX: element.scaleX || 1,
          scaleY: element.scaleY || 1,
        });
        
        // Create TextPath for curved text
        const textPath = new Konva.TextPath({
          text: element.text,
          data: pathData,
          fontSize: fontSize * scale,
          fontFamily: element.fontFamily || 'Arial',
          fontStyle: element.fontWeight === 'bold' ? 'bold' : 'normal',
          align: 'center',
          stroke: element.stroke,
          strokeWidth: (element.strokeWidth || 0) * scale,
          fillAfterStrokeEnabled: true,
          ...fillConfig,
        });
        
        curvedTextGroup.add(textPath);
        contentGroup.add(curvedTextGroup);
      });
    }
    
    // User images
    if (state.elements.imageElements) {
      for (const element of state.elements.imageElements) {
        try {
          const userImg = await loadImageSafely(element.url);
          if (userImg) {
            const image = new Konva.Image({
              x: element.x * scale,
              y: element.y * scale,
              image: userImg,
              width: element.width * scale,
              height: element.height * scale,
              rotation: element.rotation || 0,
            });
            contentGroup.add(image);
          }
        } catch (error) {
          console.error(`[Swatch Renderer] Failed to load user image:`, error);
        }
      }
    }
    
    // Shape elements
    if (state.elements.shapeElements) {
      state.elements.shapeElements.forEach((element: any) => {
        const commonProps = {
          x: (element.x + (element.width || 0) / 2) * scale, // Center-based positioning
          y: (element.y + (element.height || 0) / 2) * scale,
          fill: element.fill || '#ffffff',
          stroke: element.stroke || '#000000',
          strokeWidth: element.stroke ? ((element.strokeWidth || 2) * scale) : 0,
          rotation: element.rotation || 0,
          scaleX: element.scaleX || 1,
          scaleY: element.scaleY || 1,
        };
        
        if (element.type === 'rect') {
          const rect = new Konva.Rect({
            ...commonProps,
            width: element.width * scale,
            height: element.height * scale,
            offsetX: (element.width * scale) / 2,
            offsetY: (element.height * scale) / 2,
          });
          contentGroup.add(rect);
        } else if (element.type === 'ellipse') {
          const ellipse = new Konva.Ellipse({
            ...commonProps,
            radiusX: (element.width * scale) / 2,
            radiusY: (element.height * scale) / 2,
          });
          contentGroup.add(ellipse);
        } else if (element.type === 'ring') {
          const ring = new Konva.Ring({
            ...commonProps,
            innerRadius: (element.innerRadius || 25) * scale,
            outerRadius: (element.outerRadius || 50) * scale,
          });
          contentGroup.add(ring);
        }
      });
    }
  }
  
  // Render to canvas
  layer.draw();
  
  // Get the actual canvas that Konva drew to
  const layerCanvas = layer.getCanvas();
  const actualCanvas = (layerCanvas as any)._canvas;
  
  if (!actualCanvas) {
    throw new Error('No canvas found on layer after drawing');
  }
  
  // Convert to JPEG data URL
  const buffer = actualCanvas.toBuffer('image/jpeg', { quality });
  const base64 = buffer.toString('base64');
  
  return `data:image/jpeg;base64,${base64}`;
}
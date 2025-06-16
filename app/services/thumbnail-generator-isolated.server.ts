/**
 * Isolated thumbnail generator that loads Konva/Canvas dependencies
 * This file should be dynamically imported to avoid polluting the global context
 */

// This function will only be called after dynamic import
export async function generateThumbnailFromCanvas(canvasData: string): Promise<Buffer> {
  // Dynamically import dependencies to isolate them
  const { createCanvas, loadImage } = await import('@napi-rs/canvas');
  const Konva = (await import('konva')).default;
  const path = await import('path');
  const fs = await import('fs/promises');
  
  // Parse canvas data
  const data = JSON.parse(canvasData);
  
  // Helper function to safely load images
  async function loadImageSafely(url: string): Promise<any> {
    try {
      if (url.startsWith('/')) {
        // Local image - try file system
        const publicPath = path.join(process.cwd(), 'public', url);
        console.log('Trying to load local image:', publicPath);
        
        // Check if file exists
        await fs.access(publicPath);
        const img = await loadImage(publicPath);
        console.log('Successfully loaded local image, dimensions:', img.width, 'x', img.height);
        return img;
      } else {
        // External URL (S3, etc.)
        console.log('Loading external image:', url);
        const img = await loadImage(url);
        console.log('Successfully loaded external image, dimensions:', img.width, 'x', img.height);
        return img;
      }
    } catch (error) {
      console.error('Failed to load image:', url, error);
      return null;
    }
  }
  
  // Set up minimal globals for Konva (only for this function scope)
  const originalWindow = global.window;
  const originalDocument = global.document;
  
  try {
    // Create minimal window/document for Konva
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
    
    // Create stage
    const stage = new Konva.Stage({
      width: data.dimensions.width,
      height: data.dimensions.height,
    });
  
  // Create layer
  const layer = new Konva.Layer();
  stage.add(layer);
  
  // Add background
  if (data.backgroundColor && data.backgroundColor !== 'transparent') {
    const background = new Konva.Rect({
      x: 0,
      y: 0,
      width: data.dimensions.width,
      height: data.dimensions.height,
      fill: data.backgroundColor === 'linear-gradient' ? undefined : data.backgroundColor,
    });
    
    if (data.backgroundColor === 'linear-gradient' && data.backgroundGradient) {
      const gradient = {
        start: { x: 0, y: 0 },
        end: { x: 0, y: data.dimensions.height },
        colorStops: data.backgroundGradient.colorStops,
      };
      background.fillLinearGradientStartPoint(gradient.start);
      background.fillLinearGradientEndPoint(gradient.end);
      background.fillLinearGradientColorStops(gradient.colorStops);
    }
    
    layer.add(background);
  }
  
  // Add designable area if visible
  if (data.designableArea?.visible) {
    const designArea = new Konva.Rect({
      x: data.designableArea.x,
      y: data.designableArea.y,
      width: data.designableArea.width,
      height: data.designableArea.height,
      fill: '#f0f0f0',
      cornerRadius: data.designableArea.cornerRadius || 0,
    });
    layer.add(designArea);
  }
  
  // Create clip group for designable area
  const clipGroup = new Konva.Group({
    x: data.designableArea?.x || 0,
    y: data.designableArea?.y || 0,
    clip: data.designableArea ? {
      x: 0,
      y: 0,
      width: data.designableArea.width,
      height: data.designableArea.height,
    } : undefined,
  });
  layer.add(clipGroup);
  
  // Add base image if present
  if (data.assets?.baseImage) {
    try {
      console.log("Loading base image:", data.assets.baseImage);
      const imageObj = await loadImage(data.assets.baseImage);
      const konvaImage = new Konva.Image({
        x: 0,
        y: 0,
        image: imageObj as any,
        width: data.designableArea?.width || data.dimensions.width,
        height: data.designableArea?.height || data.dimensions.height,
      });
      clipGroup.add(konvaImage);
      console.log("Base image added to clip group");
    } catch (error) {
      console.error("Error loading base image:", error);
    }
  }
  
  // Add text elements
  if (data.elements?.textElements) {
    for (const textEl of data.elements.textElements) {
      const text = new Konva.Text({
        x: textEl.x,
        y: textEl.y,
        text: textEl.text,
        fontSize: textEl.fontSize || 16,
        fontFamily: textEl.fontFamily || 'Arial',
        fill: textEl.fill || '#000000',
        rotation: textEl.rotation || 0,
        scaleX: textEl.scaleX || 1,
        scaleY: textEl.scaleY || 1,
      });
      clipGroup.add(text);
    }
  }
  
  // Add gradient text elements
  if (data.elements?.gradientTextElements) {
    for (const textEl of data.elements.gradientTextElements) {
      const text = new Konva.Text({
        x: textEl.x,
        y: textEl.y,
        text: textEl.text,
        fontSize: textEl.fontSize || 16,
        fontFamily: textEl.fontFamily || 'Arial',
        rotation: textEl.rotation || 0,
        scaleX: textEl.scaleX || 1,
        scaleY: textEl.scaleY || 1,
        fillLinearGradientStartPoint: { x: 0, y: 0 },
        fillLinearGradientEndPoint: { x: 0, y: textEl.fontSize || 30 },
        fillLinearGradientColorStops: [0, '#FFD700', 0.5, '#FFA500', 1, '#B8860B'],
      });
      clipGroup.add(text);
    }
  }
  
  // Add image elements
  if (data.elements?.imageElements) {
    for (const imgEl of data.elements.imageElements) {
      if (imgEl.url) {
        try {
          console.log("Loading user image:", imgEl.url);
          const imageObj = await loadImage(imgEl.url);
          const image = new Konva.Image({
            x: imgEl.x,
            y: imgEl.y,
            image: imageObj as any,
            width: imgEl.width,
            height: imgEl.height,
            rotation: imgEl.rotation || 0,
          });
          clipGroup.add(image);
          console.log("User image added to clip group");
        } catch (error) {
          console.error("Error loading user image:", error);
        }
      }
    }
  }
  
  // Add curved text elements
  if (data.elements?.curvedTextElements) {
    for (const curvedEl of data.elements.curvedTextElements) {
      console.log("Rendering curved text element:", curvedEl.text, " zIndex:", curvedEl.zIndex);
      // For simplicity in thumbnails, render curved text as regular text
      // (Full curved text rendering would require more complex SVG path generation)
      const text = new Konva.Text({
        x: curvedEl.x,
        y: curvedEl.topY,
        text: curvedEl.text,
        fontSize: curvedEl.fontSize || 16,
        fontFamily: curvedEl.fontFamily || 'Arial',
        fill: curvedEl.fill || '#000000',
        rotation: curvedEl.rotation || 0,
        scaleX: curvedEl.scaleX || 1,
        scaleY: curvedEl.scaleY || 1,
      });
      clipGroup.add(text);
    }
  }
  
    // Draw the layer
    console.log("Drawing layer...");
    layer.draw();
    
    // Get the actual canvas that Konva drew to
    console.log("Converting to buffer...");
    const layerCanvas = layer.getCanvas();
    const actualCanvas = (layerCanvas as any)._canvas;
    
    if (!actualCanvas) {
      throw new Error('No canvas found on layer after drawing');
    }
    
    console.log("Using Konva's canvas for buffer");
    const buffer = actualCanvas.toBuffer('image/png');
  
    // Clean up
    stage.destroy();
    
    return buffer;
    
  } finally {
    // CRITICAL: Restore original globals to prevent pollution
    global.window = originalWindow;
    global.document = originalDocument;
  }
}
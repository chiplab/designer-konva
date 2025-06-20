/**
 * Generates a thumbnail for a template using server-side Konva rendering
 * Based on the proven implementation from api.test-template-render.tsx
 * 
 * IMPORTANT: This function uses browser-like APIs that can contaminate the Node.js environment.
 * It should only be called in isolated contexts (like separate worker processes).
 */
export async function generateTemplateThumbnail(
  canvasData: string,
  shop: string,
  templateId: string
): Promise<string | null> {
  // Save ALL original global state to ensure complete restoration
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
    const state = JSON.parse(canvasData);
    const { width, height } = state.dimensions;
    
    // Dynamically import server-only dependencies
    const { createCanvas, loadImage } = await import('@napi-rs/canvas');
    const Konva = (await import('konva')).default;
    const path = await import('path');
    const fs = await import('fs/promises');
    
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
    
    // Create canvas
    const canvas = createCanvas(width, height);
    // Add style object to canvas
    (canvas as any).style = {
      padding: 0,
      margin: 0,
      border: 0,
      background: 'transparent',
      position: 'absolute',
      top: 0,
      left: 0,
    };
    
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
    
    // Create stage without container
    console.log('Creating Konva stage for thumbnail...');
    let stage, layer;
    
    try {
      stage = new Konva.Stage({
        width,
        height,
      });
      console.log('Stage created successfully');
      
      layer = new Konva.Layer();
      console.log('Layer created successfully');
      
      stage.add(layer);
      console.log('Layer added to stage');
    } catch (stageError) {
      console.error('Error creating stage/layer:', stageError);
      throw stageError;
    }
    
    // Load and render base image FIRST (bottom layer)
    if (state.assets?.baseImage) {
      console.log('Loading base image:', state.assets.baseImage);
      
      const baseImg = await loadImageSafely(state.assets.baseImage);
      if (baseImg) {
        console.log('Creating Konva.Image with base image');
        try {
          const baseImage = new Konva.Image({
            x: 0,
            y: 0,
            image: baseImg,
            width: width,
            height: height,
          });
          layer.add(baseImage);
          console.log('Base image added to layer');
        } catch (error) {
          console.error('Failed to create Konva.Image for base image:', error);
        }
      }
    }
    
    // Create clipping group for designable area
    const clipGroup = new Konva.Group({
      clipFunc: (ctx: any) => {
        const { x, y, width, height, cornerRadius } = state.designableArea;
        
        ctx.beginPath();
        if (cornerRadius > 0) {
          ctx.moveTo(x + cornerRadius, y);
          ctx.arcTo(x + width, y, x + width, y + height, cornerRadius);
          ctx.arcTo(x + width, y + height, x, y + height, cornerRadius);
          ctx.arcTo(x, y + height, x, y, cornerRadius);
          ctx.arcTo(x, y, x + width, y, cornerRadius);
        } else {
          ctx.rect(x, y, width, height);
        }
        ctx.closePath();
      },
    });
    layer.add(clipGroup);
    
    // Render background INSIDE the clipped group
    console.log('Background color value:', state.backgroundColor);
    
    if (state.backgroundColor && state.backgroundColor !== 'transparent') {
      let bgConfig: any = {
        x: state.designableArea.x,
        y: state.designableArea.y,
        width: state.designableArea.width,
        height: state.designableArea.height,
        cornerRadius: state.designableArea.cornerRadius || 0,
      };
      
      if (state.backgroundColor === 'linear-gradient') {
        bgConfig = {
          ...bgConfig,
          fillLinearGradientStartPoint: { x: 0, y: 0 },
          fillLinearGradientEndPoint: { x: state.designableArea.width, y: 0 },
          fillLinearGradientColorStops: state.backgroundGradient?.type === 'linear' && state.backgroundGradient?.colorStops ? 
            state.backgroundGradient.colorStops : [0, '#c8102e', 1, '#ffaaaa'],
        };
      } else if (state.backgroundColor === 'radial-gradient') {
        bgConfig = {
          ...bgConfig,
          fillRadialGradientStartPoint: { x: state.designableArea.width / 2, y: state.designableArea.height / 2 },
          fillRadialGradientEndPoint: { x: state.designableArea.width / 2, y: state.designableArea.height / 2 },
          fillRadialGradientStartRadius: 0,
          fillRadialGradientEndRadius: Math.min(state.designableArea.width, state.designableArea.height) / 2,
          fillRadialGradientColorStops: state.backgroundGradient?.type === 'radial' && state.backgroundGradient?.colorStops ? 
            state.backgroundGradient.colorStops : [0, '#c8102e', 1, '#ffaaaa'],
        };
      } else {
        bgConfig.fill = state.backgroundColor;
      }
      
      const bg = new Konva.Rect(bgConfig);
      clipGroup.add(bg);
    }
    
    // Collect all elements into a single array with their types
    const allElements: any[] = [];
    
    // Add elements with proper z-index handling
    let defaultZIndex = 0;
    
    // Add image elements first (usually background)
    state.elements.imageElements?.forEach((element: any) => {
      allElements.push({ 
        ...element, 
        type: 'image',
        zIndex: element.zIndex !== undefined ? element.zIndex : defaultZIndex++
      });
    });
    
    // Add text elements
    state.elements.textElements?.forEach((element: any) => {
      allElements.push({ 
        ...element, 
        type: 'text',
        zIndex: element.zIndex !== undefined ? element.zIndex : defaultZIndex++
      });
    });
    
    // Add curved text elements
    state.elements.curvedTextElements?.forEach((element: any) => {
      allElements.push({ 
        ...element, 
        type: 'curvedText',
        zIndex: element.zIndex !== undefined ? element.zIndex : defaultZIndex++
      });
    });
    
    // Add gradient text elements if they exist
    state.elements.gradientTextElements?.forEach((element: any) => {
      allElements.push({ 
        ...element, 
        type: 'gradientText',
        zIndex: element.zIndex !== undefined ? element.zIndex : defaultZIndex++
      });
    });
    
    // Sort by zIndex (lower values render first)
    allElements.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    
    console.log('Rendering elements in z-order:', allElements.map(el => ({
      type: el.type,
      zIndex: el.zIndex || 0,
      text: el.text || el.url
    })));
    
    // Render all elements in sorted order
    for (const element of allElements) {
      if (element.type === 'text') {
        console.log('Rendering text element:', element.text, 'zIndex:', element.zIndex || 0);
        
        // Handle special fills
        let fillConfig: any = {};
        if (element.fill === 'gold-gradient') {
          fillConfig = {
            fillLinearGradientStartPoint: { x: 0, y: 0 },
            fillLinearGradientEndPoint: { x: 0, y: element.fontSize || 24 },
            fillLinearGradientColorStops: [0, '#FFD700', 0.5, '#FFA500', 1, '#B8860B'],
          };
        } else {
          fillConfig = { fill: element.fill || 'black' };
        }
        
        const text = new Konva.Text({
          x: element.x,
          y: element.y,
          text: element.text,
          fontSize: element.fontSize || 24,
          fontFamily: element.fontFamily || 'Arial',
          fontStyle: element.fontWeight === 'bold' ? 'bold' : 'normal',
          stroke: element.stroke,
          strokeWidth: element.strokeWidth,
          fillAfterStrokeEnabled: true,
          rotation: element.rotation || 0,
          scaleX: element.scaleX || 1,
          scaleY: element.scaleY || 1,
          ...fillConfig,
        });
        clipGroup.add(text);
      } else if (element.type === 'curvedText') {
        console.log('Rendering curved text element:', element.text, 'zIndex:', element.zIndex || 0);
        
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
            fillLinearGradientEndPoint: { x: 0, y: fontSize },
            fillLinearGradientColorStops: [0, '#FFD700', 0.5, '#FFA500', 1, '#B8860B'],
          };
        } else {
          fillConfig = { fill: element.fill || 'black' };
        }
        
        // Create a group positioned at the center
        const curvedTextGroup = new Konva.Group({
          x: element.x,
          y: centerY,
          rotation: element.rotation || 0,
          scaleX: element.scaleX || 1,
          scaleY: element.scaleY || 1,
        });
        
        // Create TextPath for curved text
        const textPath = new Konva.TextPath({
          text: element.text,
          data: pathData,
          fontSize: fontSize,
          fontFamily: element.fontFamily || 'Arial',
          fontStyle: element.fontWeight === 'bold' ? 'bold' : 'normal',
          align: 'center',
          stroke: element.stroke,
          strokeWidth: element.strokeWidth,
          fillAfterStrokeEnabled: true,
          ...fillConfig,
        });
        
        curvedTextGroup.add(textPath);
        clipGroup.add(curvedTextGroup);
      } else if (element.type === 'image') {
        console.log('Loading user image:', element.url, 'zIndex:', element.zIndex || 0);
        const userImg = await loadImageSafely(element.url);
        
        if (userImg) {
          try {
            const image = new Konva.Image({
              x: element.x,
              y: element.y,
              image: userImg,
              width: element.width,
              height: element.height,
              rotation: element.rotation || 0,
            });
            clipGroup.add(image);
            console.log('User image added to clip group');
          } catch (error) {
            console.error('Failed to create Konva.Image for user image:', error);
          }
        }
      }
    }
    
    // Draw everything
    console.log('Drawing layer...');
    layer.draw();
    
    // Get the actual canvas that Konva drew to
    console.log('Converting to buffer...');
    const layerCanvas = layer.getCanvas();
    const actualCanvas = (layerCanvas as any)._canvas;
    
    if (!actualCanvas) {
      throw new Error('No canvas found on layer after drawing');
    }
    
    console.log('Using Konva\'s canvas for buffer');
    const buffer = actualCanvas.toBuffer('image/png');
    const base64 = buffer.toString('base64');
    
    // Import S3 service dynamically
    const { uploadBase64ImageToS3 } = await import('./s3.server');
    
    // Upload to S3
    const s3Key = `templates/${shop}/${templateId}/thumbnail-${Date.now()}.png`;
    const s3Url = await uploadBase64ImageToS3(s3Key, base64, 'image/png');
    
    console.log('Template thumbnail generated and uploaded:', s3Url);
    return s3Url;
    
  } catch (error) {
    console.error('Error generating template thumbnail:', error);
    return null;
  } finally {
    // Restore ALL original global state to prevent contamination
    Object.keys(originalGlobals).forEach(key => {
      if (originalGlobals[key] === undefined) {
        delete global[key];
      } else {
        global[key] = originalGlobals[key];
      }
    });
    
    // Also clean up any additional globals that might have been created
    const additionalGlobals = ['navigator', 'screen', 'location', 'history'];
    additionalGlobals.forEach(key => {
      if (global[key] && !originalGlobals[key]) {
        delete global[key];
      }
    });
  }
}
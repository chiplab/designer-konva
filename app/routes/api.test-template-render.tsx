import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  
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
  
  try {
    const formData = await request.formData();
    const templateId = formData.get("templateId") as string;
    
    console.log('Starting template render test for:', templateId);
    
    // Get the template
    const template = await db.template.findFirst({
      where: {
        id: templateId,
        shop: session.shop,
      },
    });
    
    if (!template) {
      return json({ success: false, error: "Template not found" }, { status: 404 });
    }
    
    // Parse the canvas state
    const state = JSON.parse(template.canvasData);
    const { width, height } = state.dimensions;
    
    // Create canvas
    const canvas = createCanvas(width, height);
    canvas.style = {} as any;
    
    // Setup Konva
    // @ts-ignore
    Konva.window = {
      devicePixelRatio: 1,
    };
    
    // @ts-ignore
    Konva.document = {
      createElement: () => canvas,
      documentElement: {
        addEventListener: () => {},
      },
    };
    
    // Create stage
    const stage = new Konva.Stage({
      width,
      height,
    });
    
    const layer = new Konva.Layer();
    stage.add(layer);
    
    // Render background
    console.log('Background color value:', state.backgroundColor);
    
    // Create background configuration based on type
    let bgConfig: any = {
      x: 0,
      y: 0,
      width,
      height,
    };
    
    if (state.backgroundColor === 'linear-gradient') {
      // Linear gradient from left to right
      bgConfig = {
        ...bgConfig,
        fillLinearGradientStartPoint: { x: 0, y: 0 },
        fillLinearGradientEndPoint: { x: state.designableArea.width, y: 0 },
        fillLinearGradientColorStops: [0, '#c8102e', 1, '#ffaaaa'],
      };
    } else if (state.backgroundColor === 'radial-gradient') {
      // Radial gradient from center - use full canvas dimensions for center point
      bgConfig = {
        ...bgConfig,
        fillRadialGradientStartPoint: { x: width / 2, y: height / 2 },
        fillRadialGradientEndPoint: { x: width / 2, y: height / 2 },
        fillRadialGradientStartRadius: 0,
        fillRadialGradientEndRadius: Math.min(width, height) / 2,
        fillRadialGradientColorStops: [0, '#c8102e', 1, '#ffaaaa'],
      };
    } else {
      // Solid color
      bgConfig.fill = state.backgroundColor || 'white';
    }
    
    const bg = new Konva.Rect(bgConfig);
    layer.add(bg);
    
    // Skip base image for now - there's a compatibility issue
    if (state.assets.baseImage) {
      console.log('Base image exists but skipping due to compatibility issues:', state.assets.baseImage);
      
      // Add a light gray placeholder rectangle instead
      const imagePlaceholder = new Konva.Rect({
        x: 0,
        y: 0,
        width: width,
        height: height,
        fill: '#f5f5f5',
        opacity: 0.5,
      });
      layer.add(imagePlaceholder);
      
      // Add text to indicate this is a placeholder
      const placeholderText = new Konva.Text({
        x: width / 2,
        y: height / 2,
        text: 'Base Image Placeholder',
        fontSize: 20,
        fill: '#999',
        align: 'center',
        offsetX: 100, // Approximate half width of text
        offsetY: 10,
      });
      layer.add(placeholderText);
    }
    
    // Create clipping group for designable area
    const clipGroup = new Konva.Group({
      clip: {
        x: state.designableArea.x,
        y: state.designableArea.y,
        width: state.designableArea.width,
        height: state.designableArea.height,
      },
    });
    layer.add(clipGroup);
    
    // Render text elements
    state.elements.textElements?.forEach((element: any) => {
      console.log('Rendering text element:', element.text);
      
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
        fillAfterStrokeEnabled: true,  // Draw fill on top of stroke
        rotation: element.rotation || 0,
        scaleX: element.scaleX || 1,
        scaleY: element.scaleY || 1,
        ...fillConfig,
      });
      clipGroup.add(text);
    });
    
    // Render curved text with proper SVG paths
    state.elements.curvedTextElements?.forEach((element: any) => {
      console.log('Rendering curved text element:', element.text);
      
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
        align: 'center',  // Center align the text along the path
        stroke: element.stroke,
        strokeWidth: element.strokeWidth,
        fillAfterStrokeEnabled: true,  // Draw fill on top of stroke
        ...fillConfig,
      });
      
      curvedTextGroup.add(textPath);
      clipGroup.add(curvedTextGroup);
    });
    
    // Skip user images for now until we fix the crash
    if (state.elements.imageElements?.length > 0) {
      console.log('Skipping', state.elements.imageElements.length, 'user image elements for now');
    }
    
    // Draw everything
    layer.draw();
    
    // Get the canvas from the layer
    const layerCanvas = layer.getCanvas()._canvas;
    
    // Convert to data URL
    const buffer = await layerCanvas.toBuffer('image/png');
    const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`;
    
    console.log('Template render successful! Buffer size:', buffer.length);
    
    return json({ 
      success: true, 
      dataUrl,
      message: 'Template rendered successfully (without images)!'
    });
    
  } catch (error) {
    console.error('Template render error:', error);
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
/**
 * Server-side canvas rendering service using Konva and @napi-rs/canvas
 */
import { loadImage } from '@napi-rs/canvas';
import Konva from 'konva';
import * as path from 'path';
import * as fs from 'fs/promises';
import { fontLoader } from './font-loader';

interface CanvasState {
  dimensions: { width: number; height: number };
  backgroundColor: string;
  backgroundGradient?: {
    type: 'linear' | 'radial';
    colorStops: (number | string)[];
  };
  designableArea: {
    width: number;
    height: number;
    cornerRadius: number;
    x: number;
    y: number;
    visible: boolean;
  };
  elements: {
    textElements?: Array<{
      id: string;
      text: string;
      x: number;
      y: number;
      fontFamily: string;
      fontSize?: number;
      fontWeight?: string;
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
      rotation?: number;
      scaleX?: number;
      scaleY?: number;
    }>;
    curvedTextElements?: Array<{
      id: string;
      text: string;
      x: number;
      topY: number;
      radius: number;
      flipped: boolean;
      fontFamily: string;
      fontSize?: number;
      fontWeight?: string;
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
      rotation?: number;
      scaleX?: number;
      scaleY?: number;
    }>;
    gradientTextElements?: Array<{
      id: string;
      text: string;
      x: number;
      y: number;
      fontFamily: string;
      fontSize?: number;
      rotation?: number;
      scaleX?: number;
      scaleY?: number;
    }>;
    imageElements?: Array<{
      id: string;
      url: string;
      x: number;
      y: number;
      width: number;
      height: number;
      rotation?: number;
    }>;
    shapeElements?: Array<{
      id: string;
      type: 'ellipse' | 'ring' | 'rect';
      x: number;
      y: number;
      width: number;
      height: number;
      innerRadius?: number; // For ring only
      outerRadius?: number; // For ring only
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
      rotation?: number;
      scaleX?: number;
      scaleY?: number;
    }>;
  };
  assets: {
    baseImage?: string;
  };
}

/**
 * Loads an image from URL into a format Konva can use
 */
async function loadImageFromUrl(url: string): Promise<any> {
  console.log('Loading image from:', url);
  
  try {
    // Handle local images by reading from file system
    if (url.startsWith('/')) {
      // Construct the full file path
      const publicPath = path.join(process.cwd(), 'public', url);
      console.log('Reading local file:', publicPath);
      
      // Check if file exists
      try {
        await fs.access(publicPath);
        // Load the image from file system
        const img = await loadImage(publicPath);
        return img;
      } catch (error) {
        console.error('Local file not found, trying as URL:', error);
        // If local file doesn't exist, fall back to URL loading
      }
    }
    
    // For external URLs (S3, etc.), load directly
    const img = await loadImage(url);
    return img;
  } catch (error) {
    console.error('Failed to load image:', error);
    // Return null to skip this image instead of crashing
    return null;
  }
}

/**
 * Renders a canvas state to a PNG buffer
 */
export async function renderCanvasToBuffer(
  canvasState: CanvasState | string,
  options: { format?: 'png' | 'jpeg'; quality?: number } = {}
): Promise<Buffer> {
  const state: CanvasState = typeof canvasState === 'string' 
    ? JSON.parse(canvasState) 
    : canvasState;

  const { width, height } = state.dimensions;
  
  // Setup minimal globals for Konva in Node.js
  // @ts-ignore
  global.window = {
    devicePixelRatio: 1,
  };
  
  // Create stage WITHOUT container for server-side rendering
  const stage = new Konva.Stage({
    width,
    height,
  });
  
  const layer = new Konva.Layer();
  stage.add(layer);
  
  // Load fonts that are used
  const fontsToLoad = new Set<string>();
  state.elements.textElements?.forEach(el => fontsToLoad.add(el.fontFamily));
  state.elements.curvedTextElements?.forEach(el => fontsToLoad.add(el.fontFamily));
  state.elements.gradientTextElements?.forEach(el => fontsToLoad.add(el.fontFamily));
  
  // TODO: Implement server-side font loading
  console.log('Fonts to load:', Array.from(fontsToLoad));
  
  // Render base image if exists
  if (state.assets.baseImage) {
    try {
      console.log('Loading base image:', state.assets.baseImage);
      const img = await loadImageFromUrl(state.assets.baseImage);
      
      if (img) {
        // Create Konva.Image with the loaded image
        const baseImage = new Konva.Image({
          x: 0,
          y: 0,
          image: img,
          width: width,
          height: height,
        });
        layer.add(baseImage);
        console.log('Base image added successfully');
      } else {
        console.log('Base image could not be loaded, using fallback');
        // Add a gray background as fallback
        const fallbackBg = new Konva.Rect({
          x: 0,
          y: 0,
          width,
          height,
          fill: '#f0f0f0',
        });
        layer.add(fallbackBg);
      }
    } catch (error) {
      console.error('Failed to load base image:', error);
      // Add a gray background as fallback
      const fallbackBg = new Konva.Rect({
        x: 0,
        y: 0,
        width,
        height,
        fill: '#f0f0f0',
      });
      layer.add(fallbackBg);
    }
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
  
  // Render background inside clipped area
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
        fillLinearGradientColorStops: state.backgroundGradient?.type === 'linear' && state.backgroundGradient?.colorStops 
          ? state.backgroundGradient.colorStops 
          : [0, '#c8102e', 1, '#ffaaaa'],
      };
    } else if (state.backgroundColor === 'radial-gradient') {
      bgConfig = {
        ...bgConfig,
        fillRadialGradientStartPoint: { x: state.designableArea.width / 2, y: state.designableArea.height / 2 },
        fillRadialGradientEndPoint: { x: state.designableArea.width / 2, y: state.designableArea.height / 2 },
        fillRadialGradientStartRadius: 0,
        fillRadialGradientEndRadius: Math.min(state.designableArea.width, state.designableArea.height) / 2,
        fillRadialGradientColorStops: state.backgroundGradient?.type === 'radial' && state.backgroundGradient?.colorStops 
          ? state.backgroundGradient.colorStops 
          : [0, '#c8102e', 1, '#ffaaaa'],
      };
    } else {
      bgConfig.fill = state.backgroundColor;
    }
    
    const bg = new Konva.Rect(bgConfig);
    clipGroup.add(bg);
  }
  
  // Render text elements
  state.elements.textElements?.forEach(element => {
    // Handle special fills like gold-gradient
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
      id: element.id,
      x: element.x,
      y: element.y,
      text: element.text,
      fontSize: element.fontSize || 24,
      fontFamily: element.fontFamily,
      fontStyle: element.fontWeight === 'bold' ? 'bold' : 'normal',
      stroke: element.stroke,
      strokeWidth: element.strokeWidth,
      rotation: element.rotation || 0,
      scaleX: element.scaleX || 1,
      scaleY: element.scaleY || 1,
      ...fillConfig,
    });
    clipGroup.add(text);
  });
  
  // Render gradient text elements
  state.elements.gradientTextElements?.forEach(element => {
    const text = new Konva.Text({
      id: element.id,
      x: element.x,
      y: element.y,
      text: element.text,
      fontSize: element.fontSize || 24,
      fontFamily: element.fontFamily,
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: 0, y: element.fontSize || 24 },
      fillLinearGradientColorStops: [0, '#FFD700', 0.5, '#FFA500', 1, '#B8860B'],
      rotation: element.rotation || 0,
      scaleX: element.scaleX || 1,
      scaleY: element.scaleY || 1,
    });
    clipGroup.add(text);
  });
  
  // Render curved text elements (simplified for now)
  state.elements.curvedTextElements?.forEach(element => {
    // Handle special fills like gold-gradient
    let fillConfig: any = {};
    if (element.fill === 'gold-gradient') {
      fillConfig = {
        fillLinearGradientStartPoint: { x: 0, y: 0 },
        fillLinearGradientEndPoint: { x: 0, y: element.fontSize || 20 },
        fillLinearGradientColorStops: [0, '#FFD700', 0.5, '#FFA500', 1, '#B8860B'],
      };
    } else {
      fillConfig = { fill: element.fill || 'black' };
    }
    
    // For server-side, we'll render curved text as regular text
    // Full implementation would require SVG path generation
    const text = new Konva.Text({
      id: element.id,
      x: element.x,
      y: element.topY,
      text: element.text,
      fontSize: element.fontSize || 20,
      fontFamily: element.fontFamily,
      fontStyle: element.fontWeight === 'bold' ? 'bold' : 'normal',
      stroke: element.stroke,
      strokeWidth: element.strokeWidth,
      rotation: element.rotation || 0,
      scaleX: element.scaleX || 1,
      scaleY: element.scaleY || 1,
      ...fillConfig,
    });
    clipGroup.add(text);
  });
  
  // Render image elements
  if (state.elements.imageElements) {
    for (const element of state.elements.imageElements) {
      try {
        const img = await loadImageFromUrl(element.url);
        if (img) {
          const image = new Konva.Image({
            id: element.id,
            x: element.x,
            y: element.y,
            image: img,
            width: element.width,
            height: element.height,
            rotation: element.rotation || 0,
          });
          clipGroup.add(image);
        } else {
          console.log(`Skipping image element ${element.id} - could not load`);
        }
      } catch (error) {
        console.error(`Failed to load image element ${element.id}:`, error);
      }
    }
  }
  
  // Render shape elements
  state.elements.shapeElements?.forEach(element => {
    const commonProps = {
      id: element.id,
      x: element.x + (element.width || 0) / 2, // Center-based positioning
      y: element.y + (element.height || 0) / 2,
      fill: element.fill || '#ffffff',
      stroke: element.stroke || '#000000',
      strokeWidth: element.stroke ? (element.strokeWidth || 2) : 0,
      rotation: element.rotation || 0,
      scaleX: element.scaleX || 1,
      scaleY: element.scaleY || 1,
    };
    
    if (element.type === 'rect') {
      const rect = new Konva.Rect({
        ...commonProps,
        width: element.width,
        height: element.height,
        offsetX: element.width / 2,
        offsetY: element.height / 2,
      });
      clipGroup.add(rect);
    } else if (element.type === 'ellipse') {
      const ellipse = new Konva.Ellipse({
        ...commonProps,
        radiusX: element.width / 2,
        radiusY: element.height / 2,
      });
      clipGroup.add(ellipse);
    } else if (element.type === 'ring') {
      const ring = new Konva.Ring({
        ...commonProps,
        innerRadius: element.innerRadius || 25,
        outerRadius: element.outerRadius || 50,
      });
      clipGroup.add(ring);
    }
  });
  
  // Draw the stage
  stage.draw();
  
  // Get the canvas from the layer
  const layerCanvas = layer.getCanvas()._canvas as any;
  
  // Convert to buffer using @napi-rs/canvas methods
  const format = options.format || 'png';
  const buffer = format === 'jpeg' 
    ? layerCanvas.toBuffer('image/jpeg', options.quality || 0.9)
    : layerCanvas.toBuffer('image/png');
    
  return buffer;
}

/**
 * Renders a canvas state to a data URL
 */
export async function renderCanvasToDataUrl(
  canvasState: CanvasState | string,
  options?: { format?: 'png' | 'jpeg'; quality?: number }
): Promise<string> {
  const buffer = await renderCanvasToBuffer(canvasState, options);
  const format = options?.format || 'png';
  const base64 = buffer.toString('base64');
  return `data:image/${format};base64,${base64}`;
}
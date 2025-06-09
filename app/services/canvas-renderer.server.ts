/**
 * Server-side canvas rendering service using Konva and @napi-rs/canvas
 */
import { createCanvas, loadImage } from '@napi-rs/canvas';
import Konva from 'konva';
import { fontLoader } from './font-loader';

// Set Konva's window/document to use our canvas implementation
// This is the official way per https://github.com/konvajs/konva#4-nodejs-env
// @ts-ignore
Konva.window = {
  devicePixelRatio: 1,
  // Add matchMedia that was causing the error
  matchMedia: () => ({
    matches: false,
    addListener: () => {},
    removeListener: () => {},
  }),
};

// @ts-ignore
Konva.document = {
  createElement: function() {
    // Return our canvas implementation when Konva asks for it
    return createCanvas(1, 1) as any;
  },
  documentElement: {
    addEventListener: function() {},
  },
};

interface CanvasState {
  dimensions: { width: number; height: number };
  backgroundColor: string;
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
  };
  assets: {
    baseImage?: string;
  };
}

/**
 * Loads an image from URL into a format Konva can use
 */
async function loadImageFromUrl(url: string): Promise<any> {
  const response = await fetch(url);
  const buffer = await response.buffer();
  
  // Create an image-like object for Konva
  const img = await createCanvas(1, 1).getContext('2d').canvas;
  // This is a simplified approach - we may need to enhance this
  return {
    width: 1000, // We'll use default dimensions for now
    height: 1000,
    src: buffer,
  };
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
  
  // For server-side, we don't need a container - we'll export to canvas
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
  
  // Render background
  if (state.backgroundColor && state.backgroundColor !== 'transparent') {
    const bg = new Konva.Rect({
      x: 0,
      y: 0,
      width,
      height,
      fill: state.backgroundColor,
    });
    layer.add(bg);
  }
  
  // Render base image if exists
  if (state.assets.baseImage) {
    try {
      // For now, we'll skip image loading complexity
      console.log('Base image URL:', state.assets.baseImage);
    } catch (error) {
      console.error('Failed to load base image:', error);
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
  
  // Render text elements
  state.elements.textElements?.forEach(element => {
    const text = new Konva.Text({
      id: element.id,
      x: element.x,
      y: element.y,
      text: element.text,
      fontSize: element.fontSize || 24,
      fontFamily: element.fontFamily,
      fill: element.fill || 'black',
      stroke: element.stroke,
      strokeWidth: element.strokeWidth,
      rotation: element.rotation || 0,
      scaleX: element.scaleX || 1,
      scaleY: element.scaleY || 1,
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
    // For server-side, we'll render curved text as regular text
    // Full implementation would require SVG path generation
    const text = new Konva.Text({
      id: element.id,
      x: element.x,
      y: element.topY,
      text: element.text,
      fontSize: element.fontSize || 20,
      fontFamily: element.fontFamily,
      fill: element.fill || 'black',
      rotation: element.rotation || 0,
      scaleX: element.scaleX || 1,
      scaleY: element.scaleY || 1,
    });
    clipGroup.add(text);
  });
  
  // Draw the stage
  stage.draw();
  
  // Get the canvas from the layer
  const canvas = layer.getCanvas()._canvas;
  
  // Convert to buffer using @napi-rs/canvas methods
  const format = options.format || 'png';
  const buffer = format === 'jpeg' 
    ? await canvas.toBuffer('image/jpeg', { quality: options.quality || 0.9 })
    : await canvas.toBuffer('image/png');
    
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
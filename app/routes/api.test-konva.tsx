import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { createCanvas } from '@napi-rs/canvas';
import Konva from 'konva';

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    console.log('Starting simple Konva test...');
    
    // Simple Konva setup for Node.js
    const width = 400;
    const height = 200;
    const canvas = createCanvas(width, height);
    canvas.style = {} as any; // Konva expects a style property
    
    // Set up globals for Konva according to their Node.js docs
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
    
    // Create stage without container (Konva will create its own)
    const stage = new Konva.Stage({
      width,
      height,
    });
    
    const layer = new Konva.Layer();
    stage.add(layer);
    
    // Add a simple background
    const bg = new Konva.Rect({
      x: 0,
      y: 0,
      width,
      height,
      fill: '#f0f0f0',
    });
    layer.add(bg);
    
    // Add simple text
    const text = new Konva.Text({
      x: 50,
      y: 50,
      text: 'Hello from Server Konva!',
      fontSize: 30,
      fontFamily: 'Arial',
      fill: 'black',
    });
    layer.add(text);
    
    // Add a colored rectangle to make sure something renders
    const rect = new Konva.Rect({
      x: 50,
      y: 100,
      width: 300,
      height: 50,
      fill: 'blue',
      stroke: 'black',
      strokeWidth: 2,
    });
    layer.add(rect);
    
    // Draw everything
    layer.draw();
    
    // Get the canvas from the layer
    const layerCanvas = layer.getCanvas()._canvas;
    
    // Convert to data URL
    const buffer = await layerCanvas.toBuffer('image/png');
    const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`;
    
    console.log('Konva test successful! Buffer size:', buffer.length);
    
    // Return as JSON with the data URL
    return json({ 
      success: true, 
      dataUrl,
      message: 'Server-side Konva rendering worked!'
    });
    
  } catch (error) {
    console.error('Konva test error:', error);
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
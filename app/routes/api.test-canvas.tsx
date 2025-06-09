import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { createCanvas } from '@napi-rs/canvas';

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    console.log('Starting simple canvas test (no Konva)...');
    
    // Create a canvas directly
    const width = 400;
    const height = 200;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // Draw background
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, width, height);
    
    // Draw text
    ctx.fillStyle = 'black';
    ctx.font = '30px Arial';
    ctx.fillText('Direct Canvas (No Konva)', 50, 50);
    
    // Draw a blue rectangle
    ctx.fillStyle = 'blue';
    ctx.fillRect(50, 100, 300, 50);
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    ctx.strokeRect(50, 100, 300, 50);
    
    // Convert to data URL
    const buffer = await canvas.toBuffer('image/png');
    const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`;
    
    console.log('Canvas test successful! Buffer size:', buffer.length);
    
    // Return as JSON with the data URL
    return json({ 
      success: true, 
      dataUrl,
      message: 'Direct canvas rendering worked! (No Konva)'
    });
    
  } catch (error) {
    console.error('Canvas test error:', error);
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
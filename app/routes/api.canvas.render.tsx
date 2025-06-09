import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { renderCanvasToDataUrl, renderCanvasToBuffer } from "../services/canvas-renderer.server";
import { uploadToS3 } from "../services/s3.server";
import { uploadImageToShopify } from "../services/shopify-image.server";

export async function action({ request }: ActionFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  
  try {
    const data = await request.json();
    const { canvasState, outputFormat = 'shopify' } = data;
    
    if (!canvasState) {
      return json({ error: "No canvas state provided" }, { status: 400 });
    }
    
    console.log('Rendering canvas server-side...');
    
    // Render canvas to buffer
    const buffer = await renderCanvasToBuffer(canvasState);
    
    if (outputFormat === 'dataUrl') {
      // Return as data URL (for testing)
      const dataUrl = await renderCanvasToDataUrl(canvasState);
      return json({ success: true, dataUrl });
    }
    
    if (outputFormat === 's3') {
      // Upload to S3 and return URL
      const timestamp = Date.now();
      const key = `renders/${session.shop}/render-${timestamp}.png`;
      const s3Url = await uploadToS3(buffer, key, 'image/png');
      return json({ success: true, s3Url });
    }
    
    // Default: Upload to Shopify for proper optimization
    const filename = `template-render-${Date.now()}.png`;
    const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`;
    
    console.log('Uploading to Shopify...');
    const { url: shopifyUrl } = await uploadImageToShopify(admin, dataUrl, filename);
    
    return json({ 
      success: true, 
      shopifyUrl,
      message: "Image rendered and uploaded to Shopify successfully"
    });
    
  } catch (error) {
    console.error('Canvas render error:', error);
    return json({ 
      error: error instanceof Error ? error.message : "Failed to render canvas" 
    }, { status: 500 });
  }
}
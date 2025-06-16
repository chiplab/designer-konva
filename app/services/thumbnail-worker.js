/**
 * Worker thread for thumbnail generation
 * This runs in a completely isolated V8 context
 */

const { parentPort, workerData } = require('worker_threads');

async function generateThumbnail() {
  try {
    const { canvasData } = workerData;
    
    // Import the existing thumbnail generator
    const { generateTemplateThumbnail } = await import('./template-thumbnail-generator.server');
    
    // Generate thumbnail (this will run in isolation)
    const result = await generateTemplateThumbnail(
      canvasData,
      'temp-shop',  // We'll handle S3 upload in the main thread
      'temp-id'
    );
    
    // Since we can't return the S3 URL directly (it was uploaded with temp values),
    // we'll need to extract the buffer and return it
    // For now, let's just signal completion
    parentPort.postMessage({ success: true, result });
    
  } catch (error) {
    parentPort.postMessage({ 
      success: false, 
      error: error.message,
      stack: error.stack 
    });
  }
}

generateThumbnail();
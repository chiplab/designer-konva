/**
 * Clean thumbnail generator that uses isolated module to avoid global pollution
 */
import { uploadBase64ImageToS3 } from "./s3.server";

/**
 * Generates a thumbnail for a template without polluting the global context
 */
export async function generateTemplateThumbnail(
  canvasData: string,
  shop: string,
  templateId: string
): Promise<string | null> {
  try {
    // Dynamically import the isolated generator
    const { generateThumbnailFromCanvas } = await import("./thumbnail-generator-isolated.server");
    
    // Generate the thumbnail buffer in isolation
    const buffer = await generateThumbnailFromCanvas(canvasData);
    const base64 = buffer.toString('base64');
    
    // Upload to S3
    const s3Key = `templates/${shop}/${templateId}/thumbnail-${Date.now()}.png`;
    const s3Url = await uploadBase64ImageToS3(s3Key, base64, 'image/png');
    
    console.log('Template thumbnail generated and uploaded:', s3Url);
    return s3Url;
    
  } catch (error) {
    console.error('Error generating template thumbnail:', error);
    return null;
  }
}
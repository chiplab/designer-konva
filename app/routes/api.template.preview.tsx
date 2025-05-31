import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * API endpoint to generate a preview image for a template
 * This will be called when assigning templates to products
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  
  const formData = await request.formData();
  const templateId = formData.get("templateId");
  const variantId = formData.get("variantId");
  
  if (!templateId || !variantId) {
    return json({ error: "Missing required parameters" }, { status: 400 });
  }
  
  try {
    // Get the template
    const template = await db.template.findFirst({
      where: {
        id: templateId as string,
        shop: session.shop,
      },
    });
    
    if (!template) {
      return json({ error: "Template not found" }, { status: 404 });
    }
    
    // Parse the canvas data
    const canvasData = JSON.parse(template.canvasData);
    
    // Generate preview with placeholder text
    const previewData = generatePreviewData(canvasData);
    
    // For now, we'll return the preview data
    // In the next step, we'll actually generate an image
    return json({ 
      success: true,
      previewData,
      message: "Preview data generated successfully"
    });
    
  } catch (error) {
    console.error("Error generating preview:", error);
    return json({ 
      error: "Failed to generate preview",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
};

function generatePreviewData(canvasData: any) {
  // Create a copy of the canvas data with placeholder text
  const previewData = JSON.parse(JSON.stringify(canvasData));
  
  // Replace text with placeholders
  if (previewData.elements?.textElements) {
    previewData.elements.textElements = previewData.elements.textElements.map((el: any) => ({
      ...el,
      text: "Your Text Here",
      fill: el.fill || "#666666", // Slightly gray to indicate placeholder
    }));
  }
  
  if (previewData.elements?.curvedTextElements) {
    previewData.elements.curvedTextElements = previewData.elements.curvedTextElements.map((el: any) => ({
      ...el,
      text: "Custom Text",
      fill: el.fill || "#666666",
    }));
  }
  
  if (previewData.elements?.gradientTextElements) {
    previewData.elements.gradientTextElements = previewData.elements.gradientTextElements.map((el: any) => ({
      ...el,
      text: "Your Name",
    }));
  }
  
  return previewData;
}
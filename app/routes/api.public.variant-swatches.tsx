import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import db from "../db.server";
import { generateVariantSwatch } from "../services/variant-swatch-generator.server";

// Handle OPTIONS requests for CORS
export async function loader({ request }: ActionFunctionArgs) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400", // Cache preflight for 24 hours
      },
    });
  }
  
  return json({ error: "Method not allowed" }, { status: 405 });
}

export async function action({ request }: ActionFunctionArgs) {
  // Handle CORS for POST requests
  const origin = request.headers.get("origin") || "*";
  const corsHeaders = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
  };

  // POST requests are expected here
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { 
      status: 405,
      headers: corsHeaders
    });
  }

  try {
    const body = await request.json();
    const { templateId, variants, customization, options } = body;

    if (!templateId || !variants || !Array.isArray(variants)) {
      return json({ 
        success: false,
        error: "Template ID and variants array are required" 
      }, { 
        status: 400,
        headers: corsHeaders
      });
    }

    // Limit to 20 variants max for performance
    if (variants.length > 20) {
      return json({ 
        success: false,
        error: "Maximum 20 variants allowed per request" 
      }, { 
        status: 400,
        headers: corsHeaders
      });
    }

    // Get the template
    const template = await db.template.findUnique({
      where: { id: templateId },
      select: {
        id: true,
        canvasData: true,
        frontCanvasData: true,
        backCanvasData: true,
        shop: true,
      }
    });

    if (!template) {
      return json({ 
        success: false,
        error: "Template not found" 
      }, { 
        status: 404,
        headers: corsHeaders
      });
    }

    // Generate swatches for each variant
    const swatches: Record<string, string> = {};
    const errors: string[] = [];
    
    // Process variants in parallel batches of 5
    const BATCH_SIZE = 5;
    for (let i = 0; i < variants.length; i += BATCH_SIZE) {
      const batch = variants.slice(i, i + BATCH_SIZE);
      
      await Promise.all(batch.map(async (variant) => {
        try {
          const swatch = await generateVariantSwatch({
            template,
            variantId: variant.id,
            variantColor: variant.color,
            customization: customization || {},
            options: {
              size: options?.size || 128,
              quality: options?.quality || 0.8,
              side: options?.side || 'front',
            }
          });
          
          if (swatch) {
            swatches[variant.id] = swatch;
          } else {
            errors.push(`Failed to generate swatch for ${variant.color}`);
          }
        } catch (error) {
          console.error(`Error generating swatch for variant ${variant.id}:`, error);
          errors.push(`Error for ${variant.color}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }));
    }

    return json({
      success: true,
      swatches,
      errors: errors.length > 0 ? errors : undefined,
      generatedAt: new Date().toISOString(),
      generatedCount: Object.keys(swatches).length,
      requestedCount: variants.length,
    }, {
      headers: {
        ...corsHeaders,
        "Cache-Control": "public, max-age=300", // Cache for 5 minutes
      }
    });

  } catch (error) {
    console.error("Error in variant swatch generation:", error);
    return json({ 
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate swatches" 
    }, { 
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      }
    });
  }
}
import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { prisma } from "../db.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body = await request.json();
    const { shop, sessionId, customerId } = body;

    // Validate required fields
    if (!shop || !sessionId || !customerId) {
      return json({ 
        error: "Missing required fields", 
        details: "shop, sessionId, and customerId are required" 
      }, { status: 400 });
    }

    // Find all assets belonging to this session
    const sessionAssets = await prisma.userAsset.findMany({
      where: {
        shop,
        sessionId,
        customerId: null // Only migrate assets that don't already have a customerId
      }
    });

    if (sessionAssets.length === 0) {
      return json({ 
        success: true, 
        message: "No assets to migrate",
        migratedCount: 0 
      });
    }

    // Migrate assets from sessionId to customerId
    const result = await prisma.userAsset.updateMany({
      where: {
        shop,
        sessionId,
        customerId: null
      },
      data: {
        customerId,
        sessionId: null // Clear the sessionId after migration
      }
    });

    console.log(`[Asset Migration] Migrated ${result.count} assets from session ${sessionId} to customer ${customerId}`);

    return json({ 
      success: true, 
      message: `Successfully migrated ${result.count} assets`,
      migratedCount: result.count
    });

  } catch (error) {
    console.error("Asset migration error:", error);
    return json({ 
      error: "Migration failed", 
      details: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
}

// GET method returns method not allowed
export async function loader() {
  return json({ error: "Use POST to migrate assets" }, { status: 405 });
}
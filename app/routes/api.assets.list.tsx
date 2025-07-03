import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { prisma } from "../db.server";
import { authenticate } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");
  const customerId = url.searchParams.get("customerId");
  const searchQuery = url.searchParams.get("search");
  const limit = parseInt(url.searchParams.get("limit") || "100");
  const offset = parseInt(url.searchParams.get("offset") || "0");

  // Try to get shop from admin auth or query params
  let shop: string | null = null;
  
  try {
    const { session } = await authenticate.admin(request);
    shop = session.shop;
  } catch (error) {
    // Not an admin request, get shop from query params
    shop = url.searchParams.get("shop");
  }

  if (!shop) {
    return json({ error: "Shop parameter required" }, { status: 400 });
  }

  try {
    // Build query conditions
    const where: any = { shop };
    
    // Filter by user - if logged in, show both customer assets AND session assets
    if (customerId && sessionId) {
      // Logged-in user: show assets from both customerId and sessionId
      where.OR = [
        { customerId: customerId },
        { sessionId: sessionId }
      ];
    } else if (customerId) {
      // Only customerId provided
      where.customerId = customerId;
    } else if (sessionId) {
      // Only sessionId provided (anonymous user)
      where.sessionId = sessionId;
    } else {
      // If neither is provided, return empty array (no public assets)
      return json({ assets: [], total: 0 });
    }

    // Add search filter if provided
    if (searchQuery) {
      // If we already have an OR condition (for user filtering), we need to combine them
      if (where.OR) {
        // Apply search filter to each user condition
        where.OR = where.OR.map((userCondition: any) => ({
          ...userCondition,
          OR: [
            { filename: { contains: searchQuery, mode: 'insensitive' } },
            { tags: { has: searchQuery } }
          ]
        }));
      } else {
        // No user OR condition, apply search filter directly
        where.OR = [
          { filename: { contains: searchQuery, mode: 'insensitive' } },
          { tags: { has: searchQuery } }
        ];
      }
    }

    // Get total count
    const total = await prisma.userAsset.count({ where });

    // Get assets with pagination
    const assets = await prisma.userAsset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
      select: {
        id: true,
        url: true,
        filename: true,
        filesize: true,
        width: true,
        height: true,
        mimetype: true,
        tags: true,
        createdAt: true
      }
    });

    return json({
      assets,
      total,
      limit,
      offset,
      hasMore: offset + assets.length < total
    });
  } catch (error) {
    console.error("Error fetching assets:", error);
    return json({ 
      error: "Failed to fetch assets",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

// Export action to handle DELETE requests for asset deletion
export async function action({ request }: LoaderFunctionArgs) {
  if (request.method !== "DELETE") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const url = new URL(request.url);
  const assetId = url.searchParams.get("id");
  const sessionId = url.searchParams.get("sessionId");
  const customerId = url.searchParams.get("customerId");

  // Try to get shop from admin auth or body
  let shop: string | null = null;
  
  try {
    const { session } = await authenticate.admin(request);
    shop = session.shop;
  } catch (error) {
    // Not an admin request, get shop from body
    const body = await request.json();
    shop = body.shop;
  }

  if (!shop || !assetId) {
    return json({ error: "Shop and asset ID required" }, { status: 400 });
  }

  try {
    // Build delete conditions - must match shop and user
    const where: any = { id: assetId, shop };
    
    if (customerId) {
      where.customerId = customerId;
    } else if (sessionId) {
      where.sessionId = sessionId;
    } else {
      return json({ error: "User identification required" }, { status: 400 });
    }

    // Delete the asset
    const deleted = await prisma.userAsset.delete({ where });

    // Note: We're not deleting from S3 to avoid breaking existing designs
    // S3 objects can be cleaned up separately via lifecycle policies

    return json({ success: true, deleted: deleted.id });
  } catch (error) {
    console.error("Error deleting asset:", error);
    return json({ 
      error: "Failed to delete asset",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { deleteFromS3, BASE_URL } from "../services/s3.server";

// For now, we'll use a simple in-memory store for asset metadata
// In production, you'd want to store this in your database
const PREDEFINED_ASSETS = {
  images: [
    {
      id: "base-red",
      url: `${BASE_URL}/assets/default/images/8-spot-red-base-image.png`,
      name: "8 Spot Red Base",
      type: "image/png",
      category: "base",
    },
    {
      id: "base-black",
      url: `${BASE_URL}/assets/default/images/8-spot-black-base.png`,
      name: "8 Spot Black Base",
      type: "image/png",
      category: "base",
    },
    {
      id: "base-blue",
      url: `${BASE_URL}/assets/default/images/8-spot-blue-base.png`,
      name: "8 Spot Blue Base",
      type: "image/png",
      category: "base",
    },
  ],
  svgs: [
    {
      id: "borders-v7",
      url: `${BASE_URL}/assets/default/svgs/borders_v7-11.svg`,
      name: "Decorative Borders v7",
      type: "image/svg+xml",
      category: "decoration",
    },
  ],
};

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  
  const url = new URL(request.url);
  const assetType = url.searchParams.get("type") || "all";

  // In a real implementation, you'd query your database for user-uploaded assets
  // For now, return predefined assets
  let assets = [];
  
  if (assetType === "all" || assetType === "images") {
    assets = [...assets, ...PREDEFINED_ASSETS.images];
  }
  
  if (assetType === "all" || assetType === "svgs") {
    assets = [...assets, ...PREDEFINED_ASSETS.svgs];
  }

  return json({ assets });
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  
  if (request.method !== "DELETE") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const formData = await request.formData();
    const assetKey = formData.get("key") as string;

    if (!assetKey) {
      return json({ error: "Asset key is required" }, { status: 400 });
    }

    // Don't allow deletion of default assets
    if (assetKey.includes("/default/")) {
      return json({ error: "Cannot delete default assets" }, { status: 403 });
    }

    // Delete from S3
    await deleteFromS3(assetKey);

    // In a real implementation, you'd also delete from your database

    return json({ success: true });
  } catch (error) {
    console.error("Error deleting asset:", error);
    return json({ error: "Failed to delete asset" }, { status: 500 });
  }
}
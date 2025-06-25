import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import db from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const variantId = url.searchParams.get("variantId");
  const shop = url.searchParams.get("shop") || "printlabs-app-dev.myshopify.com";
  
  // Get all templates for this shop
  const templates = await db.template.findMany({
    where: {
      shop,
      ...(variantId ? { shopifyVariantId: variantId } : {})
    },
    select: {
      id: true,
      name: true,
      shopifyProductId: true,
      shopifyVariantId: true,
      masterTemplateId: true,
      isColorVariant: true,
      colorVariant: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 50
  });
  
  // Also get a count by variant ID
  const variantCounts = await db.template.groupBy({
    by: ['shopifyVariantId'],
    where: {
      shop,
      shopifyVariantId: {
        not: null
      }
    },
    _count: true
  });
  
  return json({
    totalTemplates: templates.length,
    templates,
    variantCounts,
    searchedVariantId: variantId,
    shop
  });
}
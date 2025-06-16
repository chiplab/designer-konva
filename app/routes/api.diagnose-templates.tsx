import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const formData = await request.formData();
    const masterTemplateId = formData.get("masterTemplateId") as string;
    
    if (!masterTemplateId) {
      return json({ error: "Master template ID required" }, { status: 400 });
    }
    
    // Get the master template
    const masterTemplate = await db.template.findFirst({
      where: {
        id: masterTemplateId,
        shop: session.shop,
      },
    });
    
    if (!masterTemplate) {
      return json({ error: "Master template not found" }, { status: 404 });
    }
    
    // Find all templates that might be related
    const baseName = masterTemplate.name.split(" / ")[0]; // Get base name without color
    
    // 1. Find properly linked variants
    const linkedVariants = await db.template.findMany({
      where: {
        masterTemplateId: masterTemplateId,
        shop: session.shop,
      },
      select: {
        id: true,
        name: true,
        isColorVariant: true,
        colorVariant: true,
        createdAt: true,
      },
    });
    
    // 2. Find potential orphaned variants (same base name but no link)
    const orphanedVariants = await db.template.findMany({
      where: {
        shop: session.shop,
        id: { not: masterTemplateId },
        masterTemplateId: null,
        name: { contains: baseName },
        isColorVariant: true,
      },
      select: {
        id: true,
        name: true,
        isColorVariant: true,
        colorVariant: true,
        createdAt: true,
      },
    });
    
    // 3. Find suspicious variants (same product but different patterns)
    const suspiciousVariants = await db.template.findMany({
      where: {
        shop: session.shop,
        shopifyProductId: masterTemplate.shopifyProductId,
        id: { not: masterTemplateId },
        masterTemplateId: { not: masterTemplateId },
      },
      select: {
        id: true,
        name: true,
        isColorVariant: true,
        colorVariant: true,
        masterTemplateId: true,
        createdAt: true,
      },
    });
    
    // 4. Find all templates with similar names (for manual review)
    const similarTemplates = await db.template.findMany({
      where: {
        shop: session.shop,
        name: { contains: baseName.substring(0, 10) }, // First 10 chars of base name
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        isColorVariant: true,
        colorVariant: true,
        masterTemplateId: true,
        createdAt: true,
      },
    });
    
    const diagnostics = {
      masterTemplate: {
        id: masterTemplate.id,
        name: masterTemplate.name,
        baseName,
        shopifyProductId: masterTemplate.shopifyProductId,
      },
      linkedVariants: {
        count: linkedVariants.length,
        templates: linkedVariants,
      },
      orphanedVariants: {
        count: orphanedVariants.length,
        templates: orphanedVariants,
      },
      suspiciousVariants: {
        count: suspiciousVariants.length,
        templates: suspiciousVariants,
      },
      allSimilarTemplates: {
        count: similarTemplates.length,
        templates: similarTemplates.map(t => ({
          ...t,
          status: t.id === masterTemplateId ? "master" :
                  t.masterTemplateId === masterTemplateId ? "linked" :
                  t.masterTemplateId ? "linked-to-other" :
                  t.isColorVariant ? "orphaned" : "standalone"
        })),
      },
    };
    
    return json(diagnostics);
    
  } catch (error) {
    console.error("Error diagnosing templates:", error);
    return json({ 
      error: error instanceof Error ? error.message : "Failed to diagnose templates" 
    }, { status: 500 });
  }
}
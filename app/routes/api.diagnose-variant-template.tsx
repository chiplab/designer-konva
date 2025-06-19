import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

const VARIANT_QUERY = `#graphql
  query GetVariantMetafield($id: ID!) {
    productVariant(id: $id) {
      id
      title
      displayName
      product {
        id
        title
      }
      metafield(namespace: "custom_designer", key: "template_id") {
        id
        value
      }
    }
  }
`;

export async function action({ request }: ActionFunctionArgs) {
  const { session, admin } = await authenticate.admin(request);
  
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const formData = await request.formData();
    const variantId = formData.get("variantId") as string;
    
    if (!variantId) {
      return json({ error: "Variant ID required" }, { status: 400 });
    }
    
    console.log(`[Diagnose Variant] Checking variant: ${variantId}`);
    
    // Get variant info from Shopify
    const response = await admin.graphql(VARIANT_QUERY, {
      variables: { id: variantId }
    });
    
    const { data } = await response.json() as any;
    const variant = data?.productVariant;
    
    if (!variant) {
      return json({ error: "Variant not found in Shopify" }, { status: 404 });
    }
    
    const templateId = variant.metafield?.value;
    console.log(`[Diagnose Variant] Template ID from metafield: ${templateId}`);
    
    let templateInfo = null;
    let relatedTemplates = [];
    
    if (templateId) {
      // Check if template exists in database
      const template = await db.template.findFirst({
        where: { id: templateId },
        select: {
          id: true,
          name: true,
          shop: true,
          isColorVariant: true,
          masterTemplateId: true,
          colorVariant: true,
          shopifyProductId: true,
          shopifyVariantId: true,
          createdAt: true,
          updatedAt: true,
        }
      });
      
      if (template) {
        templateInfo = template;
        console.log(`[Diagnose Variant] Template found: ${template.name}`);
        
        // Find related templates (same product or master)
        relatedTemplates = await db.template.findMany({
          where: {
            OR: [
              { shopifyProductId: variant.product.id },
              { masterTemplateId: template.masterTemplateId || template.id },
              { id: template.masterTemplateId || undefined }
            ].filter(Boolean)
          },
          select: {
            id: true,
            name: true,
            isColorVariant: true,
            masterTemplateId: true,
            colorVariant: true,
            shopifyVariantId: true,
          },
          orderBy: { name: 'asc' }
        });
      } else {
        console.log(`[Diagnose Variant] Template NOT found in database`);
        
        // Check for templates with similar IDs
        const similarTemplates = await db.template.findMany({
          where: {
            id: { startsWith: templateId.substring(0, 10) }
          },
          select: {
            id: true,
            name: true,
            shop: true,
          },
          take: 5
        });
        
        if (similarTemplates.length > 0) {
          console.log(`[Diagnose Variant] Found ${similarTemplates.length} similar templates`);
        }
      }
    }
    
    // Find all templates for this product
    const productTemplates = await db.template.findMany({
      where: {
        shopifyProductId: variant.product.id,
        shop: session.shop,
      },
      select: {
        id: true,
        name: true,
        isColorVariant: true,
        masterTemplateId: true,
        colorVariant: true,
        shopifyVariantId: true,
      },
      orderBy: { name: 'asc' }
    });
    
    const diagnostics = {
      variant: {
        id: variant.id,
        title: variant.title,
        displayName: variant.displayName,
        product: variant.product,
        metafieldValue: templateId,
      },
      template: templateInfo ? {
        found: true,
        ...templateInfo,
        belongsToCurrentShop: templateInfo.shop === session.shop,
      } : {
        found: false,
        id: templateId,
        message: "Template ID from metafield not found in database"
      },
      relatedTemplates: {
        count: relatedTemplates.length,
        templates: relatedTemplates,
      },
      productTemplates: {
        count: productTemplates.length,
        templates: productTemplates,
        masterTemplates: productTemplates.filter(t => !t.isColorVariant),
        colorVariants: productTemplates.filter(t => t.isColorVariant),
      },
      recommendations: []
    };
    
    // Add recommendations based on findings
    if (!templateInfo && templateId) {
      diagnostics.recommendations.push("Template ID in metafield doesn't exist. Consider clearing the metafield or assigning a valid template.");
    }
    
    if (templateInfo && templateInfo.shop !== session.shop) {
      diagnostics.recommendations.push("Template belongs to a different shop. This should not happen in production.");
    }
    
    if (productTemplates.length > 0 && !templateId) {
      diagnostics.recommendations.push(`Found ${productTemplates.length} templates for this product. Consider assigning one to this variant.`);
    }
    
    return json(diagnostics);
    
  } catch (error) {
    console.error("Error diagnosing variant template:", error);
    return json({ 
      error: error instanceof Error ? error.message : "Failed to diagnose variant template" 
    }, { status: 500 });
  }
}
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useActionData, useNavigate } from "@remix-run/react";
import { useState, useCallback, useEffect } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  Thumbnail,
  EmptyState,
  Badge,
  Modal,
  ChoiceList,
  Banner,
  Button,
  BlockStack,
  Collapsible,
  ButtonGroup,
  InlineStack,
  Grid,
} from "@shopify/polaris";
import {
  ChevronDownIcon,
  ChevronRightIcon,
} from "@shopify/polaris-icons";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

// GraphQL mutation to set metafield
const METAFIELD_SET_MUTATION = `#graphql
  mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        id
        namespace
        key
        value
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

const PRODUCT_VARIANTS_QUERY = `#graphql
  query GetProductVariantsWithMetafields {
    productVariants(first: 100) {
      edges {
        node {
          id
          title
          displayName
          product {
            id
            title
          }
          metafield(namespace: "custom_designer", key: "template_id") {
            value
          }
        }
      }
    }
  }
`;

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("_action");

  if (action === "deleteTemplates") {
    const templateIds = formData.getAll("templateIds[]") as string[];
    
    try {
      // Verify all templates belong to this shop before deleting
      const templates = await db.template.findMany({
        where: {
          id: { in: templateIds },
          shop: session.shop,
        },
      });

      if (templates.length !== templateIds.length) {
        return json({ 
          success: false, 
          error: "Some templates not found or access denied" 
        }, { status: 404 });
      }

      // First, delete any CustomerDesigns that reference these templates
      const deletedDesigns = await db.customerDesign.deleteMany({
        where: {
          templateId: { in: templateIds },
        },
      });
      
      console.log(`Deleted ${deletedDesigns.count} customer designs associated with ${templateIds.length} templates`);

      // Now delete all templates
      await db.template.deleteMany({
        where: {
          id: { in: templateIds },
          shop: session.shop,
        },
      });

      return json({ 
        success: true, 
        message: `${templates.length} template(s) deleted successfully${deletedDesigns.count > 0 ? ` (and ${deletedDesigns.count} associated designs)` : ''}` 
      });
    } catch (error) {
      console.error("Error deleting templates:", error);
      return json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to delete templates" 
      }, { status: 500 });
    }
  }

  if (action === "nuclearDelete") {
    const masterTemplateId = formData.get("masterTemplateId") as string;
    
    try {
      // Get the master template
      const masterTemplate = await db.template.findFirst({
        where: {
          id: masterTemplateId,
          shop: session.shop,
        },
      });

      if (!masterTemplate) {
        return json({ 
          success: false, 
          error: "Master template not found" 
        }, { status: 404 });
      }

      // NUCLEAR OPTION: Delete EVERYTHING except the master
      // This is the most aggressive approach
      const baseName = masterTemplate.name.split(" / ")[0];
      
      // Find templates to delete
      const templatesToDelete = await db.template.findMany({
        where: {
          shop: session.shop,
          id: { not: masterTemplateId },
          // Delete anything that even remotely looks like it could be related
          OR: [
            // Has the product ID and is not the master
            {
              shopifyProductId: masterTemplate.shopifyProductId,
              id: { not: masterTemplateId },
            },
            // Has similar name
            {
              name: { contains: baseName.substring(0, 10) }, // Even partial match
            },
            // Is linked to this master
            {
              masterTemplateId: masterTemplateId,
            },
          ]
        },
        select: { id: true }
      });
      
      const templateIdsToDelete = templatesToDelete.map(t => t.id);
      console.log(`NUCLEAR DELETE: Found ${templateIdsToDelete.length} templates to delete`);
      
      // Delete related CustomerDesigns first
      const deletedDesigns = await db.customerDesign.deleteMany({
        where: {
          templateId: { in: templateIdsToDelete },
        },
      });
      console.log(`NUCLEAR DELETE: Deleted ${deletedDesigns.count} related customer designs`);
      
      // Now delete the templates
      const deleteResult = await db.template.deleteMany({
        where: {
          id: { in: templateIdsToDelete },
        },
      });
      
      console.log(`NUCLEAR DELETE: Removed ${deleteResult.count} templates for "${masterTemplate.name}"`);
      
      return json({ 
        success: true, 
        message: `Nuclear delete: removed ${deleteResult.count} template(s)` 
      });
    } catch (error) {
      console.error("Error in nuclear delete:", error);
      return json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Nuclear delete failed" 
      }, { status: 500 });
    }
  }

  if (action === "cleanupOrphaned") {
    const masterTemplateId = formData.get("masterTemplateId") as string;
    
    try {
      // First verify the master template exists and belongs to this shop
      const masterTemplate = await db.template.findFirst({
        where: {
          id: masterTemplateId,
          shop: session.shop,
          isColorVariant: false,
        },
      });

      if (!masterTemplate) {
        return json({ 
          success: false, 
          error: "Master template not found or access denied" 
        }, { status: 404 });
      }

      const baseName = masterTemplate.name.split(" / ")[0];
      
      // Find templates to delete
      const templatesToDelete = await db.template.findMany({
        where: {
          shop: session.shop,
          id: { not: masterTemplateId },
          OR: [
            // Properly linked variants
            { masterTemplateId: masterTemplateId },
            // Orphaned variants with same base name
            {
              masterTemplateId: null,
              name: { contains: baseName },
              isColorVariant: true,
            },
            // Any template for the same product that's a color variant
            {
              shopifyProductId: masterTemplate.shopifyProductId,
              isColorVariant: true,
            }
          ]
        },
        select: { id: true }
      });
      
      const templateIdsToDelete = templatesToDelete.map(t => t.id);
      console.log(`Cleanup: Found ${templateIdsToDelete.length} templates to delete`);
      
      // Delete related CustomerDesigns first
      const deletedDesigns = await db.customerDesign.deleteMany({
        where: {
          templateId: { in: templateIdsToDelete },
        },
      });
      console.log(`Cleanup: Deleted ${deletedDesigns.count} related customer designs`);
      
      // Now delete the templates
      const deleteResult = await db.template.deleteMany({
        where: {
          id: { in: templateIdsToDelete },
        },
      });
      
      console.log(`Cleanup: Deleted ${deleteResult.count} templates for "${masterTemplate.name}"`);
      
      return json({ 
        success: true, 
        message: `Cleaned up ${deleteResult.count} variant(s) of "${masterTemplate.name}"` 
      });
    } catch (error) {
      console.error("Error cleaning up variants:", error);
      return json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to clean up variants" 
      }, { status: 500 });
    }
  }

  if (action === "deleteAllVariants") {
    const masterTemplateId = formData.get("masterTemplateId") as string;
    
    try {
      // First verify the master template exists and belongs to this shop
      const masterTemplate = await db.template.findFirst({
        where: {
          id: masterTemplateId,
          shop: session.shop,
          isColorVariant: false,
        },
      });

      if (!masterTemplate) {
        return json({ 
          success: false, 
          error: "Master template not found or access denied" 
        }, { status: 404 });
      }

      // First, let's see what variants exist before deletion
      const variantsBeforeDeletion = await db.template.findMany({
        where: {
          masterTemplateId: masterTemplateId,
          shop: session.shop,
        },
        select: {
          id: true,
          name: true,
          isColorVariant: true,
        }
      });
      
      console.log(`Found ${variantsBeforeDeletion.length} variants before deletion:`, variantsBeforeDeletion.map(v => ({
        id: v.id,
        name: v.name,
        isColorVariant: v.isColorVariant
      })));

      // More aggressive deletion strategy
      const baseName = masterTemplate.name.split(" / ")[0];
      console.log(`Deleting all variants for base name: "${baseName}"`);
      
      // First, find all templates that will be deleted
      const templatesToDelete = await db.template.findMany({
        where: {
          shop: session.shop,
          id: { not: masterTemplateId }, // Not the master itself
          OR: [
            // 1. Properly linked variants
            { masterTemplateId: masterTemplateId },
            // 2. Templates with the same base name and marked as color variant
            {
              name: { startsWith: baseName },
              isColorVariant: true,
            },
            // 3. Templates for the same product that are color variants
            {
              shopifyProductId: masterTemplate.shopifyProductId,
              isColorVariant: true,
              id: { not: masterTemplateId },
            },
            // 4. Legacy orphaned templates (no masterTemplateId but same pattern)
            {
              masterTemplateId: null,
              name: { contains: baseName },
              colorVariant: { not: null },
            }
          ]
        },
        select: { id: true }
      });

      const templateIdsToDelete = templatesToDelete.map(t => t.id);
      console.log(`Found ${templateIdsToDelete.length} templates to delete`);

      // Delete related CustomerDesigns first to avoid foreign key constraint
      const deletedDesigns = await db.customerDesign.deleteMany({
        where: {
          templateId: { in: templateIdsToDelete },
        },
      });
      console.log(`Deleted ${deletedDesigns.count} related customer designs`);

      // Now delete the templates
      const deleteResult = await db.template.deleteMany({
        where: {
          id: { in: templateIdsToDelete },
        },
      });

      console.log(`Deleted ${deleteResult.count} variants using aggressive strategy`);

      // Verify deletion
      const variantsAfterDeletion = await db.template.count({
        where: {
          masterTemplateId: masterTemplateId,
          shop: session.shop,
        },
      });
      
      console.log(`${variantsAfterDeletion} variants remain after deletion`);

      return json({ 
        success: true, 
        message: `Deleted ${deleteResult.count} color variant(s) of "${masterTemplate.name}"` 
      });
    } catch (error) {
      console.error("Error deleting color variants:", error);
      return json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to delete color variants" 
      }, { status: 500 });
    }
  }

  if (action === "syncPreviews") {
    const templateId = formData.get("templateId") as string;
    
    try {
      // Get the template
      const template = await db.template.findFirst({
        where: {
          id: templateId,
          shop: session.shop,
        },
      });

      if (!template) {
        return json({ 
          success: false, 
          error: "Template not found" 
        }, { status: 404 });
      }

      // For dual-sided templates, prefer frontThumbnail over the legacy thumbnail
      const thumbnailToSync = template.frontThumbnail || template.thumbnail;
      
      if (!thumbnailToSync) {
        return json({ 
          success: false, 
          error: "Template has no thumbnail to sync" 
        });
      }

      // Dynamically import the sync service to avoid loading canvas renderer at module level
      const templateSyncModule = await import("../services/template-sync.server");
      
      // Use the original thumbnail sync (not server-side rendering for now)
      console.log(`Syncing template ${templateId} using ${template.frontThumbnail ? 'front thumbnail' : 'legacy thumbnail'}`);
      const syncResult = await templateSyncModule.syncTemplateThumbnailToVariants(
        admin, 
        templateId, 
        thumbnailToSync,
        template.backThumbnail // Pass back thumbnail for dual-sided templates
      );
      
      if (!syncResult.success && syncResult.errors.length > 0) {
        return json({ 
          success: false, 
          error: syncResult.errors[0],
          errors: syncResult.errors
        }, { status: 500 });
      }
      
      return json({ 
        success: true, 
        message: syncResult.totalCount === 0 
          ? "No variants found using this template"
          : `Successfully synced ${syncResult.syncedCount} of ${syncResult.totalCount} variant(s)`,
        errors: syncResult.errors.length > 0 ? syncResult.errors : undefined
      });
      
    } catch (error) {
      console.error("Error syncing previews:", error);
      return json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to sync previews" 
      }, { status: 500 });
    }
  }

  if (action === "syncProductThumbnails") {
    const productId = formData.get("productId") as string;
    
    try {
      // Create a job for syncing thumbnails for a specific product
      const { createJob } = await import("../services/job-queue.server");
      const { processJob } = await import("../services/job-processor-truly-fixed.server");
      
      const job = await createJob(
        session.shop,
        "syncProductThumbnails",
        { productId },
        0 // Will be updated during processing
      );
      
      // Start processing in background
      processJob(job.id, session.shop, admin).catch(error => {
        console.error(`Background sync job ${job.id} failed:`, error);
      });
      
      // Return immediately with job ID
      return json({ 
        success: true,
        message: "Syncing product thumbnails in background.",
        jobId: job.id,
        isBackground: true,
      });
      
    } catch (error) {
      console.error("Error starting sync job:", error);
      return json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to start sync job" 
      }, { status: 500 });
    }
  }

  if (action === "syncAllVariantThumbnails") {
    try {
      // Create a job for syncing all thumbnails
      const { createJob } = await import("../services/job-queue.server");
      const { processJob } = await import("../services/job-processor-truly-fixed.server");
      
      const job = await createJob(
        session.shop,
        "syncAllThumbnails",
        {},
        0 // Will be updated during processing
      );
      
      // Start processing in background
      processJob(job.id, session.shop, admin).catch(error => {
        console.error(`Background sync job ${job.id} failed:`, error);
      });
      
      // Return immediately with job ID
      return json({ 
        success: true,
        message: "Syncing all thumbnails in background. This may take a few minutes.",
        jobId: job.id,
        isBackground: true,
      });
      
    } catch (error) {
      console.error("Error starting sync job:", error);
      return json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to start sync job" 
      }, { status: 500 });
    }
  }

  if (action === "deleteTemplate") {
    const templateId = formData.get("templateId") as string;
    
    try {
      // Verify the template belongs to this shop before deleting
      const template = await db.template.findFirst({
        where: {
          id: templateId,
          shop: session.shop,
        },
      });

      if (!template) {
        return json({ 
          success: false, 
          error: "Template not found or access denied" 
        }, { status: 404 });
      }

      // First, delete any CustomerDesigns that reference this template
      const deletedDesigns = await db.customerDesign.deleteMany({
        where: {
          templateId: templateId,
        },
      });
      
      console.log(`Deleted ${deletedDesigns.count} customer designs associated with template ${templateId}`);

      // Now delete the template
      await db.template.delete({
        where: { id: templateId },
      });

      return json({ 
        success: true, 
        message: `Template "${template.name}" deleted successfully${deletedDesigns.count > 0 ? ` (and ${deletedDesigns.count} associated designs)` : ''}` 
      });
    } catch (error) {
      console.error("Error deleting template:", error);
      return json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to delete template" 
      }, { status: 500 });
    }
  }

  if (action === "assignTemplate") {
    const templateId = formData.get("templateId") as string;
    const variantsJson = formData.get("variants") as string;
    const variants = JSON.parse(variantsJson);

    console.log("Starting template assignment:", { templateId, variants });

    try {
      // Process each selected variant
      const results = await Promise.all(
        variants.map(async (variant: any) => {
          console.log(`Processing variant: ${variant.id}`);
          
          const response = await admin.graphql(
            METAFIELD_SET_MUTATION,
            {
              variables: {
                metafields: [
                  {
                    ownerId: variant.id,
                    namespace: "custom_designer",
                    key: "template_id",
                    value: templateId,
                    type: "single_line_text_field"
                  }
                ]
              }
            }
          );
          
          const result = await response.json() as any;
          console.log(`Response for variant ${variant.id}:`, JSON.stringify(result, null, 2));
          
          // Check for GraphQL errors
          if (result.errors) {
            console.error(`GraphQL errors for variant ${variant.id}:`, result.errors);
            throw new Error(`GraphQL error: ${JSON.stringify(result.errors)}`);
          }
          
          // Check for user errors
          if (result.data?.metafieldsSet?.userErrors?.length > 0) {
            const userErrors = result.data.metafieldsSet.userErrors;
            console.error(`User errors for variant ${variant.id}:`, userErrors);
            throw new Error(`User error: ${userErrors.map((e: any) => e.message).join(", ")}`);
          }
          
          return result;
        })
      );

      console.log("All variants processed successfully");

      return json({ 
        success: true, 
        message: `Template assigned to ${variants.length} variant(s)` 
      } as const);
    } catch (error) {
      console.error("Error assigning template:", error);
      return json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to assign template" 
      }, { status: 500 });
    }
  }

  return json({ success: false });
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  const templates = await db.template.findMany({
    where: {
      shop: session.shop,
    },
    include: {
      productLayout: true,
      layoutVariant: {
        include: {
          layout: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
  
  // Get available layouts for template creation
  const layouts = await db.layout.findMany({
    where: { shop: session.shop },
    include: {
      layoutVariants: {
        orderBy: { position: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  
  // Get unique product IDs from templates
  const productIds = [...new Set(templates
    .filter(t => t.shopifyProductId)
    .map(t => t.shopifyProductId!)
  )];
  
  // Import product mappings
  const { getSellingProductId } = await import("../config/product-mappings");
  
  // Fetch product names from Shopify - including mapped selling products
  const productNames: Record<string, string> = {};
  const allProductIds = new Set<string>();
  
  // Add both source and selling product IDs
  productIds.forEach(id => {
    allProductIds.add(id);
    const sellingId = getSellingProductId(id);
    if (sellingId !== id) {
      allProductIds.add(sellingId);
    }
  });
  
  if (allProductIds.size > 0) {
    try {
      const PRODUCTS_QUERY = `#graphql
        query GetProductNames($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Product {
              id
              title
            }
          }
        }
      `;
      
      const response = await admin.graphql(PRODUCTS_QUERY, {
        variables: { ids: Array.from(allProductIds) }
      });
      
      const data = await response.json();
      
      if (data.data?.nodes) {
        data.data.nodes.forEach((node: any) => {
          if (node?.id && node?.title) {
            productNames[node.id] = node.title;
          }
        });
      }
      
      // Map source product names to selling product names if available
      productIds.forEach(sourceId => {
        const sellingId = getSellingProductId(sourceId);
        if (sellingId !== sourceId && productNames[sellingId] && !productNames[sourceId]) {
          productNames[sourceId] = productNames[sellingId] + " (Source)";
        }
      });
    } catch (error) {
      console.error("Error fetching product names:", error);
    }
  }

  // Group templates by master template
  const templateGroups: Record<string, {
    master: typeof templates[0];
    variants: typeof templates;
  }> = {};

  // First, identify all master templates and create groups
  templates.forEach(template => {
    if (!template.isColorVariant && template.shopifyProductId) {
      templateGroups[template.id] = {
        master: template,
        variants: []
      };
    }
  });

  // Then, assign variants to their master templates
  templates.forEach(template => {
    if (template.isColorVariant && template.masterTemplateId) {
      if (templateGroups[template.masterTemplateId]) {
        templateGroups[template.masterTemplateId].variants.push(template);
      }
    }
  });

  // Sort variants within each group by color name
  Object.values(templateGroups).forEach(group => {
    group.variants.sort((a, b) => {
      const colorA = a.colorVariant || '';
      const colorB = b.colorVariant || '';
      return colorA.localeCompare(colorB);
    });
  });

  // Include standalone templates (no product association) as a separate list
  const standaloneTemplates = templates.filter(t => 
    !t.shopifyProductId && !t.isColorVariant
  );

  return json({ 
    templates, 
    templateGroups, 
    standaloneTemplates,
    productNames,
    layouts 
  });
};

export default function Templates() {
  const { templates, templateGroups, standaloneTemplates, productNames, layouts } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedVariants, setSelectedVariants] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<{ id: string; name: string } | null>(null);
  const [testRenderResult, setTestRenderResult] = useState<any>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [deleteAllVariantsModalOpen, setDeleteAllVariantsModalOpen] = useState(false);
  const [masterToDeleteVariants, setMasterToDeleteVariants] = useState<{ id: string; name: string; variantCount: number } | null>(null);
  const [layoutSelectorOpen, setLayoutSelectorOpen] = useState(false);
  const [selectedLayout, setSelectedLayout] = useState<any>(null);
  const [selectedLayoutVariant, setSelectedLayoutVariant] = useState<any>(null);
  const submit = useSubmit();
  const navigate = useNavigate();
  
  // Removed automatic thumbnail job checking
  // Users must manually click "Process Pending Thumbnails" to avoid contamination
  
  useEffect(() => {
    if (actionData?.success) {
      if (actionData.isBackground && actionData.jobId) {
        // Handle background job for sync all thumbnails
        if (actionData._action === 'syncAllVariantThumbnails' || actionData.message?.includes('thumbnails')) {
          // @ts-ignore - shopify is globally available in embedded apps
          if (typeof shopify !== 'undefined' && shopify.toast) {
            shopify.toast.show("Syncing thumbnails in background...", { duration: 10000 });
          }
          
          // Poll for job completion
          const checkInterval = setInterval(async () => {
            try {
              const statusResponse = await fetch(`/api/jobs/${actionData.jobId}`);
              const jobStatus = await statusResponse.json();
              
              if (jobStatus.status === 'completed') {
                clearInterval(checkInterval);
                // @ts-ignore - shopify is globally available in embedded apps
                if (typeof shopify !== 'undefined' && shopify.toast) {
                  shopify.toast.show(`✅ ${jobStatus.result?.message || 'Sync completed!'}`, { duration: 5000 });
                }
                // Refresh the page to show updated data
                navigate(".", { replace: true });
              } else if (jobStatus.status === 'failed') {
                clearInterval(checkInterval);
                // @ts-ignore - shopify is globally available in embedded apps
                if (typeof shopify !== 'undefined' && shopify.toast) {
                  shopify.toast.show(`❌ Sync failed: ${jobStatus.error}`, { error: true, duration: 5000 });
                }
              } else if (jobStatus.status === 'processing') {
                // Show progress if available
                if (jobStatus.progress && jobStatus.total) {
                  // @ts-ignore - shopify is globally available in embedded apps
                  if (typeof shopify !== 'undefined' && shopify.toast) {
                    shopify.toast.show(`Syncing: ${jobStatus.progress}/${jobStatus.total} templates...`, { duration: 2000 });
                  }
                }
              }
            } catch (error) {
              console.error('Error checking sync job status:', error);
            }
          }, 3000); // Check every 3 seconds
          
          // Stop polling after 10 minutes to prevent infinite polling
          setTimeout(() => {
            clearInterval(checkInterval);
          }, 10 * 60 * 1000);
        }
      } else {
        setShowSuccessBanner(true);
        setTimeout(() => setShowSuccessBanner(false), 5000);
      }
    }
  }, [actionData, navigate]);

  const handleAssignTemplate = useCallback(async (templateId: string) => {
    setSelectedTemplate(templateId);
    setLoading(true);
    
    try {
      // Fetch products and variants
      const response = await fetch('/app/api/products');
      const data = await response.json();
      setProducts(data.products || []);
      setPickerOpen(true);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleModalSubmit = useCallback(() => {
    if (selectedVariants.length > 0 && selectedTemplate) {
      const formData = new FormData();
      formData.append("templateId", selectedTemplate);
      formData.append("variants", JSON.stringify(selectedVariants.map(id => ({ id }))));
      formData.append("_action", "assignTemplate");
      submit(formData, { method: "post" });
    }
    setPickerOpen(false);
    setSelectedTemplate(null);
    setSelectedVariants([]);
  }, [selectedVariants, selectedTemplate, submit]);

  const handleDeleteTemplate = useCallback((id: string, name: string) => {
    setTemplateToDelete({ id, name });
    setDeleteModalOpen(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (templateToDelete) {
      const formData = new FormData();
      formData.append("templateId", templateToDelete.id);
      formData.append("_action", "deleteTemplate");
      submit(formData, { method: "post" });
    }
    setDeleteModalOpen(false);
    setTemplateToDelete(null);
  }, [templateToDelete, submit]);

  const confirmBulkDelete = useCallback(() => {
    if (selectedItems.length > 0) {
      const formData = new FormData();
      selectedItems.forEach(id => formData.append("templateIds[]", id));
      formData.append("_action", "deleteTemplates");
      submit(formData, { method: "post" });
      setSelectedItems([]);
    }
    setBulkDeleteModalOpen(false);
  }, [selectedItems, submit]);

  const handleDeleteAllVariants = useCallback((masterId: string, masterName: string, variantCount: number) => {
    setMasterToDeleteVariants({ id: masterId, name: masterName, variantCount });
    setDeleteAllVariantsModalOpen(true);
  }, []);

  const confirmDeleteAllVariants = useCallback(() => {
    if (masterToDeleteVariants) {
      const formData = new FormData();
      formData.append("masterTemplateId", masterToDeleteVariants.id);
      formData.append("_action", "deleteAllVariants");
      submit(formData, { method: "post" });
    }
    setDeleteAllVariantsModalOpen(false);
    setMasterToDeleteVariants(null);
  }, [masterToDeleteVariants, submit]);

  const toggleGroupExpanded = useCallback((groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  }, []);

  const handleSyncPreviews = useCallback((templateId: string) => {
    const formData = new FormData();
    formData.append("templateId", templateId);
    formData.append("_action", "syncPreviews");
    submit(formData, { method: "post" });
    // @ts-ignore - shopify is globally available in embedded apps
    if (typeof shopify !== 'undefined' && shopify.toast) {
      shopify.toast.show("Syncing preview images...");
    }
  }, [submit]);
  
  const handleGenerateColorVariants = useCallback(async (templateId: string) => {
    const formData = new FormData();
    formData.append("templateId", templateId);
    formData.append("background", "true"); // Use background processing
    
    // Show a loading toast if available
    // @ts-ignore - shopify is globally available in embedded apps
    if (typeof shopify !== 'undefined' && shopify.toast) {
      shopify.toast.show("Starting variant generation...");
    }
    
    try {
      const response = await fetch('/api/templates/generate-variants', {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      
      if (result.success) {
        if (result.isBackground && result.jobId) {
          // Background job started - poll for status
          // @ts-ignore - shopify is globally available in embedded apps
          if (typeof shopify !== 'undefined' && shopify.toast) {
            shopify.toast.show("Generating 49 variants in background. This will take a few minutes...", { duration: 10000 });
          }
          
          // Poll for job completion
          const checkInterval = setInterval(async () => {
            try {
              const statusResponse = await fetch(`/api/jobs/${result.jobId}`);
              const jobStatus = await statusResponse.json();
              
              if (jobStatus.status === 'completed') {
                clearInterval(checkInterval);
                // @ts-ignore - shopify is globally available in embedded apps
                if (typeof shopify !== 'undefined' && shopify.toast) {
                  const message = jobStatus.result?.thumbnailJobRequired 
                    ? '✅ Variants created! Click "Process Pending Thumbnails" button above to generate preview images.'
                    : jobStatus.result?.message || 'All variants generated successfully!';
                  shopify.toast.show(message, { duration: 8000 });
                }
                
                // Don't auto-trigger thumbnail processing to avoid contamination
                // User must manually click the button
                
                // Refresh the page to show new variants
                window.location.reload();
              } else if (jobStatus.status === 'failed') {
                clearInterval(checkInterval);
                // @ts-ignore - shopify is globally available in embedded apps
                if (typeof shopify !== 'undefined' && shopify.toast) {
                  shopify.toast.show(`❌ Failed: ${jobStatus.error}`, { error: true, duration: 5000 });
                }
              } else if (jobStatus.status === 'processing') {
                // Show progress if available
                if (jobStatus.progress && jobStatus.total) {
                  // @ts-ignore - shopify is globally available in embedded apps
                  if (typeof shopify !== 'undefined' && shopify.toast) {
                    shopify.toast.show(`Processing: ${jobStatus.progress}/${jobStatus.total} completed...`, { duration: 2000 });
                  }
                }
              }
            } catch (error) {
              console.error('Error checking job status:', error);
            }
          }, 3000); // Check every 3 seconds
          
          // Stop polling after 5 minutes to prevent infinite polling
          setTimeout(() => {
            clearInterval(checkInterval);
          }, 5 * 60 * 1000);
        } else {
          // Synchronous completion
          // @ts-ignore - shopify is globally available in embedded apps
          if (typeof shopify !== 'undefined' && shopify.toast) {
            shopify.toast.show(result.message, { duration: 5000 });
          }
          window.location.reload();
        }
      } else {
        // @ts-ignore - shopify is globally available in embedded apps
        if (typeof shopify !== 'undefined' && shopify.toast) {
          shopify.toast.show(result.error, { error: true });
        }
      }
    } catch (error) {
      console.error('Error generating color variants:', error);
      // @ts-ignore - shopify is globally available in embedded apps
      if (typeof shopify !== 'undefined' && shopify.toast) {
        shopify.toast.show('Failed to generate color variants', { error: true });
      }
    }
  }, [navigate]);
  
  const handleTestRender = useCallback(async (templateId: string) => {
    try {
      const formData = new FormData();
      formData.append("templateId", templateId);
      
      const response = await fetch('/api/test-template-render', {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      setTestRenderResult(result);
    } catch (error) {
      console.error('Test render error:', error);
    }
  }, []);

  const emptyStateMarkup = (
    <EmptyState
      heading="Create your first template"
      action={{
        content: "Create template",
        onAction: () => setLayoutSelectorOpen(true),
      }}
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <p>Start designing product customization templates for your store.</p>
    </EmptyState>
  );

  // Color mapping for color chips
  const colorChips: Record<string, string> = {
    'red': '🔴',
    'blue': '🔵',
    'green': '🟢',
    'yellow': '🟡',
    'black': '⚫',
    'white': '⚪',
    'purple': '🟣',
    'orange': '🟠',
    'pink': '🩷',
    'brown': '🟤',
    'grey': '⚪',
    'gray': '⚪',
    'light blue': '🩵',
    'ivory': '🟡',
  };

  const renderTemplateItem = (template: any, isVariant: boolean = false) => {
    const { id, name, thumbnail, frontThumbnail, backThumbnail, colorVariant, shopifyVariantId, isColorVariant, frontCanvasData, backCanvasData } = template;
    const isDualSided = !!(frontCanvasData || backCanvasData);
    
    // Helper function to clean up duplicate product names in alt text
    const getCleanAltText = (fullName: string, suffix?: string) => {
      // If name contains " - " twice, it likely has duplicate product name
      const parts = fullName.split(' - ');
      if (parts.length >= 3) {
        // Take first part (product) and last part (variant), skip middle duplicate
        const cleanName = `${parts[0]} - ${parts[parts.length - 1]}`;
        return suffix ? `${cleanName} - ${suffix}` : cleanName;
      }
      // Otherwise use the full name
      return suffix ? `${fullName} - ${suffix}` : fullName;
    };
    
    // For dual-sided templates, show both thumbnails
    const media = (frontThumbnail || backThumbnail) ? (
      <div style={{ display: 'flex', gap: '8px' }}>
        <div>
          <Text variant="bodySm" tone="subdued" as="p" style={{ fontSize: '11px', marginBottom: '4px' }}>
            Front
          </Text>
          <Thumbnail
            source={frontThumbnail || "https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"}
            alt={getCleanAltText(name, 'Front')}
            size="medium"
          />
        </div>
        <div>
          <Text variant="bodySm" tone="subdued" as="p" style={{ fontSize: '11px', marginBottom: '4px' }}>
            Back
          </Text>
          <Thumbnail
            source={backThumbnail || "https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"}
            alt={getCleanAltText(name, 'Back')}
            size="medium"
          />
        </div>
      </div>
    ) : thumbnail ? (
      <Thumbnail
        source={thumbnail}
        alt={getCleanAltText(name)}
        size="medium"
      />
    ) : (
      <Thumbnail
        source="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        alt="No preview"
        size="medium"
      />
    );

    const needsAssignment = isColorVariant && !shopifyVariantId;

    return (
      <div 
        key={id}
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          padding: '12px',
          marginLeft: isVariant ? '40px' : '0',
          backgroundColor: isVariant ? '#f9fafb' : 'transparent',
          borderRadius: '8px',
          marginBottom: '4px',
          border: needsAssignment ? '2px solid #ffcc00' : 'none'
        }}
      >
        {media}
        <div style={{ flex: 1 }}>
          <InlineStack gap="200" align="start">
            <Text variant="bodyMd" as="span">
              {name}
            </Text>
            {colorVariant && (
              <span>{colorChips[colorVariant.toLowerCase()] || ''} {colorVariant}</span>
            )}
            {isDualSided && (
              <Badge tone="info">Dual-sided</Badge>
            )}
            {needsAssignment && (
              <Badge tone="warning">Unassigned</Badge>
            )}
          </InlineStack>
          {isDualSided && (
            <Text variant="bodySm" tone="subdued" as="p">
              Front: {frontCanvasData ? '✅' : '❌'} | Back: {backCanvasData ? '✅' : '❌'}
            </Text>
          )}
        </div>
        <ButtonGroup>
          <Button
            size="slim"
            url={`/app/designer?template=${id}`}
          >
            Edit
          </Button>
          <Button
            size="slim"
            onClick={() => handleAssignTemplate(id)}
          >
            Assign
          </Button>
          <Button
            size="slim"
            tone="critical"
            onClick={() => handleDeleteTemplate(id, name)}
          >
            Delete
          </Button>
        </ButtonGroup>
      </div>
    );
  };

  const groupedTemplatesMarkup = (
    <BlockStack gap="400">
      {Object.entries(templateGroups).map(([masterId, group]) => {
        const isExpanded = expandedGroups.has(masterId);
        const productName = group.master.shopifyProductId ? 
          productNames[group.master.shopifyProductId] || 'Unknown Product' : 
          'No Product';
        
        // Count unassigned variants
        const unassignedVariants = group.variants.filter(v => !v.shopifyVariantId);
        const hasUnassignedVariants = unassignedVariants.length > 0;
        
        return (
          <Card key={masterId}>
            <BlockStack gap="300">
              <InlineStack align="space-between">
                <InlineStack gap="200" align="center">
                  <Button
                    variant="plain"
                    onClick={() => toggleGroupExpanded(masterId)}
                    icon={isExpanded ? ChevronDownIcon : ChevronRightIcon}
                  />
                  <Text variant="headingMd" as="h3">
                    {group.master.name}
                  </Text>
                  <Badge tone="warning">Master Template</Badge>
                  <Text variant="bodySm" tone="subdued">
                    ({group.variants.length} variants)
                  </Text>
                  {hasUnassignedVariants && (
                    <Badge tone="critical">
                      {unassignedVariants.length} unassigned
                    </Badge>
                  )}
                </InlineStack>
                <ButtonGroup>
                  <Button
                    onClick={() => handleGenerateColorVariants(masterId)}
                    disabled={group.variants.length > 0}
                  >
                    Generate variants
                  </Button>
                  {group.variants.length > 0 && (
                    <>
                      <Button
                        tone="critical"
                        onClick={() => handleDeleteAllVariants(masterId, group.master.name, group.variants.length)}
                      >
                        Delete all variants
                      </Button>
                      <Button
                        tone="critical"
                        variant="plain"
                        onClick={async () => {
                          // Run diagnostics
                          const formData = new FormData();
                          formData.append("masterTemplateId", masterId);
                          
                          const response = await fetch("/api/diagnose-templates", {
                            method: "POST",
                            body: formData,
                          });
                          
                          const diagnostics = await response.json();
                          console.log("Template diagnostics:", diagnostics);
                          
                          if (diagnostics.orphanedVariants?.count > 0 || 
                              diagnostics.suspiciousVariants?.count > 0) {
                            if (confirm(`Found ${diagnostics.orphanedVariants.count} orphaned and ${diagnostics.suspiciousVariants.count} suspicious variants. Delete them all?`)) {
                              const deleteForm = new FormData();
                              deleteForm.append("masterTemplateId", masterId);
                              deleteForm.append("_action", "nuclearDelete");
                              submit(deleteForm, { method: "post" });
                            }
                          } else {
                            alert("No orphaned variants found. Try regular delete.");
                          }
                        }}
                      >
                        Debug & Clean
                      </Button>
                    </>
                  )}
                  <Button
                    url={`/app/designer?template=${masterId}`}
                  >
                    Edit master
                  </Button>
                </ButtonGroup>
              </InlineStack>
              
              <Text variant="bodySm" tone="subdued">
                Product: {productName}
              </Text>
              
              {hasUnassignedVariants && (
                <Banner tone="warning">
                  <p>
                    {unassignedVariants.length} template variant{unassignedVariants.length > 1 ? 's' : ''} not assigned to product variants. 
                    This usually means the color/pattern matching failed during generation.
                  </p>
                </Banner>
              )}

              {renderTemplateItem(group.master)}

              <Collapsible
                open={isExpanded}
                id={`group-${masterId}`}
                transition={{duration: '150ms', timingFunction: 'ease-in-out'}}
              >
                <BlockStack gap="200">
                  {group.variants.map(variant => renderTemplateItem(variant, true))}
                </BlockStack>
              </Collapsible>
            </BlockStack>
          </Card>
        );
      })}

      {standaloneTemplates.length > 0 && (
        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd" as="h3">Standalone Templates</Text>
            {standaloneTemplates.map(template => renderTemplateItem(template))}
          </BlockStack>
        </Card>
      )}
    </BlockStack>
  );

  return (
    <Page fullWidth>
      {showSuccessBanner && actionData?.success && 'message' in actionData && (
        <Banner tone="success" onDismiss={() => setShowSuccessBanner(false)}>
          <p>{actionData.message}</p>
        </Banner>
      )}
      
      {actionData && !actionData.success && 'error' in actionData && actionData.error && (
        <Banner tone="critical" onDismiss={() => {}}>
          <p>Error: {actionData.error as string}</p>
        </Banner>
      )}
      
      <TitleBar title="Templates">
        <button variant="primary" onClick={() => setLayoutSelectorOpen(true)}>
          Create template
        </button>
        <button onClick={() => {
          const variantId = prompt("Enter the Shopify variant ID to diagnose (e.g., gid://shopify/ProductVariant/123456789):");
          if (variantId) {
            fetch('/api/diagnose-variant-template', {
              method: 'POST',
              body: new URLSearchParams({ variantId, action: 'diagnose' })
            })
            .then(res => res.json())
            .then(data => {
              console.log('Variant diagnosis:', data);
              if (data.template && !data.template.found) {
                if (confirm(`Template ${data.variant.metafieldValue} not found. Would you like to see suggestions?`)) {
                  console.log('Suggested templates:', data.productTemplates);
                  alert(`Found ${data.productTemplates.count} templates for this product. Check console for details.`);
                }
              } else {
                alert('Template found and valid. Check console for full diagnosis.');
              }
            })
            .catch(err => {
              console.error('Diagnosis error:', err);
              alert('Error diagnosing variant. Check console.');
            });
          }
        }}>
          Diagnose Variant
        </button>
      </TitleBar>
      <Layout>
        <Layout.Section>
          {templates.some(t => t.shopifyProductId) && (
            <Card>
              <BlockStack gap="400">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text variant="headingMd" as="h2">Bulk Actions</Text>
                  <ButtonGroup>
                    <Button
                      onClick={async () => {
                        try {
                          const response = await fetch('/api/process-thumbnail-jobs', {
                            method: 'POST',
                          });
                          
                          const result = await response.json();
                          
                          // @ts-ignore - shopify is globally available in embedded apps
                          if (typeof shopify !== 'undefined' && shopify.toast) {
                            if (result.success) {
                              shopify.toast.show(result.message || 'Thumbnail processing complete');
                              if (result.processed > 0) {
                                // Reload after a short delay to show updated thumbnails
                                setTimeout(() => window.location.reload(), 2000);
                              }
                            } else {
                              shopify.toast.show(result.error || 'Failed to process thumbnails', { error: true });
                            }
                          }
                        } catch (error) {
                          console.error('Error processing thumbnails:', error);
                          // @ts-ignore - shopify is globally available in embedded apps
                          if (typeof shopify !== 'undefined' && shopify.toast) {
                            shopify.toast.show('Failed to process thumbnails', { error: true });
                          }
                        }
                      }}
                      tone="success"
                    >
                      Process Pending Thumbnails
                    </Button>
                    <Button
                      onClick={async () => {
                        const formData = new FormData();
                        formData.append("_action", "syncAllVariantThumbnails");
                        submit(formData, { method: "post" });
                        
                        // @ts-ignore - shopify is globally available in embedded apps
                        if (typeof shopify !== 'undefined' && shopify.toast) {
                          shopify.toast.show("Checking which variants need thumbnails...");
                        }
                      }}
                    >
                      Sync ALL missing thumbnails
                    </Button>
                  </ButtonGroup>
                </div>
                <Text variant="bodySm" tone="subdued" as="p">
                  • <strong>Process Pending Thumbnails</strong>: Generate thumbnails for templates created without previews (use after "Generate variants")<br/>
                  • <strong>Sync ALL missing thumbnails</strong>: Upload existing thumbnails to Shopify product variants that don't have images yet
                </Text>
                
                {/* Group templates by product */}
                {(() => {
                  const productGroups = templates.reduce((acc, template) => {
                    if (template.shopifyProductId) {
                      if (!acc[template.shopifyProductId]) {
                        // Get product name from Shopify data or fallback
                        const productName = productNames[template.shopifyProductId] || 
                          `Product ${template.shopifyProductId.split('/').pop()}`;
                        
                        acc[template.shopifyProductId] = {
                          productId: template.shopifyProductId,
                          productName: productName,
                          templates: []
                        };
                      }
                      acc[template.shopifyProductId].templates.push(template);
                    }
                    return acc;
                  }, {} as Record<string, any>);
                  
                  const groups = Object.values(productGroups).sort((a, b) => 
                    a.productName.localeCompare(b.productName)
                  );
                  
                  return groups.length > 0 ? (
                    <>
                      <Text variant="headingSm" as="h3">Sync by Product</Text>
                      {groups.map((group) => (
                        <div key={group.productId} style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          padding: '12px',
                          backgroundColor: '#f6f6f7',
                          borderRadius: '8px'
                        }}>
                          <div>
                            <Text variant="bodyMd" fontWeight="semibold" as="p">
                              {group.productName}
                            </Text>
                            <Text variant="bodySm" tone="subdued" as="p">
                              {group.templates.length} templates
                            </Text>
                          </div>
                          <Button
                            size="slim"
                            onClick={async () => {
                              const formData = new FormData();
                              formData.append("_action", "syncProductThumbnails");
                              formData.append("productId", group.productId);
                              submit(formData, { method: "post" });
                              
                              // @ts-ignore - shopify is globally available in embedded apps
                              if (typeof shopify !== 'undefined' && shopify.toast) {
                                shopify.toast.show(`Syncing thumbnails for ${group.productName}...`);
                              }
                            }}
                          >
                            Sync this product
                          </Button>
                        </div>
                      ))}
                    </>
                  ) : null;
                })()}
              </BlockStack>
            </Card>
          )}
          {templates.length === 0 ? (
            <Card padding="0" style={{ marginTop: '16px' }}>
              {emptyStateMarkup}
            </Card>
          ) : (
            groupedTemplatesMarkup
          )}
        </Layout.Section>
      </Layout>
      
      <Modal
        open={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
          setSelectedTemplate(null);
          setSelectedVariants([]);
        }}
        title="Select Product Variants"
        primaryAction={{
          content: "Assign Template",
          onAction: handleModalSubmit,
          disabled: selectedVariants.length === 0,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => {
              setPickerOpen(false);
              setSelectedTemplate(null);
              setSelectedVariants([]);
            },
          },
        ]}
      >
        <Modal.Section>
          {loading ? (
            <Text as="p">Loading products...</Text>
          ) : products.length === 0 ? (
            <Text as="p">No products found.</Text>
          ) : (
            <>
              {/* Show color assignment option for templates with colorVariant */}
              {selectedTemplate && templates.find(t => t.id === selectedTemplate)?.colorVariant && (
                <Banner tone="info">
                  <p>
                    This template is designed for <strong>{templates.find(t => t.id === selectedTemplate)?.colorVariant}</strong> variants. 
                    You can assign it to all {templates.find(t => t.id === selectedTemplate)?.colorVariant} variants at once or select specific ones below.
                  </p>
                  <div style={{ marginTop: '12px' }}>
                    <Button
                      onClick={() => {
                        const templateColor = templates.find(t => t.id === selectedTemplate)?.colorVariant?.toLowerCase();
                        if (templateColor) {
                          // Find all variants that match this color
                          const colorVariants: string[] = [];
                          products.forEach((product: any) => {
                            product.variants.edges.forEach((edge: any) => {
                              const variantName = edge.node.displayName.toLowerCase();
                              if (variantName.includes(templateColor)) {
                                colorVariants.push(edge.node.id);
                              }
                            });
                          });
                          setSelectedVariants(colorVariants);
                        }
                      }}
                      variant="primary"
                    >
                      Select all {templates.find(t => t.id === selectedTemplate)?.colorVariant} variants
                    </Button>
                  </div>
                </Banner>
              )}
              <div style={{ maxHeight: '400px', overflowY: 'auto', marginTop: '16px' }}>
                {products.map((product: any) => (
                  <div key={product.id} style={{ marginBottom: '16px' }}>
                    <Text variant="headingMd" as="h3">{product.title}</Text>
                    <ChoiceList
                      title="Select variants"
                      allowMultiple
                      choices={product.variants.edges.map((edge: any) => ({
                        label: edge.node.displayName,
                        value: edge.node.id,
                      }))}
                      selected={selectedVariants}
                      onChange={setSelectedVariants}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </Modal.Section>
      </Modal>
      
      <Modal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setTemplateToDelete(null);
        }}
        title="Delete template?"
        primaryAction={{
          content: "Delete",
          destructive: true,
          onAction: confirmDelete,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => {
              setDeleteModalOpen(false);
              setTemplateToDelete(null);
            },
          },
        ]}
      >
        <Modal.Section>
          <Text as="p">
            Are you sure you want to delete the template "{templateToDelete?.name}"? This action cannot be undone.
          </Text>
        </Modal.Section>
      </Modal>
      
      <Modal
        open={bulkDeleteModalOpen}
        onClose={() => {
          setBulkDeleteModalOpen(false);
        }}
        title={`Delete ${selectedItems.length} template${selectedItems.length === 1 ? '' : 's'}?`}
        primaryAction={{
          content: "Delete",
          destructive: true,
          onAction: confirmBulkDelete,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => {
              setBulkDeleteModalOpen(false);
            },
          },
        ]}
      >
        <Modal.Section>
          <Text as="p">
            Are you sure you want to delete {selectedItems.length} template{selectedItems.length === 1 ? '' : 's'}? This action cannot be undone.
          </Text>
        </Modal.Section>
      </Modal>
      
      {testRenderResult && (
        <Modal
          open={true}
          onClose={() => setTestRenderResult(null)}
          title="Server Render Test Result"
          size="large"
        >
          <Modal.Section>
            {testRenderResult.success ? (
              <>
                <Banner tone="success">
                  <p>{testRenderResult.message}</p>
                </Banner>
                <div style={{ marginTop: '16px', textAlign: 'center' }}>
                  <img 
                    src={testRenderResult.dataUrl} 
                    alt="Server rendered template"
                    style={{ 
                      maxWidth: '100%',
                      border: '1px solid #ccc'
                    }} 
                  />
                </div>
              </>
            ) : (
              <Banner tone="critical">
                <p>Error: {testRenderResult.error}</p>
              </Banner>
            )}
          </Modal.Section>
        </Modal>
      )}
      
      <Modal
        open={deleteAllVariantsModalOpen}
        onClose={() => {
          setDeleteAllVariantsModalOpen(false);
          setMasterToDeleteVariants(null);
        }}
        title="Delete all color variants?"
        primaryAction={{
          content: "Delete all variants",
          destructive: true,
          onAction: confirmDeleteAllVariants,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => {
              setDeleteAllVariantsModalOpen(false);
              setMasterToDeleteVariants(null);
            },
          },
        ]}
      >
        <Modal.Section>
          <Text as="p">
            Are you sure you want to delete all {masterToDeleteVariants?.variantCount} color variants of "{masterToDeleteVariants?.name}"? 
          </Text>
          <Text as="p" tone="subdued">
            This will only delete the color variants, not the master template. This action cannot be undone.
          </Text>
        </Modal.Section>
      </Modal>
      
      <Modal
        open={layoutSelectorOpen}
        onClose={() => {
          setLayoutSelectorOpen(false);
          setSelectedLayout(null);
          setSelectedLayoutVariant(null);
        }}
        title="Select Layout for Template"
        primaryAction={selectedLayoutVariant ? {
          content: "Create Template",
          onAction: () => {
            if (selectedLayoutVariant) {
              // Navigate to designer with layout variant
              navigate(`/app/designer?layoutVariantId=${selectedLayoutVariant.id}`);
            }
          },
        } : undefined}
        secondaryActions={[{
          content: "Cancel",
          onAction: () => {
            setLayoutSelectorOpen(false);
            setSelectedLayout(null);
            setSelectedLayoutVariant(null);
          },
        }]}
        size="large"
      >
        <Modal.Section>
          {layouts.length === 0 ? (
            <EmptyState
              heading="No layouts available"
              action={{
                content: "Create a layout",
                url: "/app/product-layouts",
              }}
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>Create a product layout first to start designing templates.</p>
            </EmptyState>
          ) : (
            <BlockStack gap="400">
              <Text as="p">
                Select a layout and variant to create your template from:
              </Text>
              
              {layouts.map((layout) => (
                <Card key={layout.id}>
                  <BlockStack gap="300">
                    <InlineStack align="space-between">
                      <Text variant="headingMd" as="h3">{layout.productTitle}</Text>
                      <Badge>{layout.layoutVariants.length} variants</Badge>
                    </InlineStack>
                    
                    <Grid columns={{ xs: 3, sm: 4, md: 6 }}>
                      {layout.layoutVariants.map((variant) => (
                        <div 
                          key={variant.id}
                          onClick={() => {
                            setSelectedLayout(layout);
                            setSelectedLayoutVariant(variant);
                          }}
                          style={{ 
                            cursor: 'pointer',
                            textAlign: 'center',
                            padding: '8px',
                            borderRadius: '8px',
                            border: selectedLayoutVariant?.id === variant.id ? '2px solid #5c6ac4' : '2px solid transparent',
                            backgroundColor: selectedLayoutVariant?.id === variant.id ? '#f4f6f8' : 'transparent',
                          }}
                        >
                          <Thumbnail
                            source={variant.baseImageUrl}
                            alt={variant.variantTitle}
                            size="large"
                          />
                          <Text variant="bodySm" as="p">
                            {variant.color || variant.variantTitle}
                          </Text>
                        </div>
                      ))}
                    </Grid>
                  </BlockStack>
                </Card>
              ))}
            </BlockStack>
          )}
        </Modal.Section>
      </Modal>
    </Page>
  );
}
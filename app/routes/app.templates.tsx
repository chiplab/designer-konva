import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useActionData, useNavigate } from "@remix-run/react";
import { useState, useCallback, useEffect } from "react";
import {
  Page,
  Layout,
  Card,
  ResourceList,
  ResourceItem,
  Text,
  Thumbnail,
  EmptyState,
  Badge,
  Modal,
  ChoiceList,
  Banner,
  Button,
  BlockStack,
} from "@shopify/polaris";
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

      // Delete all templates
      await db.template.deleteMany({
        where: {
          id: { in: templateIds },
          shop: session.shop,
        },
      });

      return json({ 
        success: true, 
        message: `${templates.length} template(s) deleted successfully` 
      });
    } catch (error) {
      console.error("Error deleting templates:", error);
      return json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to delete templates" 
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

      if (!template.thumbnail) {
        return json({ 
          success: false, 
          error: "Template has no thumbnail to sync" 
        });
      }

      // Dynamically import the sync service to avoid loading canvas renderer at module level
      const templateSyncModule = await import("../services/template-sync.server");
      
      // Use the original thumbnail sync (not server-side rendering for now)
      const syncResult = await templateSyncModule.syncTemplateThumbnailToVariants(admin, templateId, template.thumbnail);
      
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

  if (action === "syncAllVariantThumbnails") {
    try {
      // Create a job for syncing all thumbnails
      const { createJob } = await import("../services/job-queue.server");
      const { processJob } = await import("../services/job-processor.server");
      
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

      // Delete the template
      await db.template.delete({
        where: { id: templateId },
      });

      return json({ 
        success: true, 
        message: `Template "${template.name}" deleted successfully` 
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
  const { session } = await authenticate.admin(request);

  const templates = await db.template.findMany({
    where: {
      shop: session.shop,
    },
    include: {
      productLayout: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return json({ templates });
};

export default function Templates() {
  const { templates } = useLoaderData<typeof loader>();
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
  const submit = useSubmit();
  const navigate = useNavigate();
  
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
                  shopify.toast.show(`✅ ${jobStatus.result?.message || 'All variants generated successfully!'}`, { duration: 5000 });
                }
                // Refresh the page
                navigate(".", { replace: true });
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
          navigate(".", { replace: true });
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
        url: "/app/designer",
      }}
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <p>Start designing product customization templates for your store.</p>
    </EmptyState>
  );

  const bulkActions = [
    {
      content: `Delete ${selectedItems.length} template${selectedItems.length === 1 ? '' : 's'}`,
      destructive: true,
      onAction: () => setBulkDeleteModalOpen(true),
    },
  ];

  const resourceListMarkup = (
    <ResourceList
      resourceName={{ singular: "template", plural: "templates" }}
      items={templates}
      selectedItems={selectedItems}
      onSelectionChange={setSelectedItems}
      bulkActions={bulkActions}
      selectable
      renderItem={(template) => {
        const { id, name, thumbnail, createdAt, updatedAt, colorVariant, productLayout, isColorVariant, shopifyProductId } = template;
        const media = thumbnail ? (
          <Thumbnail
            source={thumbnail}
            alt={name}
            size="large"
          />
        ) : (
          <Thumbnail
            source="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            alt="No preview"
            size="large"
          />
        );

        return (
          <ResourceItem
            id={id}
            url={`/app/designer?template=${id}`}
            media={media}
            accessibilityLabel={`View details for ${name}`}
            shortcutActions={[
              {
                content: "Assign to products",
                onAction: () => handleAssignTemplate(id),
              },
              {
                content: "Generate variants",
                onAction: () => handleGenerateColorVariants(id),
                disabled: template.isColorVariant || !template.shopifyProductId,
              },
              {
                content: "Re-sync preview images",
                onAction: () => handleSyncPreviews(id),
              },
              {
                content: "Test server render",
                onAction: () => handleTestRender(id),
              },
              {
                content: "Delete",
                destructive: true,
                onAction: () => handleDeleteTemplate(id, name),
              },
            ]}
          >
            <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between" }}>
              <div>
                <Text variant="bodyMd" fontWeight="bold" as="h3">
                  {name}
                </Text>
                <div style={{ marginTop: "4px" }}>
                  {productLayout && (
                    <Text variant="bodySm" tone="subdued" as="p">
                      Layout: {productLayout.name}
                    </Text>
                  )}
                  <Text variant="bodySm" tone="subdued" as="p">
                    Created: {new Date(createdAt).toLocaleDateString()}
                    {updatedAt !== createdAt && ` • Updated: ${new Date(updatedAt).toLocaleDateString()}`}
                  </Text>
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                {colorVariant && (
                  <Badge tone="success">{colorVariant.charAt(0).toUpperCase() + colorVariant.slice(1)}</Badge>
                )}
                {template.isColorVariant ? (
                  <Badge tone="info">Color Variant</Badge>
                ) : template.shopifyProductId ? (
                  <Badge tone="warning">Master Template</Badge>
                ) : (
                  <Badge tone="info">Template</Badge>
                )}
              </div>
            </div>
          </ResourceItem>
        );
      }}
    />
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
        <button variant="primary" onClick={() => window.location.href = "/app/product-layouts"}>
          Create template
        </button>
      </TitleBar>
      <Layout>
        <Layout.Section>
          {templates.some(t => t.shopifyProductId) && (
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="headingMd" as="h2">Bulk Actions</Text>
                <Button
                  onClick={async () => {
                    const formData = new FormData();
                    formData.append("_action", "syncAllVariantThumbnails");
                    submit(formData, { method: "post" });
                    
                    // @ts-ignore - shopify is globally available in embedded apps
                    if (typeof shopify !== 'undefined' && shopify.toast) {
                      shopify.toast.show("Starting thumbnail sync job...");
                    }
                  }}
                >
                  Sync all variant thumbnails
                </Button>
              </div>
              <Text variant="bodySm" tone="subdued" as="p" style={{ marginTop: '8px' }}>
                This will sync thumbnails for all templates to their corresponding product variants
              </Text>
            </Card>
          )}
          <Card padding="0" style={{ marginTop: '16px' }}>
            {templates.length === 0 ? emptyStateMarkup : resourceListMarkup}
          </Card>
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
    </Page>
  );
}
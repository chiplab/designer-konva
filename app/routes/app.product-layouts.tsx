import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useActionData } from "@remix-run/react";
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
  Modal,
  FormLayout,
  TextField,
  Button,
  Banner,
  Badge,
  Grid,
  InlineGrid,
  Box,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { uploadToS3 } from "../services/s3.server";

type LayoutAttributes = {
  colors?: string[];
  edgePatterns?: string[];
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("_action");

  if (action === "create") {
    const name = formData.get("name") as string;
    const width = parseInt(formData.get("width") as string);
    const height = parseInt(formData.get("height") as string);
    const imageFile = formData.get("baseImage") as File;
    const attributes = JSON.parse(formData.get("attributes") as string || "{}");

    try {
      // Upload image to S3
      const buffer = Buffer.from(await imageFile.arrayBuffer());
      const key = `layouts/${session.shop}/${Date.now()}-${imageFile.name}`;
      const baseImageUrl = await uploadToS3(key, buffer, { contentType: imageFile.type });

      // Create ProductLayout
      // For poker chips, use circular designable area
      const diameter = Math.min(width, height) * 0.744; // 74.4% of canvas
      const designableArea = {
        shape: "circle",
        diameter: diameter,
        x: width / 2 - diameter / 2,
        y: height / 2 - diameter / 2,
      };
      
      const layout = await db.productLayout.create({
        data: {
          name,
          shop: session.shop,
          width,
          height,
          baseImageUrl,
          attributes,
          designableArea,
        },
      });

      return json({ success: true, layout });
    } catch (error) {
      console.error("Error creating product layout:", error);
      return json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to create layout" 
      }, { status: 500 });
    }
  }

  if (action === "update") {
    const layoutId = formData.get("layoutId") as string;
    const name = formData.get("name") as string;
    const width = parseInt(formData.get("width") as string);
    const height = parseInt(formData.get("height") as string);
    const imageFile = formData.get("baseImage") as File | null;
    const attributes = JSON.parse(formData.get("attributes") as string || "{}");

    try {
      // Verify ownership
      const existingLayout = await db.productLayout.findFirst({
        where: { 
          id: layoutId,
          shop: session.shop 
        },
      });

      if (!existingLayout) {
        return json({ 
          success: false, 
          error: "Layout not found or access denied" 
        }, { status: 404 });
      }

      let baseImageUrl = existingLayout.baseImageUrl;
      
      // Upload new image if provided
      if (imageFile && imageFile.size > 0) {
        const buffer = Buffer.from(await imageFile.arrayBuffer());
        const key = `layouts/${session.shop}/${Date.now()}-${imageFile.name}`;
        baseImageUrl = await uploadToS3(key, buffer, { contentType: imageFile.type });
      }

      // Recalculate designable area
      const diameter = Math.min(width, height) * 0.744;
      const designableArea = {
        shape: "circle",
        diameter: diameter,
        x: width / 2 - diameter / 2,
        y: height / 2 - diameter / 2,
      };

      // Update ProductLayout
      const layout = await db.productLayout.update({
        where: { id: layoutId },
        data: {
          name,
          width,
          height,
          baseImageUrl,
          attributes,
          designableArea,
        },
      });

      return json({ success: true, layout });
    } catch (error) {
      console.error("Error updating product layout:", error);
      return json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to update layout" 
      }, { status: 500 });
    }
  }

  if (action === "updateVariantImages") {
    const layoutId = formData.get("layoutId") as string;
    const variantImages = JSON.parse(formData.get("variantImages") as string || "{}");

    try {
      // Verify ownership
      const existingLayout = await db.productLayout.findFirst({
        where: { 
          id: layoutId,
          shop: session.shop 
        },
      });

      if (!existingLayout) {
        return json({ 
          success: false, 
          error: "Layout not found or access denied" 
        }, { status: 404 });
      }

      // Update variant images
      await db.productLayout.update({
        where: { id: layoutId },
        data: {
          variantImages,
        },
      });

      return json({ success: true });
    } catch (error) {
      console.error("Error updating variant images:", error);
      return json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to update variant images" 
      }, { status: 500 });
    }
  }

  if (action === "delete") {
    const layoutId = formData.get("layoutId") as string;
    
    try {
      // Check if layout has templates
      const templateCount = await db.template.count({
        where: { productLayoutId: layoutId },
      });

      if (templateCount > 0) {
        return json({ 
          success: false, 
          error: `Cannot delete layout: ${templateCount} templates are using it` 
        });
      }

      await db.productLayout.delete({
        where: { id: layoutId },
      });

      return json({ success: true });
    } catch (error) {
      console.error("Error deleting layout:", error);
      return json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to delete layout" 
      }, { status: 500 });
    }
  }

  return json({ success: false });
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const layouts = await db.productLayout.findMany({
    where: { shop: session.shop },
    include: {
      _count: {
        select: { templates: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return json({ layouts });
};

export default function ProductLayouts() {
  const { layouts } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [variantImagesModalOpen, setVariantImagesModalOpen] = useState(false);
  const [layoutToDelete, setLayoutToDelete] = useState<any>(null);
  const [layoutToEdit, setLayoutToEdit] = useState<any>(null);
  const [variantImages, setVariantImages] = useState<Record<string, string>>({});
  
  // Form state
  const [name, setName] = useState("");
  const [width, setWidth] = useState("600");
  const [height, setHeight] = useState("400");
  const [baseImageFile, setBaseImageFile] = useState<File | null>(null);
  const [colors, setColors] = useState("red,blue,green");
  const [edgePatterns, setEdgePatterns] = useState("8-spot,solid,stripe");

  useEffect(() => {
    if (actionData?.success) {
      setCreateModalOpen(false);
      setEditModalOpen(false);
      setDeleteModalOpen(false);
      setVariantImagesModalOpen(false);
      // Reset form
      setName("");
      setWidth("600");
      setHeight("400");
      setBaseImageFile(null);
      setColors("red,blue,green");
      setEdgePatterns("8-spot,solid,stripe");
      setLayoutToEdit(null);
    }
  }, [actionData]);

  useEffect(() => {
    if (layoutToEdit) {
      setName(layoutToEdit.name);
      setWidth(String(layoutToEdit.width));
      setHeight(String(layoutToEdit.height));
      setColors(layoutToEdit.attributes?.colors?.join(",") || "");
      setEdgePatterns(layoutToEdit.attributes?.edgePatterns?.join(",") || "");
      setVariantImages(layoutToEdit.variantImages || {});
    }
  }, [layoutToEdit]);

  const handleCreateSubmit = useCallback(() => {
    if (!name || !baseImageFile) return;

    const formData = new FormData();
    formData.append("_action", "create");
    formData.append("name", name);
    formData.append("width", width);
    formData.append("height", height);
    formData.append("baseImage", baseImageFile);
    
    const attributes = {
      colors: colors.split(",").map(c => c.trim()).filter(Boolean),
      edgePatterns: edgePatterns.split(",").map(p => p.trim()).filter(Boolean),
    };
    formData.append("attributes", JSON.stringify(attributes));

    submit(formData, { method: "post", encType: "multipart/form-data" });
  }, [name, width, height, baseImageFile, colors, edgePatterns, submit]);

  const handleEditSubmit = useCallback(() => {
    if (!name || !layoutToEdit) return;

    const formData = new FormData();
    formData.append("_action", "update");
    formData.append("layoutId", layoutToEdit.id);
    formData.append("name", name);
    formData.append("width", width);
    formData.append("height", height);
    if (baseImageFile) {
      formData.append("baseImage", baseImageFile);
    }
    
    const attributes = {
      colors: colors.split(",").map(c => c.trim()).filter(Boolean),
      edgePatterns: edgePatterns.split(",").map(p => p.trim()).filter(Boolean),
    };
    formData.append("attributes", JSON.stringify(attributes));

    submit(formData, { method: "post", encType: "multipart/form-data" });
  }, [name, width, height, baseImageFile, colors, edgePatterns, layoutToEdit, submit]);

  const handleEdit = useCallback((layout: any) => {
    setLayoutToEdit(layout);
    setEditModalOpen(true);
  }, []);

  const handleDelete = useCallback((layout: any) => {
    setLayoutToDelete(layout);
    setDeleteModalOpen(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!layoutToDelete) return;

    const formData = new FormData();
    formData.append("_action", "delete");
    formData.append("layoutId", layoutToDelete.id);
    submit(formData, { method: "post" });
  }, [layoutToDelete, submit]);

  const emptyStateMarkup = (
    <EmptyState
      heading="Create your first product layout"
      action={{
        content: "Create layout",
        onAction: () => setCreateModalOpen(true),
      }}
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <p>Product layouts define the physical products you'll customize.</p>
    </EmptyState>
  );

  const resourceListMarkup = (
    <ResourceList
      resourceName={{ singular: "layout", plural: "layouts" }}
      items={layouts}
      renderItem={(layout) => {
        const { id, name, baseImageUrl, width, height, _count } = layout;
        const attributes = layout.attributes as LayoutAttributes;
        const media = (
          <Thumbnail
            source={baseImageUrl}
            alt={name}
            size="large"
          />
        );

        return (
          <ResourceItem
            id={id}
            media={media}
            accessibilityLabel={`View details for ${name}`}
            shortcutActions={[
              {
                content: "Edit layout",
                onAction: () => handleEdit(layout),
              },
              {
                content: "Create template",
                url: `/app/designer?layoutId=${id}`,
              },
              {
                content: "Delete",
                destructive: true,
                onAction: () => handleDelete(layout),
                disabled: _count.templates > 0,
              },
            ]}
          >
            <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between" }}>
              <div>
                <Text variant="bodyMd" fontWeight="bold" as="h3">
                  {name}
                </Text>
                <div style={{ marginTop: "4px" }}>
                  <Text variant="bodySm" tone="subdued" as="p">
                    {width} × {height}px • {_count.templates} template{_count.templates !== 1 ? 's' : ''}
                  </Text>
                  {attributes?.colors && Array.isArray(attributes.colors) && (
                    <Text variant="bodySm" tone="subdued" as="p">
                      Colors: {attributes.colors.join(", ")}
                    </Text>
                  )}
                  {attributes?.edgePatterns && Array.isArray(attributes.edgePatterns) && (
                    <Text variant="bodySm" tone="subdued" as="p">
                      Patterns: {attributes.edgePatterns.join(", ")}
                    </Text>
                  )}
                </div>
              </div>
              <Badge tone="info">Layout</Badge>
            </div>
          </ResourceItem>
        );
      }}
    />
  );

  return (
    <Page fullWidth>
      <TitleBar title="Product Layouts">
        <button variant="primary" onClick={() => setCreateModalOpen(true)}>
          Create layout
        </button>
      </TitleBar>
      
      {actionData && !actionData.success && 'error' in actionData && (
        <Banner tone="critical" onDismiss={() => {}}>
          <p>{actionData.error}</p>
        </Banner>
      )}
      
      <Layout>
        <Layout.Section>
          <Card padding="0">
            {layouts.length === 0 ? emptyStateMarkup : resourceListMarkup}
          </Card>
        </Layout.Section>
      </Layout>
      
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Product Layout"
        primaryAction={{
          content: "Create",
          onAction: handleCreateSubmit,
          disabled: !name || !baseImageFile,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setCreateModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField
              label="Layout Name"
              value={name}
              onChange={(value) => setName(value)}
              placeholder="e.g., Composite Poker Chip"
              autoComplete="off"
            />
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <TextField
                label="Width (px)"
                type="number"
                value={width}
                onChange={(value) => setWidth(value)}
                autoComplete="off"
              />
              <TextField
                label="Height (px)"
                type="number"
                value={height}
                onChange={(value) => setHeight(value)}
                autoComplete="off"
              />
            </div>
            
            <div>
              <label htmlFor="baseImage" style={{ display: "block", marginBottom: "4px" }}>
                Base Image
              </label>
              <input
                id="baseImage"
                type="file"
                accept="image/*"
                onChange={(e) => setBaseImageFile(e.target.files?.[0] || null)}
              />
            </div>
            
            <TextField
              label="Colors (comma-separated)"
              value={colors}
              onChange={(value) => setColors(value)}
              placeholder="red, blue, green"
              helpText="Enter all color variants"
              autoComplete="off"
            />
            
            <TextField
              label="Edge Patterns (comma-separated)"
              value={edgePatterns}
              onChange={(value) => setEdgePatterns(value)}
              placeholder="8-spot, solid, stripe"
              helpText="Enter all pattern variants"
              autoComplete="off"
            />
          </FormLayout>
        </Modal.Section>
      </Modal>
      
      <Modal
        open={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setLayoutToEdit(null);
          setBaseImageFile(null);
        }}
        title="Edit Product Layout"
        primaryAction={{
          content: "Save Changes",
          onAction: handleEditSubmit,
          disabled: !name,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => {
              setEditModalOpen(false);
              setLayoutToEdit(null);
              setBaseImageFile(null);
            },
          },
        ]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField
              label="Layout Name"
              value={name}
              onChange={(value) => setName(value)}
              placeholder="e.g., Composite Poker Chip"
              autoComplete="off"
            />
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <TextField
                label="Width (px)"
                type="number"
                value={width}
                onChange={(value) => setWidth(value)}
                autoComplete="off"
              />
              <TextField
                label="Height (px)"
                type="number"
                value={height}
                onChange={(value) => setHeight(value)}
                autoComplete="off"
              />
            </div>
            
            <div>
              <label htmlFor="editBaseImage" style={{ display: "block", marginBottom: "4px" }}>
                Base Image (leave empty to keep current)
              </label>
              <input
                id="editBaseImage"
                type="file"
                accept="image/*"
                onChange={(e) => setBaseImageFile(e.target.files?.[0] || null)}
              />
              {layoutToEdit?.baseImageUrl && (
                <div style={{ marginTop: "8px" }}>
                  <Text variant="bodySm" tone="subdued">
                    Current image:
                  </Text>
                  <Thumbnail
                    source={layoutToEdit.baseImageUrl}
                    alt="Current base image"
                    size="medium"
                  />
                </div>
              )}
            </div>
            
            <TextField
              label="Colors (comma-separated)"
              value={colors}
              onChange={(value) => setColors(value)}
              placeholder="red, blue, green"
              helpText="Enter all color variants"
              autoComplete="off"
            />
            
            <TextField
              label="Edge Patterns (comma-separated)"
              value={edgePatterns}
              onChange={(value) => setEdgePatterns(value)}
              placeholder="8-spot, solid, stripe"
              helpText="Enter all pattern variants"
              autoComplete="off"
            />
            
            <div style={{ marginTop: "16px" }}>
              <Button 
                onClick={() => setVariantImagesModalOpen(true)}
                fullWidth
                variant="secondary"
              >
                Manage Variant Images ({Object.keys(variantImages).length} configured)
              </Button>
            </div>
          </FormLayout>
        </Modal.Section>
      </Modal>
      
      <Modal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setLayoutToDelete(null);
        }}
        title="Delete layout?"
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
              setLayoutToDelete(null);
            },
          },
        ]}
      >
        <Modal.Section>
          <Text as="p">
            Are you sure you want to delete the layout "{layoutToDelete?.name}"? This action cannot be undone.
          </Text>
        </Modal.Section>
      </Modal>
      
      <Modal
        open={variantImagesModalOpen}
        onClose={() => setVariantImagesModalOpen(false)}
        title="Manage Variant Images"
        primaryAction={{
          content: "Save Changes",
          onAction: async () => {
            // Update the layout with new variant images
            const formData = new FormData();
            formData.append("_action", "updateVariantImages");
            formData.append("layoutId", layoutToEdit?.id || "");
            formData.append("variantImages", JSON.stringify(variantImages));
            submit(formData, { method: "post" });
            setVariantImagesModalOpen(false);
          },
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setVariantImagesModalOpen(false),
          },
        ]}
        fullScreen
      >
        <Modal.Section>
          <Banner tone="info">
            <p>Upload images for each color and edge pattern combination. Each variant needs its own base image.</p>
          </Banner>
          
          <div style={{ marginTop: "20px" }}>
            {layoutToEdit?.attributes?.colors?.map((color: string) => (
              <div key={color} style={{ marginBottom: "24px" }}>
                <Text variant="headingMd" as="h3" fontWeight="semibold">
                  {color.charAt(0).toUpperCase() + color.slice(1)} Variants
                </Text>
                
                <InlineGrid columns={{xs: 1, sm: 2, md: 4, lg: 4}} gap="400" alignItems="start">
                  {layoutToEdit?.attributes?.edgePatterns?.map((pattern: string) => {
                    // Normalize the key: lowercase and replace spaces with hyphens
                    const variantKey = `${color.toLowerCase()}-${pattern.toLowerCase().replace(/\s+/g, '-')}`;
                    const currentImage = variantImages[variantKey];
                    
                    return (
                      <Card key={variantKey}>
                        <Box padding="400">
                          <Text variant="headingSm" as="h4">
                            {pattern}
                          </Text>
                          
                          <div style={{ marginTop: "12px", marginBottom: "12px" }}>
                            {currentImage ? (
                              <Thumbnail
                                source={currentImage}
                                alt={`${color} ${pattern}`}
                                size="large"
                              />
                            ) : (
                              <div style={{
                                width: "100%",
                                height: "120px",
                                border: "2px dashed #ccc",
                                borderRadius: "8px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: "#f9f9f9"
                              }}>
                                <Text variant="bodySm" tone="subdued">No image</Text>
                              </div>
                            )}
                          </div>
                          
                          <input
                            type="file"
                            accept="image/*"
                            id={`file-${variantKey.replace(/[^a-z0-9-]/g, '')}`}
                            style={{ display: 'none' }}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                // Upload to S3
                                const formData = new FormData();
                                formData.append('file', file);
                                
                                try {
                                  const response = await fetch('/api/assets/upload', {
                                    method: 'POST',
                                    body: formData,
                                  });
                                  
                                  const result = await response.json();
                                  if (result.success) {
                                    setVariantImages(prev => ({
                                      ...prev,
                                      [variantKey]: result.asset.url
                                    }));
                                  }
                                } catch (error) {
                                  console.error('Upload failed:', error);
                                }
                              }
                            }}
                          />
                          
                          <Button
                            size="slim"
                            fullWidth
                            onClick={() => document.getElementById(`file-${variantKey.replace(/[^a-z0-9-]/g, '')}`)?.click()}
                          >
                            {currentImage ? 'Change' : 'Upload'} Image
                          </Button>
                          
                          {currentImage && (
                            <div style={{ marginTop: "8px" }}>
                              <Button
                                size="slim"
                                fullWidth
                                variant="plain"
                                destructive
                                onClick={() => {
                                  setVariantImages(prev => {
                                    const updated = { ...prev };
                                    delete updated[variantKey];
                                    return updated;
                                  });
                                }}
                              >
                                Remove
                              </Button>
                            </div>
                          )}
                        </Box>
                      </Card>
                    );
                  })}
                </InlineGrid>
              </div>
            ))}
          </div>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
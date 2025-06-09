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
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { uploadToS3 } from "../services/s3.server";

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
      const baseImageUrl = await uploadToS3(buffer, key, imageFile.type);

      // Create ProductLayout
      const layout = await db.productLayout.create({
        data: {
          name,
          shop: session.shop,
          width,
          height,
          baseImageUrl,
          attributes,
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
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [layoutToDelete, setLayoutToDelete] = useState<any>(null);
  
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
      setDeleteModalOpen(false);
      // Reset form
      setName("");
      setWidth("600");
      setHeight("400");
      setBaseImageFile(null);
      setColors("red,blue,green");
      setEdgePatterns("8-spot,solid,stripe");
    }
  }, [actionData]);

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
        const { id, name, baseImageUrl, width, height, attributes, _count } = layout;
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
                  {attributes.colors && (
                    <Text variant="bodySm" tone="subdued" as="p">
                      Colors: {attributes.colors.join(", ")}
                    </Text>
                  )}
                  {attributes.edgePatterns && (
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
              onChange={setName}
              placeholder="e.g., Composite Poker Chip"
              autoComplete="off"
            />
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <TextField
                label="Width (px)"
                type="number"
                value={width}
                onChange={setWidth}
                autoComplete="off"
              />
              <TextField
                label="Height (px)"
                type="number"
                value={height}
                onChange={setHeight}
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
              onChange={setColors}
              placeholder="red, blue, green"
              helpText="Enter all color variants"
              autoComplete="off"
            />
            
            <TextField
              label="Edge Patterns (comma-separated)"
              value={edgePatterns}
              onChange={setEdgePatterns}
              placeholder="8-spot, solid, stripe"
              helpText="Enter all pattern variants"
              autoComplete="off"
            />
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
    </Page>
  );
}
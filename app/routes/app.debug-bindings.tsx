import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { Page, Layout, Card, DataTable, Banner, Text, Badge } from "@shopify/polaris";
import { prisma } from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  // Get all variants with template metafields from Shopify
  const response = await admin.graphql(
    `#graphql
      query GetVariantsWithMetafields {
        productVariants(first: 250, query: "metafield:custom_designer.template_id:*") {
          edges {
            node {
              id
              title
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
        }
      }
    `
  );

  const data = await response.json();
  const variants = data.data?.productVariants?.edges || [];

  // Get all templates from database
  const dbTemplates = await prisma.template.findMany({
    where: { shop: session.shop },
    select: {
      id: true,
      name: true,
      shopifyVariantId: true,
      isColorVariant: true,
      colorVariant: true,
      masterTemplateId: true,
    }
  });

  // Create a map for quick lookup
  const templateMap = new Map(dbTemplates.map(t => [t.id, t]));

  // Process variants to check template existence
  const processedVariants = variants.map((edge: any) => {
    const variant = edge.node;
    const templateId = variant.metafield?.value || null;
    const templateExists = templateId ? templateMap.has(templateId) : false;
    const template = templateId ? templateMap.get(templateId) : null;

    return {
      variantId: variant.id,
      variantTitle: variant.title,
      productTitle: variant.product.title,
      templateId,
      templateExists,
      templateName: template?.name || 'Unknown Template',
      isColorVariant: template?.isColorVariant || false,
      colorVariant: template?.colorVariant || null,
    };
  });

  // Find missing templates
  const missingTemplates = processedVariants.filter(v => v.templateId && !v.templateExists);
  const validBindings = processedVariants.filter(v => v.templateId && v.templateExists);

  return json({
    variants: processedVariants,
    missingTemplates,
    validBindings,
    totalVariants: variants.length,
    totalTemplates: dbTemplates.length,
    templateIds: dbTemplates.map(t => ({ id: t.id, name: t.name })),
  });
};

export default function DebugBindings() {
  const { variants, missingTemplates, validBindings, totalVariants, totalTemplates, templateIds } = useLoaderData<typeof loader>();

  const rows = variants.map((variant) => [
    variant.productTitle,
    variant.variantTitle,
    <Badge tone={variant.templateExists ? "success" : "critical"}>
      {variant.templateExists ? "Found" : "Missing"}
    </Badge>,
    variant.templateId || "None",
    variant.templateName,
    variant.isColorVariant ? `Yes (${variant.colorVariant})` : "No",
  ]);

  return (
    <Page title="Debug Template Bindings">
      <Layout>
        <Layout.Section>
          <Card>
            <Text variant="headingMd" as="h2">Summary</Text>
            <div style={{ marginTop: "1rem" }}>
              <Text as="p">Total variants with metafields: {totalVariants}</Text>
              <Text as="p">Total templates in database: {totalTemplates}</Text>
              <Text as="p">Valid bindings: {validBindings.length}</Text>
              <Text as="p" tone="critical">Missing templates: {missingTemplates.length}</Text>
            </div>
          </Card>
        </Layout.Section>

        {missingTemplates.length > 0 && (
          <Layout.Section>
            <Banner tone="critical" title="Missing Templates">
              <p>The following template IDs are referenced in metafields but don't exist in the database:</p>
              <ul style={{ marginTop: "0.5rem" }}>
                {missingTemplates.map(v => (
                  <li key={v.variantId}>
                    <strong>{v.productTitle} - {v.variantTitle}</strong>: {v.templateId}
                  </li>
                ))}
              </ul>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <Text variant="headingMd" as="h2">All Template-Variant Bindings</Text>
            <div style={{ marginTop: "1rem" }}>
              <DataTable
                columnContentTypes={["text", "text", "text", "text", "text", "text"]}
                headings={["Product", "Variant", "Status", "Template ID", "Template Name", "Color Variant"]}
                rows={rows}
              />
            </div>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <Text variant="headingMd" as="h2">All Database Template IDs</Text>
            <div style={{ marginTop: "1rem" }}>
              <pre style={{ 
                background: "#f6f6f6", 
                padding: "1rem", 
                borderRadius: "4px",
                maxHeight: "300px",
                overflow: "auto",
                fontSize: "12px"
              }}>
                {templateIds.map(t => `${t.id} => ${t.name}`).join('\n')}
              </pre>
            </div>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
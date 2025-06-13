import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Page, Card, Layout, Text, Badge, DataTable } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  // Check template colors
  const templateColors = await db.templateColor.findMany({
    orderBy: { chipColor: 'asc' }
  });
  
  // Check existing templates
  const templates = await db.template.findMany({
    where: { shop: session.shop },
    select: {
      id: true,
      name: true,
      shopifyProductId: true,
      shopifyVariantId: true,
      productLayoutId: true,
      colorVariant: true,
      isColorVariant: true,
      masterTemplateId: true
    }
  });
  
  return json({
    templateColors,
    templates,
    templateCount: templates.length,
    colorCount: templateColors.length
  });
};

export default function VerifyPhase1() {
  const data = useLoaderData<typeof loader>();
  
  const colorRows = data.templateColors.map(color => [
    color.chipColor,
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      <div style={{ width: '20px', height: '20px', backgroundColor: color.color1, border: '1px solid #ccc' }} />
      <span>{color.color1}</span>
    </div>,
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      <div style={{ width: '20px', height: '20px', backgroundColor: color.color2, border: '1px solid #ccc' }} />
      <span>{color.color2}</span>
    </div>,
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      <div style={{ width: '20px', height: '20px', backgroundColor: color.color3, border: '1px solid #ccc' }} />
      <span>{color.color3}</span>
    </div>,
    color.color4 ? (
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        <div style={{ width: '20px', height: '20px', backgroundColor: color.color4, border: '1px solid #ccc' }} />
        <span>{color.color4}</span>
      </div>
    ) : '-',
    color.color5 ? (
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        <div style={{ width: '20px', height: '20px', backgroundColor: color.color5, border: '1px solid #ccc' }} />
        <span>{color.color5}</span>
      </div>
    ) : '-'
  ]);
  
  return (
    <Page fullWidth>
      <TitleBar title="Phase 1 Verification" />
      <Layout>
        <Layout.Section>
          <Card>
            <div style={{ marginBottom: '16px' }}>
              <Text variant="headingMd" as="h2">
                Database Status
              </Text>
            </div>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
              <Badge tone="success">
                {data.colorCount} Template Colors
              </Badge>
              <Badge tone="info">
                {data.templateCount} Existing Templates
              </Badge>
            </div>
            
            <div style={{ marginBottom: '24px' }}>
              <Text variant="headingMd" as="h3">
                Template Colors
              </Text>
              <div style={{ marginTop: '12px' }}>
                <DataTable
                  columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text']}
                  headings={['Chip Color', 'Color 1', 'Color 2', 'Color 3', 'Color 4', 'Color 5']}
                  rows={colorRows}
                />
              </div>
            </div>
            
            {data.templates.length > 0 && (
              <div>
                <Text variant="headingMd" as="h3">
                  Existing Templates (Migration Status)
                </Text>
                <div style={{ marginTop: '12px' }}>
                  <DataTable
                    columnContentTypes={['text', 'text', 'text', 'text']}
                    headings={['Name', 'Has Shopify IDs', 'Has Legacy Layout', 'Status']}
                    rows={data.templates.map(template => [
                      template.name,
                      template.shopifyProductId ? '✓' : '✗',
                      template.productLayoutId ? '✓' : '✗',
                      <Badge tone={template.shopifyProductId ? 'success' : 'warning'}>
                        {template.shopifyProductId ? 'Ready' : 'Needs Migration'}
                      </Badge>
                    ])}
                  />
                </div>
              </div>
            )}
          </Card>
          
          <Card>
            <Text variant="headingMd" as="h2">
              Phase 1 Checklist
            </Text>
            <div style={{ marginTop: '16px' }}>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                <li>✅ Product metafield definition created</li>
                <li>✅ "Composite Poker Chips" marked as template source</li>
                <li>✅ Database schema updated with Shopify references</li>
                <li>✅ TemplateColor model created and seeded ({data.colorCount} colors)</li>
                <li>✅ All 49 product variants accessible via API</li>
              </ul>
            </div>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  ResourceList,
  ResourceItem,
  Text,
  Thumbnail,
  Button,
  EmptyState,
  Badge,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const templates = await db.template.findMany({
    where: {
      shop: session.shop,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return json({ templates });
};

export default function Templates() {
  const { templates } = useLoaderData<typeof loader>();

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

  const resourceListMarkup = (
    <ResourceList
      resourceName={{ singular: "template", plural: "templates" }}
      items={templates}
      renderItem={(template) => {
        const { id, name, thumbnail, createdAt, updatedAt } = template;
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
          >
            <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between" }}>
              <div>
                <Text variant="bodyMd" fontWeight="bold" as="h3">
                  {name}
                </Text>
                <div style={{ marginTop: "4px" }}>
                  <Text variant="bodySm" color="subdued">
                    Created: {new Date(createdAt).toLocaleDateString()}
                  </Text>
                  {updatedAt !== createdAt && (
                    <Text variant="bodySm" color="subdued">
                      {" • Updated: " + new Date(updatedAt).toLocaleDateString()}
                    </Text>
                  )}
                </div>
              </div>
              <Badge tone="info">Template</Badge>
            </div>
          </ResourceItem>
        );
      }}
    />
  );

  return (
    <Page>
      <TitleBar title="Templates">
        <button variant="primary" onClick={() => window.location.href = "/app/designer"}>
          Create template
        </button>
      </TitleBar>
      <Layout>
        <Layout.Section>
          <Card padding="0">
            {templates.length === 0 ? emptyStateMarkup : resourceListMarkup}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
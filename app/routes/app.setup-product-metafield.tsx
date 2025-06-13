import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData, useSubmit, useNavigation } from "@remix-run/react";
import { Page, Layout, Card, Button, Banner, Text } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

const CREATE_METAFIELD_DEFINITION = `#graphql
  mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $definition) {
      createdDefinition {
        id
        name
        namespace
        key
        description
        type {
          name
        }
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  try {
    const response = await admin.graphql(CREATE_METAFIELD_DEFINITION, {
      variables: {
        definition: {
          name: "Is Template Source",
          namespace: "custom_designer",
          key: "is_template_source",
          description: "Indicates if this product is a template source for the designer app",
          type: "boolean",
          ownerType: "PRODUCT",
          pin: true,
        },
      },
    });

    const result = await response.json();

    if (result.data?.metafieldDefinitionCreate?.userErrors?.length > 0) {
      const errors = result.data.metafieldDefinitionCreate.userErrors;
      return json({
        success: false,
        errors,
      });
    }

    return json({
      success: true,
      definition: result.data?.metafieldDefinitionCreate?.createdDefinition,
    });
  } catch (error) {
    console.error("Error creating metafield definition:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
};

export default function SetupProductMetafield() {
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isLoading = navigation.state === "submitting";

  const handleSubmit = () => {
    submit({}, { method: "post" });
  };

  return (
    <Page fullWidth>
      <TitleBar title="Setup Product Metafield" />
      <Layout>
        <Layout.Section>
          <Card>
            <Text variant="headingMd" as="h2">
              Product Template Source Metafield
            </Text>
            <div style={{ marginTop: "16px", marginBottom: "16px" }}>
              <Text variant="bodyMd" as="p">
                This will create a metafield definition that allows you to mark products as template sources.
              </Text>
              <div style={{ marginTop: "8px" }}>
                <Text variant="bodySm" as="p" tone="subdued">
                  • Namespace: custom_designer
                </Text>
                <Text variant="bodySm" as="p" tone="subdued">
                  • Key: is_template_source
                </Text>
                <Text variant="bodySm" as="p" tone="subdued">
                  • Type: Boolean
                </Text>
              </div>
            </div>
            <Button
              primary
              onClick={handleSubmit}
              loading={isLoading}
              disabled={actionData?.success}
            >
              Create Metafield Definition
            </Button>
          </Card>

          {actionData?.success && (
            <div style={{ marginTop: "16px" }}>
              <Banner tone="success">
                <p>
                  Metafield definition created successfully! You can now mark products as template
                  sources in the Shopify admin.
                </p>
              </Banner>
            </div>
          )}

          {actionData && !actionData.success && "errors" in actionData && (
            <div style={{ marginTop: "16px" }}>
              <Banner tone="critical">
                <p>Failed to create metafield definition:</p>
                <ul>
                  {actionData.errors.map((error: any, index: number) => (
                    <li key={index}>
                      {error.message} {error.code && `(${error.code})`}
                    </li>
                  ))}
                </ul>
              </Banner>
            </div>
          )}

          {actionData && !actionData.success && "error" in actionData && (
            <div style={{ marginTop: "16px" }}>
              <Banner tone="critical">
                <p>Error: {actionData.error}</p>
              </Banner>
            </div>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
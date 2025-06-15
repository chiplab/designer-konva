import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useNavigation, useActionData, useLoaderData, Form } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  BlockStack,
  Banner,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

// GraphQL query to check if metafield definition exists
const CHECK_METAFIELD_DEFINITION = `#graphql
  query CheckMetafieldDefinition($namespace: String!, $key: String!, $ownerType: MetafieldOwnerType!) {
    metafieldDefinitions(namespace: $namespace, key: $key, ownerType: $ownerType, first: 1) {
      edges {
        node {
          id
          name
          namespace
          key
          visibleToStorefrontApi
        }
      }
    }
  }
`;

// GraphQL mutation to create metafield definition
const CREATE_METAFIELD_DEFINITION = `#graphql
  mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $definition) {
      createdDefinition {
        id
        name
        namespace
        key
        type {
          name
        }
        visibleToStorefrontApi
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  
  try {
    const response = await admin.graphql(
      CHECK_METAFIELD_DEFINITION,
      {
        variables: {
          namespace: "custom_designer",
          key: "template_id",
          ownerType: "PRODUCTVARIANT"
        }
      }
    );
    
    const data = await response.json();
    const definition = data.data?.metafieldDefinitions?.edges?.[0]?.node;
    const exists = !!definition;
    const hasStorefrontVisibility = definition?.visibleToStorefrontApi || false;
    
    return json({ exists, hasStorefrontVisibility });
  } catch (error) {
    console.error("Error checking metafield:", error);
    return json({ exists: false, hasStorefrontVisibility: false });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  
  try {
    // First check if the metafield definition already exists
    const checkResponse = await admin.graphql(
      CHECK_METAFIELD_DEFINITION,
      {
        variables: {
          namespace: "custom_designer",
          key: "template_id",
          ownerType: "PRODUCTVARIANT"
        }
      }
    );
    
    const checkData = await checkResponse.json();
    
    if (checkData.data?.metafieldDefinitions?.edges?.length > 0) {
      return json({ 
        success: false, 
        error: "Metafield definition already exists. You can now assign templates to product variants." 
      });
    }
    const response = await admin.graphql(
      CREATE_METAFIELD_DEFINITION,
      {
        variables: {
          definition: {
            name: "Designer Template ID",
            namespace: "custom_designer",
            key: "template_id",
            description: "ID of the designer template associated with this product variant",
            type: "single_line_text_field",
            ownerType: "PRODUCTVARIANT",
            validations: [],
            visibleToStorefrontApi: true
          }
        }
      }
    );
    
    const data = await response.json();
    
    if (data.data?.metafieldDefinitionCreate?.userErrors?.length > 0) {
      return json({ 
        success: false, 
        errors: data.data.metafieldDefinitionCreate.userErrors 
      });
    }
    
    return json({ 
      success: true, 
      definition: data.data?.metafieldDefinitionCreate?.createdDefinition 
    });
  } catch (error) {
    console.error("Error creating metafield definition:", error);
    return json({ 
      success: false, 
      error: "Failed to create metafield definition" 
    }, { status: 500 });
  }
};

export default function MetafieldSetup() {
  const navigation = useNavigation();
  const actionData = useActionData<typeof action>();
  const loaderData = useLoaderData<typeof loader>();
  const isSubmitting = navigation.state === "submitting";
  
  return (
    <Page>
      <TitleBar title="Setup Metafield Definition" />
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                {loaderData?.exists ? "Metafield Definition Status" : "Create Template Metafield Definition"}
              </Text>
              
              <Text as="p">
                This will create a metafield definition that allows you to associate 
                designer templates with product variants. The metafield will:
              </Text>
              
              <BlockStack gap="200">
                <Text as="p">• Namespace: <strong>custom_designer</strong></Text>
                <Text as="p">• Key: <strong>template_id</strong></Text>
                <Text as="p">• Type: <strong>Single line text</strong></Text>
                <Text as="p">• Owner: <strong>Product Variant</strong></Text>
                <Text as="p">• Storefront Access: <strong>Enabled</strong></Text>
              </BlockStack>
              
              <Banner tone="info">
                <p>
                  Once created, you'll be able to see and edit this metafield 
                  directly in the Shopify admin when viewing product variants.
                  It will also be accessible in your theme and storefront.
                </p>
              </Banner>
              
              {actionData?.success && (
                <Banner tone="success">
                  <p>Metafield definition created successfully!</p>
                  <p>You can now assign templates to product variants.</p>
                </Banner>
              )}
              
              {actionData && !actionData.success && 'errors' in actionData && actionData.errors && (
                <Banner tone="critical">
                  <p>Error creating metafield:</p>
                  {actionData.errors.map((err: any, i: number) => (
                    <p key={i}>{err.message}</p>
                  ))}
                </Banner>
              )}
              
              {actionData && !actionData.success && 'error' in actionData && actionData.error && (
                <Banner tone="critical">
                  <p>{actionData.error}</p>
                </Banner>
              )}
              
              {loaderData?.exists ? (
                loaderData.hasStorefrontVisibility ? (
                  <Banner tone="success">
                    <p>Metafield definition already exists with storefront visibility!</p>
                    <p>You can now assign templates to product variants from the Templates page.</p>
                  </Banner>
                ) : (
                  <Banner tone="warning">
                    <p>Metafield definition exists but does not have storefront visibility enabled.</p>
                    <p>The product customizer on your storefront may not work properly.</p>
                    <p>You may need to manually update the metafield definition in your Shopify admin to enable "Storefront access".</p>
                  </Banner>
                )
              ) : (
                <Form method="post">
                  <Button
                    submit
                    variant="primary"
                    loading={isSubmitting}
                  >
                    Create Metafield Definition
                  </Button>
                </Form>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
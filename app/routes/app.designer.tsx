import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Page } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import DesignerCanvas from "../components/DesignerCanvas";
import db from "../db.server";

const GET_PRODUCT_VARIANT = `#graphql
  query GetProductVariant($productId: ID!, $variantId: ID!) {
    product(id: $productId) {
      id
      title
    }
    productVariant(id: $variantId) {
      id
      title
      displayName
      image {
        url
        altText
      }
      selectedOptions {
        name
        value
      }
    }
  }
`;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const templateId = url.searchParams.get("template");
  const productId = url.searchParams.get("productId");
  const variantId = url.searchParams.get("variantId");
  const layoutId = url.searchParams.get("layoutId"); // Legacy support
  
  let template = null;
  let productLayout = null;
  let shopifyProduct = null;
  let shopifyVariant = null;
  
  if (templateId) {
    // Loading existing template
    template = await db.template.findFirst({
      where: {
        id: templateId,
        shop: session.shop,
      },
      include: {
        productLayout: true,
      },
    });
    
    // If template has Shopify references, load them
    if (template?.shopifyProductId && template?.shopifyVariantId) {
      try {
        const response = await admin.graphql(GET_PRODUCT_VARIANT, {
          variables: {
            productId: template.shopifyProductId,
            variantId: template.shopifyVariantId,
          }
        });
        const data = await response.json();
        shopifyProduct = data.data?.product;
        shopifyVariant = data.data?.productVariant;
      } catch (error) {
        console.error("Error loading Shopify data:", error);
      }
    }
    
    productLayout = template?.productLayout;
  } else if (productId && variantId) {
    // Creating new template for specific variant
    try {
      const response = await admin.graphql(GET_PRODUCT_VARIANT, {
        variables: { productId, variantId }
      });
      const data = await response.json();
      shopifyProduct = data.data?.product;
      shopifyVariant = data.data?.productVariant;
    } catch (error) {
      console.error("Error loading Shopify variant:", error);
    }
  } else if (layoutId) {
    // Legacy support for old ProductLayout system
    productLayout = await db.productLayout.findFirst({
      where: {
        id: layoutId,
        shop: session.shop,
      },
    });
  }
  
  return json({
    shop: session.shop,
    template,
    productLayout,
    shopifyProduct,
    shopifyVariant,
  });
};

export default function Designer() {
  const { template, productLayout, shopifyProduct, shopifyVariant } = useLoaderData<typeof loader>();
  
  // Determine the title based on what we're doing
  let title = "Template Designer";
  if (template) {
    title = `Edit: ${template.name}`;
  } else if (shopifyVariant) {
    title = `New Template: ${shopifyVariant.displayName}`;
  } else if (productLayout) {
    title = `New Template for ${productLayout.name}`;
  }
  
  return (
    <Page fullWidth>
      <TitleBar title={title}>
        <button onClick={() => window.location.href = "/app/templates"}>
          View all templates
        </button>
      </TitleBar>
      <div style={{ 
        height: 'calc(100vh - 64px)', // Account for top bar only
        minHeight: '600px',
        position: 'relative',
        backgroundColor: '#ffffff'
      }}>
        <DesignerCanvas 
          initialTemplate={template} 
          productLayout={productLayout}
          shopifyProduct={shopifyProduct}
          shopifyVariant={shopifyVariant}
        />
      </div>
    </Page>
  );
}
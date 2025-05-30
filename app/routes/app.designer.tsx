import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Page } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import DesignerCanvas from "../components/DesignerCanvas";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const templateId = url.searchParams.get("template");
  
  let template = null;
  if (templateId) {
    template = await db.template.findFirst({
      where: {
        id: templateId,
        shop: session.shop,
      },
    });
  }
  
  return json({
    shop: session.shop,
    template,
  });
};

export default function Designer() {
  const { template } = useLoaderData<typeof loader>();
  
  return (
    <Page fullWidth>
      <TitleBar title={template ? `Edit: ${template.name}` : "Template Designer"}>
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
        <DesignerCanvas initialTemplate={template} />
      </div>
    </Page>
  );
}
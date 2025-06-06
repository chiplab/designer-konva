import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import DesignerCanvas from "../components/DesignerCanvas";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);
  
  return json({
    shop: session?.shop || "unknown",
  });
};

export default function ProxyDesigner() {
  const { shop } = useLoaderData<typeof loader>();
  
  return (
    <div style={{ width: '100vw', height: '100vh', backgroundColor: '#ffffff' }}>
      <div style={{ padding: '20px', borderBottom: '1px solid #ddd' }}>
        <h1>Designer for {shop}</h1>
        <p>This is the public-facing designer accessible through the app proxy.</p>
      </div>
      <div style={{ 
        height: 'calc(100vh - 100px)',
        position: 'relative',
        backgroundColor: '#f5f5f5'
      }}>
        <DesignerCanvas />
      </div>
    </div>
  );
}
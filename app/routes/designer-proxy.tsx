import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { AppProxyProvider } from '@shopify/shopify-app-remix/react';
import { authenticate } from '../shopify.server';
import ClientOnly from '../components/ClientOnly';
import DesignerCanvas from '../components/DesignerCanvas';

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.public.appProxy(request);
  
  const appUrl = process.env.SHOPIFY_APP_URL || '';
  const url = new URL(request.url);
  const isProxyAccess = url.hostname.includes('myshopify.com');
  
  return json({ 
    appUrl,
    isProxyAccess
  });
}

// Prevent hydration issues
export function shouldRevalidate() {
  return false;
}

export default function DesignerProxy() {
  const { appUrl } = useLoaderData<typeof loader>();
  
  return (
    <AppProxyProvider appUrl={appUrl}>
      <ClientOnly fallback={
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <h2>Loading Designer...</h2>
          <p>Initializing canvas...</p>
        </div>
      }>
        <DesignerCanvas />
      </ClientOnly>
    </AppProxyProvider>
  );
}
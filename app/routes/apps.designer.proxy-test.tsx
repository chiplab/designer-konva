import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import ClientOnly from '../components/ClientOnly';

export async function loader({ request }: LoaderFunctionArgs) {
  // Simple loader - no authentication for testing
  const url = new URL(request.url);
  return json({ 
    message: "Proxy test successful!",
    requestUrl: request.url,
    host: url.host,
    pathname: url.pathname,
    timestamp: new Date().toISOString()
  });
}

export default function ProxyTest() {
  const data = useLoaderData<typeof loader>();
  
  return (
    <ClientOnly fallback={<div>Loading...</div>}>
      <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
        <h1>Proxy Test Route</h1>
        <p style={{ color: 'green', fontWeight: 'bold' }}>{data.message}</p>
        <h2>Request Details:</h2>
        <pre style={{ background: '#f5f5f5', padding: '10px', borderRadius: '5px' }}>
          {JSON.stringify(data, null, 2)}
        </pre>
        <p>If you can see this data, the proxy is working correctly!</p>
        <button onClick={() => alert('JavaScript is working!')}>
          Test JavaScript
        </button>
      </div>
    </ClientOnly>
  );
}
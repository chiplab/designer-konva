import { json } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import ClientOnly from '../components/ClientOnly';

export async function loader() {
  return json({ 
    message: "Simple proxy test - no auth, minimal deps",
    time: new Date().toISOString()
  });
}

export default function SimpleProxy() {
  const data = useLoaderData<typeof loader>();
  
  return (
    <ClientOnly fallback={<div>Loading simple test...</div>}>
      <div style={{ padding: '20px' }}>
        <h1>Simple Proxy Test</h1>
        <p>{data.message}</p>
        <p>Time: {data.time}</p>
        <button onClick={() => alert('JavaScript works!')}>
          Test Button
        </button>
        <div style={{ marginTop: '20px', padding: '10px', background: '#f0f0f0' }}>
          <p>If you see this and the button works, ClientOnly is working!</p>
        </div>
      </div>
    </ClientOnly>
  );
}
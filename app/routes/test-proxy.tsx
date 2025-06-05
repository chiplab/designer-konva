import { json } from '@remix-run/node';

export async function loader() {
  return json({ 
    message: "Test proxy route - no auth required",
    timestamp: new Date().toISOString()
  });
}

export default function TestProxy() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Test Proxy Route</h1>
      <p>If you can see this, the route is working!</p>
      <p>This route has no authentication requirements.</p>
      <p>Time: {new Date().toLocaleString()}</p>
    </div>
  );
}
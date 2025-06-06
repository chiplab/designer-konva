export default function TestProxy() {
  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>Test Proxy Route again</h1>
      <p>If you can see this, the proxy is working!</p>
      <p>Current URL: {typeof window !== 'undefined' ? window.location.href : 'Server Side'}</p>
      <p>Time: {new Date().toISOString()}</p>
    </div>
  );
}
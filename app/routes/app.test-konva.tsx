import { Page, Card, Button, Banner, Text } from "@shopify/polaris";
import { useState } from "react";
import { TitleBar } from "@shopify/app-bridge-react";

export default function TestKonva() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const runTest = async (endpoint: string) => {
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const response = await fetch(endpoint);
      const data = await response.json();
      
      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || 'Test failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Page fullWidth>
      <TitleBar title="Konva Server Test" />
      
      <Card>
        <Text variant="headingMd" as="h2">Simple Server-Side Konva Test</Text>
        <Text as="p">This tests basic Konva rendering on the server with just text, no images.</Text>
        
        <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
          <Button 
            onClick={() => runTest('/api/test-konva')} 
            loading={loading}
            variant="primary"
          >
            Test Konva
          </Button>
          <Button 
            onClick={() => runTest('/api/test-canvas')} 
            loading={loading}
          >
            Test Canvas (No Konva)
          </Button>
        </div>
        
        {error && (
          <Banner tone="critical" onDismiss={() => setError(null)}>
            <p>Error: {error}</p>
          </Banner>
        )}
        
        {result && result.success && (
          <div style={{ marginTop: '16px' }}>
            <Banner tone="success">
              <p>{result.message}</p>
            </Banner>
            <div style={{ marginTop: '16px' }}>
              <Text variant="headingSm" as="h3">Rendered Image:</Text>
              <img 
                src={result.dataUrl} 
                alt="Server rendered"
                style={{ 
                  border: '1px solid #ccc', 
                  marginTop: '8px',
                  maxWidth: '100%'
                }} 
              />
            </div>
          </div>
        )}
      </Card>
    </Page>
  );
}
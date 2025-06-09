import React from 'react';
import ReactDOM from 'react-dom/client';
import DesignerCanvas from './components/DesignerCanvas';

// Wrapper component for the full designer canvas
function StandaloneCanvas() {
  return (
    <div style={{ padding: 0, margin: 0 }}>
      <h2 style={{ padding: '20px', fontFamily: 'Arial' }}>Standalone Designer Canvas (No Remix Hydration)</h2>
      <DesignerCanvas />
    </div>
  );
}

// Mount the app when DOM is ready
if (typeof window !== 'undefined') {
  const init = () => {
    const root = document.getElementById('canvas-root');
    if (root) {
      ReactDOM.createRoot(root).render(<StandaloneCanvas />);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
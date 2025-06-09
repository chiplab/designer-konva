import React from 'react';
import ReactDOM from 'react-dom/client';
import DesignerCanvas from './components/DesignerCanvas';

// Wrapper component for the full designer canvas
function StandaloneCanvas() {
  // Get template data from window if available
  const initialTemplate = (window as any).__INITIAL_TEMPLATE__ || null;
  
  return (
    <>
      <div className="canvas-header">
        <h2 style={{ margin: 0, fontFamily: 'Arial' }}>
          {initialTemplate ? `Editing: ${initialTemplate.name}` : 'Standalone Designer Canvas (No Remix Hydration)'}
        </h2>
      </div>
      <div className="canvas-container">
        <DesignerCanvas initialTemplate={initialTemplate} />
      </div>
    </>
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
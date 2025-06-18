import React from 'react';
import ReactDOM from 'react-dom/client';
import DesignerCanvas from './components/DesignerCanvas';

// Wrapper component for the full designer canvas
function StandaloneCanvas() {
  // Get template data from window if available
  const initialTemplate = (window as any).__INITIAL_TEMPLATE__ || null;
  const initialDesign = (window as any).__INITIAL_DESIGN__ || null;
  const templateColors = (window as any).__TEMPLATE_COLORS__ || [];
  const initialColorVariant = (window as any).__INITIAL_COLOR_VARIANT__ || null;
  
  // Debug logging
  console.log('[StandaloneCanvas] Template colors loaded:', templateColors);
  console.log('[StandaloneCanvas] Template colors length:', templateColors.length);
  
  // Pass initial state for customer designs
  const initialState = initialDesign ? {
    templateId: initialTemplate?.id,
    variantId: initialDesign.variantId,
    productId: initialDesign.productId,
    textUpdates: initialDesign.textUpdates,
    fromModal: false
  } : null;
  
  return (
    <>
      <div className="canvas-header">
        <h2 style={{ margin: 0, fontFamily: 'Arial' }}>
          {initialTemplate ? `Customizing: ${initialTemplate.name}` : 'Product Designer'}
        </h2>
      </div>
      <div className="canvas-container">
        <DesignerCanvas 
          initialTemplate={initialTemplate} 
          initialState={initialState}
          isAdminView={false}
          templateColors={templateColors}
          initialColorVariant={initialColorVariant}
        />
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
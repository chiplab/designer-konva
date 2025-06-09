import React from 'react';
import ReactDOM from 'react-dom/client';
import { Stage, Layer, Circle, Text } from 'react-konva';

// Simple test component with react-konva
function StandaloneCanvas() {
  const [isDragging, setIsDragging] = React.useState(false);

  return (
    <div style={{ padding: 0, margin: 0 }}>
      <h1>React-Konva Standalone Test</h1>
      <p>Drag the circle below:</p>
      <Stage width={400} height={400}>
        <Layer>
          <Circle
            x={200}
            y={200}
            radius={50}
            fill={isDragging ? "green" : "red"}
            draggable
            onDragStart={() => setIsDragging(true)}
            onDragEnd={() => setIsDragging(false)}
          />
          <Text
            x={150}
            y={300}
            text="Drag me!"
            fontSize={20}
            fontFamily="Arial"
          />
        </Layer>
      </Stage>
    </div>
  );
}

// Mount the app when DOM is ready
if (typeof window !== 'undefined') {
  // Wait for both DOM and Konva to be ready
  const init = () => {
    const root = document.getElementById('canvas-root');
    if (root && window.Konva) {
      ReactDOM.createRoot(root).render(<StandaloneCanvas />);
    } else {
      // Retry if Konva isn't loaded yet
      setTimeout(init, 100);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
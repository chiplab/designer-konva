import React from 'react';
import { Stage, Layer, Circle, Text, TextPath, Transformer, Group } from 'react-konva';

const App = () => {
  const shapeRef = React.useRef(null);
  const [dimensions, setDimensions] = React.useState({ width: 800, height: 600 });
  const [textElements, setTextElements] = React.useState<Array<{id: string, text: string, x: number, y: number}>>([]);
  const [curvedTextElements, setCurvedTextElements] = React.useState<Array<{id: string, text: string, x: number, topY: number, radius: number, flipped: boolean}>>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const transformerRef = React.useRef<any>(null);

  React.useEffect(() => {
    // Set dimensions after component mounts (client-side)
    setDimensions({
      width: window.innerWidth,
      height: window.innerHeight
    });
    
    // it will log `Konva.Circle` instance
    console.log(shapeRef.current);
  }, []);

  React.useEffect(() => {
    if (selectedId && transformerRef.current) {
      const stage = transformerRef.current.getStage();
      const selectedNode = stage.findOne('#' + selectedId);
      if (selectedNode) {
        transformerRef.current.nodes([selectedNode]);
        transformerRef.current.getLayer().batchDraw();
      }
    }
  }, [selectedId]);

  const addText = () => {
    const newText = {
      id: `text-${Date.now()}`,
      text: 'Hello World',
      x: Math.random() * (dimensions.width - 200) + 100, // Random position
      y: Math.random() * (dimensions.height - 100) + 50
    };
    setTextElements(prev => [...prev, newText]);
  };

  const addCurvedText = () => {
    const radius = 100;
    const topY = dimensions.height / 2 - radius;
    const newCurvedText = {
      id: `curved-text-${Date.now()}`,
      text: 'Some Text along a circle radius very big',
      x: dimensions.width / 2,
      topY: topY,
      radius: radius,
      flipped: false
    };
    setCurvedTextElements(prev => [...prev, newCurvedText]);
  };

  const handleStageClick = (e: any) => {
    if (e.target === e.target.getStage()) {
      setSelectedId(null);
      setEditingId(null);
    }
  };

  const handleTextEdit = (id: string, newText: string) => {
    setCurvedTextElements(prev => 
      prev.map(el => el.id === id ? { ...el, text: newText } : el)
    );
    setEditingId(null);
  };

  const handleDiameterChange = (newRadius: number) => {
    if (selectedId) {
      setCurvedTextElements(prev => 
        prev.map(el => 
          el.id === selectedId ? { ...el, radius: newRadius } : el
        )
      );
    }
  };

  const handleFlipText = () => {
    if (selectedId) {
      setCurvedTextElements(prev => 
        prev.map(el => 
          el.id === selectedId ? { ...el, flipped: !el.flipped } : el
        )
      );
      // Force transformer update after flip
      setTimeout(() => {
        if (transformerRef.current) {
          const stage = transformerRef.current.getStage();
          const selectedNode = stage.findOne('#' + selectedId);
          if (selectedNode) {
            transformerRef.current.nodes([selectedNode]);
            transformerRef.current.forceUpdate();
          }
        }
      }, 0);
    }
  };

  return (
    <div>
      <div style={{ padding: '10px' }}>
        <button onClick={addText} style={{ padding: '8px 16px', fontSize: '14px', marginRight: '10px' }}>
          Add Text
        </button>
        <button onClick={addCurvedText} style={{ padding: '8px 16px', fontSize: '14px', marginRight: '10px' }}>
          Add Curved Text
        </button>
        {selectedId && curvedTextElements.find(el => el.id === selectedId) && (
          <div style={{ display: 'inline-block', marginLeft: '20px' }}>
            <label style={{ marginRight: '10px' }}>
              Diameter: 
              <input
                type="range"
                min="50"
                max="300"
                value={curvedTextElements.find(el => el.id === selectedId)?.radius || 100}
                onChange={(e) => handleDiameterChange(parseInt(e.target.value))}
                style={{ marginLeft: '5px', width: '150px' }}
              />
              <span style={{ marginLeft: '5px' }}>
                {(curvedTextElements.find(el => el.id === selectedId)?.radius || 100) * 2}px
              </span>
            </label>
            <button 
              onClick={handleFlipText}
              style={{ 
                padding: '8px 16px', 
                fontSize: '14px', 
                marginLeft: '20px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Flip Text
            </button>
          </div>
        )}
        {selectedId && curvedTextElements.find(el => el.id === selectedId) && (
          <div style={{ 
            background: '#f0f0f0', 
            padding: '10px', 
            margin: '10px 0', 
            border: '1px solid #ccc',
            fontFamily: 'monospace',
            fontSize: '12px'
          }}>
            <strong>Debug Info for Selected Circle:</strong><br/>
            Radius: {curvedTextElements.find(el => el.id === selectedId)?.radius}<br/>
            Top Y (fixed): {curvedTextElements.find(el => el.id === selectedId)?.topY}<br/>
            Center X: {curvedTextElements.find(el => el.id === selectedId)?.x}<br/>
            Center Y (calculated): {(curvedTextElements.find(el => el.id === selectedId)?.topY || 0) + (curvedTextElements.find(el => el.id === selectedId)?.radius || 0)}<br/>
          </div>
        )}
      </div>
      {editingId && (
        <div style={{
          position: 'absolute',
          top: '100px',
          left: '20px',
          background: 'white',
          padding: '10px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          zIndex: 1000
        }}>
          <input
            type="text"
            defaultValue={curvedTextElements.find(el => el.id === editingId)?.text || ''}
            autoFocus
            onBlur={(e) => handleTextEdit(editingId, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleTextEdit(editingId, e.currentTarget.value);
              }
              if (e.key === 'Escape') {
                setEditingId(null);
              }
            }}
            style={{ padding: '5px', fontSize: '16px', width: '300px' }}
          />
          <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
            Press Enter to save, Escape to cancel
          </div>
        </div>
      )}
      <Stage width={dimensions.width} height={dimensions.height} onMouseDown={handleStageClick}>
        <Layer>
          <Circle
            ref={shapeRef}
            x={dimensions.width / 2}
            y={dimensions.height / 2}
            radius={50}
            fill="red"
            draggable
          />
          {textElements.map((textEl) => (
            <Text
              key={textEl.id}
              text={textEl.text}
              x={textEl.x}
              y={textEl.y}
              fontSize={24}
              fontFamily="Arial"
              fill="black"
              draggable
            />
          ))}
          {curvedTextElements.map((curvedEl) => {
            // Calculate center Y based on whether text is flipped
            // For normal text: pin top edge, so center = topY + radius
            // For flipped text: pin bottom edge, so center = topY - radius
            const centerY = curvedEl.flipped 
              ? curvedEl.topY - curvedEl.radius  // Bottom edge stays at topY
              : curvedEl.topY + curvedEl.radius; // Top edge stays at topY
            
            // Create path for text
            const textLength = curvedEl.text.length * 12; // Approximate text length
            const angleSpan = Math.min(textLength / curvedEl.radius, Math.PI * 1.5); // Max 270 degrees
            
            let startAngle, endAngle, sweepFlag;
            if (curvedEl.flipped) {
              // Bottom arc - text reads left to right along bottom
              // Reverse direction for proper text orientation
              startAngle = Math.PI/2 + angleSpan/2; // Start from right side
              endAngle = Math.PI/2 - angleSpan/2;   // End at left side
              sweepFlag = 0; // Counter-clockwise for correct text direction
            } else {
              // Top arc - text reads left to right along top
              startAngle = -Math.PI/2 - angleSpan/2; // Center around top
              endAngle = -Math.PI/2 + angleSpan/2;
              sweepFlag = 1; // Clockwise
            }
            
            const startX = Math.cos(startAngle) * curvedEl.radius;
            const startY = Math.sin(startAngle) * curvedEl.radius;
            const endX = Math.cos(endAngle) * curvedEl.radius;
            const endY = Math.sin(endAngle) * curvedEl.radius;
            
            const largeArcFlag = angleSpan > Math.PI ? 1 : 0;
            const pathData = `M ${startX},${startY} A ${curvedEl.radius},${curvedEl.radius} 0 ${largeArcFlag},${sweepFlag} ${endX},${endY}`;
            
            return (
              <Group
                key={curvedEl.id}
                id={curvedEl.id}
                x={curvedEl.x}
                y={centerY}
                draggable
                onClick={() => setSelectedId(curvedEl.id)}
                onTap={() => setSelectedId(curvedEl.id)}
                onDblClick={() => setEditingId(curvedEl.id)}
                onDblTap={() => setEditingId(curvedEl.id)}
                onDragEnd={(e) => {
                  const newX = e.target.x();
                  const newY = e.target.y();
                  // Calculate topY based on whether text is flipped
                  // For normal text: topY = centerY - radius
                  // For flipped text: topY = centerY + radius (since bottom is pinned)
                  const newTopY = curvedEl.flipped 
                    ? newY + curvedEl.radius 
                    : newY - curvedEl.radius;
                  setCurvedTextElements(prev => 
                    prev.map(el => 
                      el.id === curvedEl.id 
                        ? { ...el, x: newX, topY: newTopY }
                        : el
                    )
                  );
                }}
              >
                <TextPath
                  text={curvedEl.text}
                  data={pathData}
                  fontSize={20}
                  fontFamily="Arial"
                  fill="black"
                  align="center"
                />
              </Group>
            );
          })}
          <Transformer
            ref={transformerRef}
            boundBoxFunc={(oldBox, newBox) => {
              // Limit resize
              if (newBox.width < 5 || newBox.height < 5) {
                return oldBox;
              }
              return newBox;
            }}
          />
        </Layer>
      </Stage>
    </div>
  );
};


export default App;
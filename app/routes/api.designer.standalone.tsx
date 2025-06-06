import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.public.appProxy(request);
  
  // Return a standalone HTML page that loads React and the designer directly
  const html = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Designer - Standalone</title>
    <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="https://unpkg.com/konva@9/konva.min.js"></script>
    <style>
      body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
      #root { width: 100%; height: 100vh; }
      .status { padding: 10px; background: #f0f0f0; margin-bottom: 10px; }
      .controls { padding: 10px; }
      button { padding: 8px 16px; margin-right: 10px; font-size: 14px; cursor: pointer; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script>
      const { useState, useEffect, useRef } = React;
      const { Stage, Layer, Circle, Rect, Text, Transformer } = Konva;
      
      function Designer() {
        const [mounted, setMounted] = useState(false);
        const [selectedId, setSelectedId] = useState(null);
        const [elements, setElements] = useState([]);
        const transformerRef = useRef();
        
        useEffect(() => {
          setMounted(true);
          console.log('Standalone designer mounted!');
        }, []);
        
        const addElement = () => {
          const newElement = {
            id: 'element-' + Date.now(),
            x: Math.random() * 400 + 100,
            y: Math.random() * 400 + 100,
            width: 100,
            height: 100,
            fill: '#' + Math.floor(Math.random()*16777215).toString(16)
          };
          setElements([...elements, newElement]);
        };
        
        useEffect(() => {
          if (selectedId && transformerRef.current) {
            const stage = transformerRef.current.getStage();
            const selectedNode = stage.findOne('#' + selectedId);
            if (selectedNode) {
              transformerRef.current.nodes([selectedNode]);
              transformerRef.current.getLayer().batchDraw();
            }
          }
        }, [selectedId]);
        
        return React.createElement('div', {},
          React.createElement('div', { className: 'status' },
            React.createElement('h2', {}, 'Standalone Designer - Status: ', 
              mounted ? '✅ Fully Loaded!' : '⏳ Loading...'
            )
          ),
          React.createElement('div', { className: 'controls' },
            React.createElement('button', { onClick: addElement }, 'Add Rectangle'),
            React.createElement('button', { onClick: () => setElements([]) }, 'Clear All')
          ),
          React.createElement(Stage, { width: window.innerWidth, height: 600 },
            React.createElement(Layer, {},
              elements.map(el => 
                React.createElement(Rect, {
                  key: el.id,
                  id: el.id,
                  x: el.x,
                  y: el.y,
                  width: el.width,
                  height: el.height,
                  fill: el.fill,
                  draggable: true,
                  onClick: () => setSelectedId(el.id),
                  onDragEnd: (e) => {
                    const id = e.target.id();
                    setElements(elements.map(elem => 
                      elem.id === id 
                        ? { ...elem, x: e.target.x(), y: e.target.y() }
                        : elem
                    ));
                  }
                })
              ),
              React.createElement(Transformer, { ref: transformerRef })
            )
          )
        );
      }
      
      ReactDOM.render(React.createElement(Designer), document.getElementById('root'));
    </script>
  </body>
</html>
  `;
  
  return new Response(html, {
    headers: {
      "Content-Type": "text/html",
      "Cache-Control": "no-cache",
    },
  });
};
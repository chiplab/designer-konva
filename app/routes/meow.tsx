import React from 'react';
import { Stage, Layer, Circle, Text, TextPath, Transformer, Group, Image, Rect } from 'react-konva';
import useImage from 'use-image';
import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { AppProxyProvider } from '@shopify/shopify-app-remix/react';
import { authenticate } from '../shopify.server';

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.public.appProxy(request);
  
  // In production, the app URL should be your actual domain
  const appUrl = process.env.NODE_ENV === 'production' 
    ? process.env.SHOPIFY_APP_URL || ''
    : ''; // Empty in dev to avoid CORS issues
  
  // Check if accessed through proxy
  const url = new URL(request.url);
  const isProxyAccess = url.hostname.includes('myshopify.com');
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  return json({ 
    appUrl,
    showDevNotice: isDevelopment && isProxyAccess
  });
}

const DesignerCanvas = () => {
  // Don't render canvas during SSR
  const [isClient, setIsClient] = React.useState(false);
  
  React.useEffect(() => {
    setIsClient(true);
  }, []);
  const shapeRef = React.useRef(null);
  const stageRef = React.useRef<any>(null);
  const [dimensions, setDimensions] = React.useState({ width: 1000, height: 1000 });
  // Default to local assets, but can be overridden with S3 URLs
  const [baseImageUrl, setBaseImageUrl] = React.useState('/media/images/8-spot-red-base-image.png');
  const [svgImageUrl, setSvgImageUrl] = React.useState('/media/images/borders_v7-11.svg');
  const [baseImage] = useImage(baseImageUrl);
  const [svgImage] = useImage(svgImageUrl);
  const [textElements, setTextElements] = React.useState<Array<{id: string, text: string, x: number, y: number, fontFamily: string}>>([]);
  const [gradientTextElements, setGradientTextElements] = React.useState<Array<{id: string, text: string, x: number, y: number, fontFamily: string}>>([]);
  const [svgElements, setSvgElements] = React.useState<Array<{id: string, x: number, y: number, width: number, height: number}>>([]);
  const [curvedTextElements, setCurvedTextElements] = React.useState<Array<{id: string, text: string, x: number, topY: number, radius: number, flipped: boolean, fontFamily: string}>>([]);
  const [designableArea, setDesignableArea] = React.useState({
    width: 744,
    height: 744,
    cornerRadius: 372, // Max corner radius for circle
    x: 1000 / 2 - 372, // Center in 1000px canvas
    y: 1000 / 2 - 372, // Center in 1000px canvas
    visible: true
  });
  const [backgroundColor, setBackgroundColor] = React.useState('transparent');
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [templates, setTemplates] = React.useState<Array<{id: string, name: string}>>([]);
  const transformerRef = React.useRef<any>(null);

  // Font Management - POC with priority fonts from VISION.md
  const priorityFonts = ['Arial', 'Impact', 'Roboto', 'Oswald', 'Bebas Neue'];
  const [loadedFonts, setLoadedFonts] = React.useState(new Set(['Arial'])); // Arial is always available

  const loadFont = async (fontFamily: string) => {
    if (loadedFonts.has(fontFamily) || fontFamily === 'Arial') return;
    
    // Only run in browser
    if (typeof document === 'undefined') return;
    
    try {
      // Google Fonts API integration
      const link = document.createElement('link');
      link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(' ', '+')}:wght@400;700&display=swap`;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
      
      // Wait for font to actually load
      await document.fonts.load(`16px "${fontFamily}"`);
      setLoadedFonts(prev => new Set([...prev, fontFamily]));
    } catch (error) {
      console.warn(`Failed to load font: ${fontFamily}`, error);
    }
  };

  React.useEffect(() => {
    // Fixed canvas size - 1000x1000 square
    const newDimensions = {
      width: 1000,
      height: 1000
    };
    setDimensions(newDimensions);
    
    // Update designable area position to center
    setDesignableArea(prev => ({
      ...prev,
      x: newDimensions.width / 2 - prev.width / 2,
      y: newDimensions.height / 2 - prev.height / 2
    }));
    
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
      x: designableArea.x + designableArea.width / 2 - 50, // Center of designable area
      y: designableArea.y + designableArea.height / 2 - 12, // Center vertically (minus half font size)
      fontFamily: 'Arial'
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
      flipped: false,
      fontFamily: 'Arial'
    };
    setCurvedTextElements(prev => [...prev, newCurvedText]);
  };

  const addGradientText = () => {
    const newGradientText = {
      id: `gradient-text-${Date.now()}`,
      text: 'Gold Gradient Text',
      x: designableArea.x + designableArea.width / 2 - 80, // Center of designable area
      y: designableArea.y + designableArea.height / 2 - 12, // Center vertically (minus half font size)
      fontFamily: 'Arial'
    };
    setGradientTextElements(prev => [...prev, newGradientText]);
  };

  const addSvg = () => {
    const svgSize = 60; // Size for the SVG element
    const newSvg = {
      id: `svg-${Date.now()}`,
      x: designableArea.x + designableArea.width / 2 - svgSize / 2, // Center of designable area
      y: designableArea.y + designableArea.height / 2 - svgSize / 2, // Center vertically
      width: svgSize,
      height: svgSize
    };
    setSvgElements(prev => [...prev, newSvg]);
  };

  const handleStageClick = (e: any) => {
    if (e.target === e.target.getStage()) {
      setSelectedId(null);
      setEditingId(null);
    }
  };

  const handleTextEdit = (id: string, newText: string) => {
    // Check if it's a curved text element
    const curvedElement = curvedTextElements.find(el => el.id === id);
    if (curvedElement) {
      setCurvedTextElements(prev => 
        prev.map(el => el.id === id ? { ...el, text: newText } : el)
      );
    }
    
    // Check if it's a regular text element
    const textElement = textElements.find(el => el.id === id);
    if (textElement) {
      setTextElements(prev => 
        prev.map(el => el.id === id ? { ...el, text: newText } : el)
      );
    }
    
    // Check if it's a gradient text element
    const gradientElement = gradientTextElements.find(el => el.id === id);
    if (gradientElement) {
      setGradientTextElements(prev => 
        prev.map(el => el.id === id ? { ...el, text: newText } : el)
      );
    }
    
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

  const handleFontChange = async (fontFamily: string) => {
    if (!selectedId) return;
    
    // Load the font first
    await loadFont(fontFamily);
    
    // Update the appropriate element state
    // Check if it's a curved text element
    const curvedElement = curvedTextElements.find(el => el.id === selectedId);
    if (curvedElement) {
      setCurvedTextElements(prev => 
        prev.map(el => el.id === selectedId ? { ...el, fontFamily } : el)
      );
    }
    
    // Check if it's a regular text element
    const textElement = textElements.find(el => el.id === selectedId);
    if (textElement) {
      setTextElements(prev => 
        prev.map(el => el.id === selectedId ? { ...el, fontFamily } : el)
      );
    }
    
    // Check if it's a gradient text element
    const gradientElement = gradientTextElements.find(el => el.id === selectedId);
    if (gradientElement) {
      setGradientTextElements(prev => 
        prev.map(el => el.id === selectedId ? { ...el, fontFamily } : el)
      );
    }
    
    // Force re-render and update transformer bounds after font loads
    setTimeout(() => {
      if (transformerRef.current) {
        const stage = transformerRef.current.getStage();
        const selectedNode = stage?.findOne('#' + selectedId);
        if (selectedNode) {
          // Re-render the layer first
          selectedNode.getLayer()?.batchDraw();
          
          // Force transformer to recalculate bounds for new font metrics
          transformerRef.current.nodes([selectedNode]);
          transformerRef.current.forceUpdate();
          transformerRef.current.getLayer()?.batchDraw();
        }
      }
    }, 100); // Small delay to ensure font is applied
  };

  // Canvas state serialization functions
  const getCanvasState = () => {
    return {
      dimensions,
      backgroundColor,
      designableArea,
      elements: {
        textElements,
        curvedTextElements,
        gradientTextElements,
        svgElements
      },
      assets: {
        baseImage: baseImageUrl,
        svgAssets: [svgImageUrl]
      }
    };
  };

  const loadCanvasState = (state: any) => {
    if (!state) return;
    
    // Load dimensions and background
    if (state.dimensions) setDimensions(state.dimensions);
    if (state.backgroundColor) setBackgroundColor(state.backgroundColor);
    if (state.designableArea) setDesignableArea(state.designableArea);
    
    // Load elements
    if (state.elements) {
      if (state.elements.textElements) setTextElements(state.elements.textElements);
      if (state.elements.curvedTextElements) setCurvedTextElements(state.elements.curvedTextElements);
      if (state.elements.gradientTextElements) setGradientTextElements(state.elements.gradientTextElements);
      if (state.elements.svgElements) setSvgElements(state.elements.svgElements);
    }
    
    // Load assets (with fallback to local defaults)
    if (state.assets) {
      if (state.assets.baseImage) {
        setBaseImageUrl(state.assets.baseImage);
      }
      if (state.assets.svgAssets && state.assets.svgAssets.length > 0) {
        setSvgImageUrl(state.assets.svgAssets[0]);
      }
    }
  };

  // Save template function
  const saveTemplate = async () => {
    const templateName = prompt('Enter template name:');
    if (!templateName) return;

    setIsSaving(true);
    try {
      // Get canvas state
      const canvasState = getCanvasState();
      
      // Generate thumbnail
      const thumbnail = stageRef.current?.toDataURL({ pixelRatio: 0.3 });

      const formData = new FormData();
      formData.append('name', templateName);
      formData.append('canvasData', JSON.stringify(canvasState));
      if (thumbnail) {
        formData.append('thumbnail', thumbnail);
      }

      const response = await fetch('/api/templates/save', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      
      if (result.success) {
        // Show a more informative message with sync status
        const message = result.warning 
          ? `Template saved but with warning: ${result.warning}`
          : 'Template saved and synced successfully to your Shopify store!';
        alert(message);
        loadTemplatesList(); // Refresh templates list
      } else {
        throw new Error(result.error || 'Failed to save template');
      }
    } catch (error) {
      console.error('Error saving template:', error);
      const errorMessage = error instanceof Error 
        ? `Failed to save template: ${error.message}. Please check your connection and try again.`
        : 'Failed to save template. Please check your connection and try again.';
      alert(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  // Load template function
  const loadTemplate = async (templateId: string) => {
    if (!templateId) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/templates/${templateId}`);
      const result = await response.json();
      
      if (result.template) {
        const canvasData = JSON.parse(result.template.canvasData);
        loadCanvasState(canvasData);
        alert('Template loaded successfully!');
      } else {
        throw new Error(result.error || 'Failed to load template');
      }
    } catch (error) {
      console.error('Error loading template:', error);
      alert('Failed to load template: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Load templates list
  const loadTemplatesList = async () => {
    try {
      const response = await fetch('/api/templates');
      const result = await response.json();
      
      if (result.templates) {
        setTemplates(result.templates);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  // Load templates list on mount
  React.useEffect(() => {
    loadTemplatesList();
  }, []);

  // Don't render during SSR to avoid hydration mismatch
  if (!isClient) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading designer...</div>;
  }

  return (
    <div>
      <div style={{ padding: '10px' }}>
        <button onClick={addText} style={{ padding: '8px 16px', fontSize: '14px', marginRight: '10px' }}>
          Add Text
        </button>
        <button onClick={addCurvedText} style={{ padding: '8px 16px', fontSize: '14px', marginRight: '10px' }}>
          Add Curved Text
        </button>
        <button onClick={addGradientText} style={{ padding: '8px 16px', fontSize: '14px', marginRight: '10px' }}>
          Add Gradient Text
        </button>
        <button onClick={addSvg} style={{ padding: '8px 16px', fontSize: '14px', marginRight: '10px' }}>
          Add SVG
        </button>
        <button 
          onClick={() => setDesignableArea(prev => ({ ...prev, visible: !prev.visible }))}
          style={{ 
            padding: '8px 16px', 
            fontSize: '14px', 
            marginRight: '10px',
            backgroundColor: designableArea.visible ? '#28a745' : '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px'
          }}
        >
          {designableArea.visible ? 'Hide' : 'Show'} Design Area
        </button>
        
        {/* Save/Load Controls */}
        <div style={{ display: 'inline-block', marginLeft: '20px', borderLeft: '2px solid #ddd', paddingLeft: '20px' }}>
          <button 
            onClick={saveTemplate} 
            disabled={isSaving}
            style={{ 
              padding: '8px 16px', 
              fontSize: '14px', 
              marginRight: '10px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              opacity: isSaving ? 0.6 : 1,
              cursor: isSaving ? 'not-allowed' : 'pointer'
            }}
          >
            {isSaving ? 'Saving...' : 'Save Template'}
          </button>
          
          <select 
            onChange={(e) => loadTemplate(e.target.value)}
            disabled={isLoading}
            style={{ 
              padding: '8px 16px', 
              fontSize: '14px',
              marginRight: '10px',
              borderRadius: '4px',
              border: '1px solid #ddd',
              cursor: isLoading ? 'not-allowed' : 'pointer'
            }}
          >
            <option value="">Load Template...</option>
            {templates.map(template => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
          
          {isLoading && <span style={{ fontSize: '14px', color: '#666' }}>Loading...</span>}
        </div>
        
        {/* Asset Management Controls */}
        <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f0f4f8', border: '1px solid #dae1e7', borderRadius: '4px' }}>
          <strong>Asset Management (S3):</strong>
          <div style={{ display: 'flex', gap: '15px', marginTop: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
            <label>
              Base Image: 
              <select
                value={baseImageUrl}
                onChange={(e) => setBaseImageUrl(e.target.value)}
                style={{ marginLeft: '5px', padding: '4px 8px', fontSize: '14px' }}
              >
                <option value="/media/images/8-spot-red-base-image.png">Local: Red Base</option>
                <option value="/media/images/8-spot-black-base.png">Local: Black Base</option>
                <option value="/media/images/8-spot-blue-base.png">Local: Blue Base</option>
                <option value="https://shopify-designs.s3.us-west-1.amazonaws.com/assets/default/images/8-spot-red-base-image.png">S3: Red Base</option>
                <option value="https://shopify-designs.s3.us-west-1.amazonaws.com/assets/default/images/8-spot-black-base.png">S3: Black Base</option>
                <option value="https://shopify-designs.s3.us-west-1.amazonaws.com/assets/default/images/8-spot-blue-base.png">S3: Blue Base</option>
              </select>
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const formData = new FormData();
                  formData.append('file', file);
                  formData.append('assetType', 'image');
                  
                  try {
                    const response = await fetch('/api/assets/upload', {
                      method: 'POST',
                      body: formData,
                    });
                    const result = await response.json();
                    if (result.success) {
                      setBaseImageUrl(result.asset.url);
                      alert('Image uploaded to S3 successfully!');
                    }
                  } catch (error) {
                    console.error('Upload error:', error);
                    alert('Failed to upload image');
                  }
                }
              }}
              style={{ fontSize: '14px' }}
            />
            <span style={{ fontSize: '12px', color: '#6c757d' }}>
              {baseImageUrl.startsWith('http') ? '☁️ S3' : '💾 Local'}
            </span>
          </div>
        </div>
        
        {/* Designable Area Controls */}
        <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '4px' }}>
          <strong>Design Area Controls:</strong>
          <div style={{ display: 'flex', gap: '15px', marginTop: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
            <label>
              Center X: 
              <input
                type="range"
                min="200"
                max={dimensions.width - 200}
                value={designableArea.x + designableArea.width / 2}
                onChange={(e) => {
                  const newCenterX = parseInt(e.target.value);
                  setDesignableArea(prev => ({ 
                    ...prev, 
                    x: newCenterX - prev.width / 2
                  }));
                }}
                style={{ marginLeft: '5px', width: '100px' }}
              />
              <span style={{ marginLeft: '5px', minWidth: '40px', display: 'inline-block' }}>{Math.round(designableArea.x + designableArea.width / 2)}px</span>
            </label>
            <label>
              Center Y: 
              <input
                type="range"
                min="200"
                max={dimensions.height - 200}
                value={designableArea.y + designableArea.height / 2}
                onChange={(e) => {
                  const newCenterY = parseInt(e.target.value);
                  setDesignableArea(prev => ({ 
                    ...prev, 
                    y: newCenterY - prev.height / 2
                  }));
                }}
                style={{ marginLeft: '5px', width: '100px' }}
              />
              <span style={{ marginLeft: '5px', minWidth: '40px', display: 'inline-block' }}>{Math.round(designableArea.y + designableArea.height / 2)}px</span>
            </label>
            <label>
              Width: 
              <input
                type="range"
                min="100"
                max="1000"
                value={designableArea.width}
                onChange={(e) => {
                  const newWidth = parseInt(e.target.value);
                  const centerX = designableArea.x + designableArea.width / 2;
                  setDesignableArea(prev => ({ 
                    ...prev, 
                    width: newWidth,
                    x: centerX - newWidth / 2, // Keep center fixed
                    cornerRadius: Math.min(prev.cornerRadius, newWidth / 2)
                  }));
                }}
                style={{ marginLeft: '5px', width: '100px' }}
              />
              <button
                onClick={() => {
                  const newWidth = Math.max(100, designableArea.width - 1);
                  const centerX = designableArea.x + designableArea.width / 2;
                  setDesignableArea(prev => ({ 
                    ...prev, 
                    width: newWidth,
                    x: centerX - newWidth / 2,
                    cornerRadius: Math.min(prev.cornerRadius, newWidth / 2)
                  }));
                }}
                style={{ marginLeft: '3px', padding: '2px 6px', fontSize: '12px', cursor: 'pointer' }}
              >
                -
              </button>
              <button
                onClick={() => {
                  const newWidth = Math.min(1000, designableArea.width + 1);
                  const centerX = designableArea.x + designableArea.width / 2;
                  setDesignableArea(prev => ({ 
                    ...prev, 
                    width: newWidth,
                    x: centerX - newWidth / 2,
                    cornerRadius: Math.min(prev.cornerRadius, newWidth / 2)
                  }));
                }}
                style={{ marginLeft: '2px', padding: '2px 6px', fontSize: '12px', cursor: 'pointer' }}
              >
                +
              </button>
              <span style={{ marginLeft: '5px', minWidth: '40px', display: 'inline-block' }}>{designableArea.width}px</span>
            </label>
            <label>
              Height: 
              <input
                type="range"
                min="100"
                max="1000"
                value={designableArea.height}
                onChange={(e) => {
                  const newHeight = parseInt(e.target.value);
                  const centerY = designableArea.y + designableArea.height / 2;
                  setDesignableArea(prev => ({ 
                    ...prev, 
                    height: newHeight,
                    y: centerY - newHeight / 2, // Keep center fixed
                    cornerRadius: Math.min(prev.cornerRadius, newHeight / 2)
                  }));
                }}
                style={{ marginLeft: '5px', width: '100px' }}
              />
              <button
                onClick={() => {
                  const newHeight = Math.max(100, designableArea.height - 1);
                  const centerY = designableArea.y + designableArea.height / 2;
                  setDesignableArea(prev => ({ 
                    ...prev, 
                    height: newHeight,
                    y: centerY - newHeight / 2,
                    cornerRadius: Math.min(prev.cornerRadius, newHeight / 2)
                  }));
                }}
                style={{ marginLeft: '3px', padding: '2px 6px', fontSize: '12px', cursor: 'pointer' }}
              >
                -
              </button>
              <button
                onClick={() => {
                  const newHeight = Math.min(1000, designableArea.height + 1);
                  const centerY = designableArea.y + designableArea.height / 2;
                  setDesignableArea(prev => ({ 
                    ...prev, 
                    height: newHeight,
                    y: centerY - newHeight / 2,
                    cornerRadius: Math.min(prev.cornerRadius, newHeight / 2)
                  }));
                }}
                style={{ marginLeft: '2px', padding: '2px 6px', fontSize: '12px', cursor: 'pointer' }}
              >
                +
              </button>
              <span style={{ marginLeft: '5px', minWidth: '40px', display: 'inline-block' }}>{designableArea.height}px</span>
            </label>
            <label>
              Corner Radius: 
              <input
                type="range"
                min="0"
                max={Math.min(designableArea.width, designableArea.height) / 2}
                value={designableArea.cornerRadius}
                onChange={(e) => setDesignableArea(prev => ({ ...prev, cornerRadius: parseInt(e.target.value) }))}
                style={{ marginLeft: '5px', width: '100px' }}
              />
              <span style={{ marginLeft: '5px', minWidth: '40px', display: 'inline-block' }}>{designableArea.cornerRadius}px</span>
            </label>
            <span style={{ fontSize: '12px', color: '#6c757d' }}>
              {designableArea.cornerRadius === Math.min(designableArea.width, designableArea.height) / 2 ? '(Circle)' : '(Rectangle)'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '15px', marginTop: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <label>
              Background Color: 
              <select
                value={backgroundColor}
                onChange={(e) => setBackgroundColor(e.target.value)}
                style={{ marginLeft: '5px', padding: '2px 5px', fontSize: '14px' }}
              >
                <option value="transparent">Transparent</option>
                <option value="red">Red</option>
                <option value="white">White</option>
                <option value="blue">Blue</option>
                <option value="green">Green</option>
                <option value="purple">Purple</option>
                <option value="linear-gradient">Linear Gradient</option>
                <option value="radial-gradient">Radial Gradient</option>
              </select>
            </label>
          </div>
        </div>
        
        {/* Canvas Size Debug Info */}
        <div style={{ marginTop: '10px', padding: '5px', fontSize: '12px', color: '#6c757d', fontFamily: 'monospace' }}>
          Canvas Size: {dimensions.width} px width × {dimensions.height} px height
        </div>
        
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
        
        {/* Font Controls - POC */}
        {selectedId && (textElements.find(el => el.id === selectedId) || gradientTextElements.find(el => el.id === selectedId) || curvedTextElements.find(el => el.id === selectedId)) && (
          <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '4px' }}>
            <strong>Font Controls (POC):</strong>
            <div style={{ display: 'flex', gap: '10px', marginTop: '5px', alignItems: 'center' }}>
              <label>
                Font Family: 
                <select
                  value={
                    textElements.find(el => el.id === selectedId)?.fontFamily ||
                    gradientTextElements.find(el => el.id === selectedId)?.fontFamily ||
                    curvedTextElements.find(el => el.id === selectedId)?.fontFamily ||
                    'Arial'
                  }
                  onChange={(e) => handleFontChange(e.target.value)}
                  style={{ marginLeft: '5px', padding: '4px 8px', fontSize: '14px' }}
                >
                  {priorityFonts.map(font => (
                    <option key={font} value={font}>
                      {font} {loadedFonts.has(font) ? '✓' : '⏳'}
                    </option>
                  ))}
                </select>
              </label>
              <span style={{ fontSize: '12px', color: '#6c757d' }}>
                {loadedFonts.size} of {priorityFonts.length} fonts loaded
              </span>
            </div>
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
            defaultValue={
              curvedTextElements.find(el => el.id === editingId)?.text ||
              textElements.find(el => el.id === editingId)?.text ||
              gradientTextElements.find(el => el.id === editingId)?.text ||
              ''
            }
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
      <Stage ref={stageRef} width={dimensions.width} height={dimensions.height} onMouseDown={handleStageClick}>
        <Layer>
          {/* Base product template - bottom layer */}
          {baseImage && (
            <Image
              image={baseImage}
              x={0} // Fill entire canvas
              y={0}
              width={1000}
              height={1000}
            />
          )}
          
          {/* Clipped Design Content Group */}
          <Group
            clipFunc={(ctx) => {
              // Create clipping path that exactly matches the dotted line overlay
              const x = designableArea.x;
              const y = designableArea.y;
              const width = designableArea.width;
              const height = designableArea.height;
              const radius = designableArea.cornerRadius;
              
              // Use same logic as Konva Rect with cornerRadius
              ctx.beginPath();
              if (radius > 0) {
                ctx.moveTo(x + radius, y);
                ctx.arcTo(x + width, y, x + width, y + height, radius);
                ctx.arcTo(x + width, y + height, x, y + height, radius);
                ctx.arcTo(x, y + height, x, y, radius);
                ctx.arcTo(x, y, x + width, y, radius);
              } else {
                ctx.rect(x, y, width, height);
              }
              ctx.closePath();
            }}
          >
            {/* Background Color Layer */}
            {backgroundColor !== 'transparent' && (
              <Rect
                x={designableArea.x}
                y={designableArea.y}
                width={designableArea.width}
                height={designableArea.height}
                cornerRadius={designableArea.cornerRadius}
                fill={backgroundColor === 'linear-gradient' || backgroundColor === 'radial-gradient' ? undefined : backgroundColor}
                fillLinearGradientStartPoint={backgroundColor === 'linear-gradient' ? { x: 0, y: 0 } : undefined}
                fillLinearGradientEndPoint={backgroundColor === 'linear-gradient' ? { x: designableArea.width, y: 0 } : undefined}
                fillLinearGradientColorStops={backgroundColor === 'linear-gradient' ? [0, '#c8102e', 1, '#ffaaaa'] : undefined}
                fillRadialGradientStartPoint={backgroundColor === 'radial-gradient' ? { x: designableArea.width / 2, y: designableArea.height / 2 } : undefined}
                fillRadialGradientEndPoint={backgroundColor === 'radial-gradient' ? { x: designableArea.width / 2, y: designableArea.height / 2 } : undefined}
                fillRadialGradientStartRadius={backgroundColor === 'radial-gradient' ? 0 : undefined}
                fillRadialGradientEndRadius={backgroundColor === 'radial-gradient' ? Math.min(designableArea.width, designableArea.height) / 2 : undefined}
                fillRadialGradientColorStops={backgroundColor === 'radial-gradient' ? [0, '#c8102e', 1, '#ffaaaa'] : undefined}
                listening={false}
              />
            )}
            
            {/* Demo circle - can be removed later */}
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
                id={textEl.id}
                text={textEl.text}
                x={textEl.x}
                y={textEl.y}
                fontSize={24}
                fontFamily={textEl.fontFamily}
                fill="black"
                draggable
                onClick={() => setSelectedId(textEl.id)}
                onTap={() => setSelectedId(textEl.id)}
                onDblClick={() => setEditingId(textEl.id)}
                onDblTap={() => setEditingId(textEl.id)}
                onDragEnd={(e) => {
                  const newX = e.target.x();
                  const newY = e.target.y();
                  setTextElements(prev => 
                    prev.map(el => 
                      el.id === textEl.id 
                        ? { ...el, x: newX, y: newY }
                        : el
                    )
                  );
                }}
              />
            ))}
            {gradientTextElements.map((gradientEl) => (
              <Text
                key={gradientEl.id}
                id={gradientEl.id}
                text={gradientEl.text}
                x={gradientEl.x}
                y={gradientEl.y}
                fontSize={24}
                fontFamily={gradientEl.fontFamily}
                fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                fillLinearGradientEndPoint={{ x: 0, y: 24 }}
                fillLinearGradientColorStops={[0, '#FFD700', 0.5, '#FFA500', 1, '#B8860B']}
                draggable
                onClick={() => setSelectedId(gradientEl.id)}
                onTap={() => setSelectedId(gradientEl.id)}
                onDblClick={() => setEditingId(gradientEl.id)}
                onDblTap={() => setEditingId(gradientEl.id)}
                onDragEnd={(e) => {
                  const newX = e.target.x();
                  const newY = e.target.y();
                  setGradientTextElements(prev => 
                    prev.map(el => 
                      el.id === gradientEl.id 
                        ? { ...el, x: newX, y: newY }
                        : el
                    )
                  );
                }}
              />
            ))}
            {svgElements.map((svgEl) => (
              <Image
                key={svgEl.id}
                id={svgEl.id}
                image={svgImage}
                x={svgEl.x}
                y={svgEl.y}
                width={svgEl.width}
                height={svgEl.height}
                draggable
                onClick={() => setSelectedId(svgEl.id)}
                onTap={() => setSelectedId(svgEl.id)}
                onDragEnd={(e) => {
                  const newX = e.target.x();
                  const newY = e.target.y();
                  setSvgElements(prev => 
                    prev.map(el => 
                      el.id === svgEl.id 
                        ? { ...el, x: newX, y: newY }
                        : el
                    )
                  );
                }}
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
                  fontFamily={curvedEl.fontFamily}
                  fill="black"
                  align="center"
                />
              </Group>
            );
          })}
          </Group>
          
          {/* Designable Area Overlay */}
          {designableArea.visible && (
            <Rect
              x={designableArea.x}
              y={designableArea.y}
              width={designableArea.width}
              height={designableArea.height}
              cornerRadius={designableArea.cornerRadius}
              stroke="#007bff"
              strokeWidth={2}
              dash={[5, 5]}
              fill="rgba(0, 123, 255, 0.1)"
              listening={false} // Don't interfere with other interactions
            />
          )}
          
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


// Custom document to handle script loading in app proxy context
export function links() {
  // Return empty array to prevent default stylesheet loading in proxy context
  return [];
}

export function meta() {
  return [
    { title: "Product Designer" },
    { name: "viewport", content: "width=device-width,initial-scale=1" }
  ];
}

export default function App() {
  const data = useLoaderData<typeof loader>();
  
  // Handle case where loader data might not be available during SSR
  const appUrl = data?.appUrl || '';
  const showDevNotice = data?.showDevNotice || false;
  
  return (
    <AppProxyProvider appUrl={appUrl}>
      <div style={{ padding: 0, margin: 0 }}>
        {showDevNotice && (
          <div style={{
            background: '#fffbdd',
            border: '1px solid #f0c36d',
            padding: '10px',
            fontSize: '14px',
            color: '#333'
          }}>
            ⚠️ Development Mode: Hot reload is disabled when accessing through Shopify proxy. 
            Manual refresh required for changes.
          </div>
        )}
        <DesignerCanvas />
      </div>
    </AppProxyProvider>
  );
}
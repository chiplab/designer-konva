import React from 'react';
import { Stage, Layer, Circle, Text, TextPath, Transformer, Group, Image, Rect } from 'react-konva';
import useImage from 'use-image';

// Image element component
const ImageElement: React.FC<{
  imageElement: {
    id: string;
    url: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
  };
  isSelected: boolean;
  onSelect: () => void;
  onChange: (attrs: any) => void;
}> = ({ imageElement, isSelected, onSelect, onChange }) => {
  const [image] = useImage(imageElement.url, 'anonymous');
  const imageRef = React.useRef<any>(null);

  return (
    <Image
      ref={imageRef}
      id={imageElement.id}
      image={image}
      x={imageElement.x + imageElement.width / 2}
      y={imageElement.y + imageElement.height / 2}
      width={imageElement.width}
      height={imageElement.height}
      offsetX={imageElement.width / 2}
      offsetY={imageElement.height / 2}
      rotation={imageElement.rotation || 0}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => {
        const node = e.target;
        onChange({
          x: node.x() - imageElement.width / 2,
          y: node.y() - imageElement.height / 2,
        });
      }}
      onTransformEnd={(e) => {
        const node = imageRef.current;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        
        // Calculate new dimensions
        const newWidth = Math.max(5, node.width() * scaleX);
        const newHeight = Math.max(5, node.height() * scaleY);
        
        // Reset scale to 1
        node.scaleX(1);
        node.scaleY(1);
        
        // Update offsets for new size
        node.offsetX(newWidth / 2);
        node.offsetY(newHeight / 2);
        
        onChange({
          x: node.x() - newWidth / 2,
          y: node.y() - newHeight / 2,
          width: newWidth,
          height: newHeight,
          rotation: node.rotation(),
        });
      }}
    />
  );
};

interface DesignerCanvasProps {
  initialTemplate?: {
    id: string;
    name: string;
    canvasData: string;
  } | null;
  initialState?: {
    templateId?: string;
    variantId?: string;
    textUpdates?: Record<string, string>;
    fromModal?: boolean;
  } | null;
}

const DesignerCanvas: React.FC<DesignerCanvasProps> = ({ initialTemplate, initialState }) => {
  const shapeRef = React.useRef(null);
  const stageRef = React.useRef<any>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = React.useState({ width: 1000, height: 1000 });
  const [containerSize, setContainerSize] = React.useState({ width: 800, height: 600 });
  // Support for S3 URLs
  const [baseImageUrl, setBaseImageUrl] = React.useState('/media/images/8-spot-red-base-image.png');
  const [svgImageUrl, setSvgImageUrl] = React.useState('/media/images/borders_v7-11.svg');
  // Use 'anonymous' only for external URLs (S3), not for local files
  const [baseImage] = useImage(baseImageUrl, baseImageUrl.startsWith('http') ? 'anonymous' : undefined);
  const [svgImage] = useImage(svgImageUrl, svgImageUrl.startsWith('http') ? 'anonymous' : undefined);
  const [textElements, setTextElements] = React.useState<Array<{id: string, text: string, x: number, y: number, fontFamily: string, fontSize?: number, fill?: string, rotation?: number, scaleX?: number, scaleY?: number}>>([]);
  const [gradientTextElements, setGradientTextElements] = React.useState<Array<{id: string, text: string, x: number, y: number, fontFamily: string, fontSize?: number, rotation?: number, scaleX?: number, scaleY?: number}>>([]);
  const [svgElements, setSvgElements] = React.useState<Array<{id: string, x: number, y: number, width: number, height: number, rotation?: number, scaleX?: number, scaleY?: number}>>([]);
  const [curvedTextElements, setCurvedTextElements] = React.useState<Array<{id: string, text: string, x: number, topY: number, radius: number, flipped: boolean, fontFamily: string, fontSize?: number, fill?: string, rotation?: number, scaleX?: number, scaleY?: number}>>([]);
  const [imageElements, setImageElements] = React.useState<Array<{id: string, url: string, x: number, y: number, width: number, height: number, rotation?: number}>>([]);
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

  // Calculate scale factor for responsive canvas with padding
  const padding = 20; // Add some padding around the canvas
  const scale = Math.min(
    (containerSize.width - padding * 2) / dimensions.width,
    (containerSize.height - padding * 2) / dimensions.height,
    1 // Maximum scale of 1 to prevent canvas from becoming larger than actual size
  );

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

  // Handle container resize
  React.useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const container = containerRef.current;
        const rect = container.getBoundingClientRect();
        
        setContainerSize({
          width: rect.width,
          height: rect.height
        });
      }
    };

    // Set initial size with a small delay to ensure DOM is ready
    setTimeout(handleResize, 100);

    // Add resize listener
    window.addEventListener('resize', handleResize);
    
    // Also observe container size changes
    const resizeObserver = new ResizeObserver(handleResize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
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
      fontFamily: 'Arial',
      fontSize: 24,
      fill: 'black',
      rotation: 0,
      scaleX: 1,
      scaleY: 1
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
      fontFamily: 'Arial',
      fontSize: 20,
      fill: 'black',
      rotation: 0,
      scaleX: 1,
      scaleY: 1
    };
    setCurvedTextElements(prev => [...prev, newCurvedText]);
  };

  const addGradientText = () => {
    const newGradientText = {
      id: `gradient-text-${Date.now()}`,
      text: 'Gold Gradient Text',
      x: designableArea.x + designableArea.width / 2 - 80, // Center of designable area
      y: designableArea.y + designableArea.height / 2 - 12, // Center vertically (minus half font size)
      fontFamily: 'Arial',
      fontSize: 24,
      rotation: 0,
      scaleX: 1,
      scaleY: 1
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
      height: svgSize,
      rotation: 0,
      scaleX: 1,
      scaleY: 1
    };
    setSvgElements(prev => [...prev, newSvg]);
  };

  const handleStageClick = (e: any) => {
    if (e.target === e.target.getStage()) {
      setSelectedId(null);
      setEditingId(null);
    }
  };

  // Convert mouse coordinates to canvas coordinates when scaled
  const getCanvasCoordinates = (clientX: number, clientY: number) => {
    if (!stageRef.current) return { x: clientX, y: clientY };
    
    const stage = stageRef.current;
    const rect = stage.container().getBoundingClientRect();
    const x = (clientX - rect.left) / scale;
    const y = (clientY - rect.top) / scale;
    
    return { x, y };
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
        svgElements,
        imageElements
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
      if (state.elements.imageElements) setImageElements(state.elements.imageElements);
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

  // Apply text updates from modal state
  const applyTextUpdates = (textUpdates: Record<string, string>) => {
    if (!textUpdates) return;
    
    // Update regular text elements
    setTextElements(prev => 
      prev.map(el => 
        textUpdates[el.id] ? { ...el, text: textUpdates[el.id] } : el
      )
    );
    
    // Update curved text elements
    setCurvedTextElements(prev => 
      prev.map(el => 
        textUpdates[el.id] ? { ...el, text: textUpdates[el.id] } : el
      )
    );
    
    // Update gradient text elements
    setGradientTextElements(prev => 
      prev.map(el => 
        textUpdates[el.id] ? { ...el, text: textUpdates[el.id] } : el
      )
    );
  };

  // Save template function
  const saveTemplate = async () => {
    // If editing existing template, use its name, otherwise prompt for new name
    const templateName = initialTemplate?.name || prompt('Enter template name:');
    if (!templateName) return;

    setIsSaving(true);
    try {
      // Get canvas state
      const canvasState = getCanvasState();
      
      // Deselect everything to hide transformer before generating thumbnail
      setSelectedId(null);
      
      // Force transformer to detach
      if (transformerRef.current) {
        transformerRef.current.nodes([]);
        transformerRef.current.getLayer()?.batchDraw();
      }
      
      // Wait for the UI to update
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Wait for all images to be loaded
      const stage = stageRef.current;
      if (stage) {
        const allImages = stage.find('Image');
        const imageLoadPromises = allImages.map((imageNode: any) => {
          return new Promise((resolve) => {
            const img = imageNode.image();
            if (!img) {
              // No image loaded yet - wait a bit
              setTimeout(() => resolve(true), 500);
              return;
            }
            
            if (img.complete) {
              resolve(true);
            } else {
              // Set up both load and error handlers
              const onLoad = () => {
                img.removeEventListener('load', onLoad);
                img.removeEventListener('error', onError);
                resolve(true);
              };
              const onError = () => {
                console.warn('Image failed to load for thumbnail:', img.src);
                img.removeEventListener('load', onLoad);
                img.removeEventListener('error', onError);
                resolve(true); // Continue even if image fails
              };
              
              img.addEventListener('load', onLoad);
              img.addEventListener('error', onError);
              
              // Timeout after 5 seconds
              setTimeout(() => {
                img.removeEventListener('load', onLoad);
                img.removeEventListener('error', onError);
                resolve(true);
              }, 5000);
            }
          });
        });
        
        // Wait for all images to load
        await Promise.all(imageLoadPromises);
        
        // Force a redraw to ensure all images are rendered
        stage.batchDraw();
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Generate thumbnail - properly account for stage scale
      // Since the stage is scaled for responsive display, we need to adjust our capture parameters
      let thumbnail: string | undefined;
      try {
        // The stage is scaled, so we capture the scaled area but use inverse pixelRatio
        // to get the original resolution in the output
        thumbnail = stageRef.current?.toDataURL({ 
          x: 0,
          y: 0,
          width: dimensions.width * scale,    // Capture the full scaled width
          height: dimensions.height * scale,   // Capture the full scaled height
          pixelRatio: 1 / scale,              // Inverse scale to get original resolution
          mimeType: 'image/png'               // Use PNG to preserve exact appearance
        });
      } catch (thumbnailError) {
        console.error('Error generating thumbnail:', thumbnailError);
        // Try to generate a lower quality thumbnail as fallback
        try {
          thumbnail = stageRef.current?.toDataURL({ 
            x: 0,
            y: 0,
            width: dimensions.width * scale,
            height: dimensions.height * scale,
            pixelRatio: 0.6 / scale,  // Lower quality fallback with scale adjustment
            mimeType: 'image/png'
          });
        } catch (fallbackError) {
          console.error('Fallback thumbnail generation also failed:', fallbackError);
        }
      }

      const formData = new FormData();
      formData.append('name', templateName);
      formData.append('canvasData', JSON.stringify(canvasState));
      if (thumbnail) {
        formData.append('thumbnail', thumbnail);
      } else {
        console.warn('No thumbnail generated for template');
      }
      // Include template ID if we're updating an existing template
      if (initialTemplate?.id) {
        formData.append('templateId', initialTemplate.id);
      }

      const response = await fetch('/api/templates/save', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      
      if (result.success) {
        if (result.warning) {
          alert(`Template saved but with warning: ${result.warning}`);
        } else {
          alert('Template saved successfully!');
        }
        loadTemplatesList(); // Refresh templates list
      } else {
        throw new Error(result.error || 'Failed to save template');
      }
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Failed to save template: ' + (error instanceof Error ? error.message : 'Unknown error'));
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
      alert('Failed to load template: ' + (error instanceof Error ? error.message : 'Unknown error'));
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

  // Load initial template if provided
  React.useEffect(() => {
    if (initialTemplate && initialTemplate.canvasData) {
      try {
        const canvasData = JSON.parse(initialTemplate.canvasData);
        loadCanvasState(canvasData);
      } catch (error) {
        console.error('Error loading initial template:', error);
      }
    }
  }, [initialTemplate]);

  // Apply text updates from modal state after template is loaded
  React.useEffect(() => {
    if (initialState?.textUpdates && initialTemplate) {
      // Small delay to ensure template is fully loaded
      setTimeout(() => {
        applyTextUpdates(initialState.textUpdates!);
      }, 100);
    }
  }, [initialTemplate, initialState]);

  // Handle save event from full designer
  React.useEffect(() => {
    const handleSave = (event: any) => {
      if (event.detail?.source === 'fullDesigner') {
        // Use existing save functionality but with customer-friendly messaging
        saveTemplate();
      }
    };

    window.addEventListener('saveDesign', handleSave);
    return () => window.removeEventListener('saveDesign', handleSave);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '10px', flexShrink: 0, backgroundColor: '#f7f8fa', borderBottom: '1px solid #ddd', maxHeight: '300px', overflowY: 'auto' }}>
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
        
        {/* Add Image Button with file input */}
        <label style={{ 
          padding: '8px 16px', 
          fontSize: '14px', 
          marginRight: '10px',
          backgroundColor: '#f0f0f0',
          border: '1px solid #ccc',
          borderRadius: '3px',
          cursor: 'pointer',
          display: 'inline-block'
        }}>
          Add Image
          <input
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('assetType', 'userImage');
                
                try {
                  const response = await fetch('/api/assets/upload', {
                    method: 'POST',
                    body: formData,
                  });
                  const result = await response.json();
                  if (result.success) {
                    // Add image to canvas at center of designable area
                    const newImage = {
                      id: `image-${Date.now()}`,
                      url: result.asset.url,
                      x: designableArea.x + designableArea.width / 2 - 50, // Top-left position (center - half width)
                      y: designableArea.y + designableArea.height / 2 - 50, // Top-left position (center - half height)
                      width: 100,
                      height: 100,
                      rotation: 0
                    };
                    setImageElements(prev => [...prev, newImage]);
                  } else {
                    alert(`Upload failed: ${result.error}`);
                  }
                } catch (error) {
                  console.error('Upload error:', error);
                  alert('Failed to upload image');
                }
              }
            }}
          />
        </label>
        
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
            {isSaving ? 'Saving...' : initialTemplate ? 'Update Template' : 'Save Template'}
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
                    } else {
                      console.error('Upload failed:', result);
                      alert(`Upload failed: ${result.error}\n${result.details || ''}\n${result.hint || ''}`);
                    }
                  } catch (error) {
                    console.error('Upload error:', error);
                    alert('Failed to upload image: ' + (error instanceof Error ? error.message : 'Unknown error'));
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
      <div 
        ref={containerRef} 
        style={{ 
          width: '100%', 
          height: '100%', 
          flex: '1',
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          overflow: 'hidden',
          position: 'relative',
          minHeight: '400px',
          backgroundColor: '#ffffff'
        }}
      >
        <div style={{
          width: dimensions.width * scale,
          height: dimensions.height * scale,
          border: '1px solid #ddd',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          borderRadius: '4px',
          backgroundColor: 'white',
          overflow: 'hidden'
        }}>
          <Stage 
            ref={stageRef} 
            width={dimensions.width} 
            height={dimensions.height} 
            scaleX={scale} 
            scaleY={scale}
            onMouseDown={handleStageClick}
          >
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
            
            {textElements.map((textEl) => (
              <Text
                key={textEl.id}
                id={textEl.id}
                text={textEl.text}
                x={textEl.x}
                y={textEl.y}
                fontSize={textEl.fontSize || 24}
                fontFamily={textEl.fontFamily}
                fill={textEl.fill || "black"}
                rotation={textEl.rotation || 0}
                scaleX={textEl.scaleX || 1}
                scaleY={textEl.scaleY || 1}
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
                onTransformEnd={(e) => {
                  const node = e.target;
                  setTextElements(prev => 
                    prev.map(el => 
                      el.id === textEl.id 
                        ? { 
                            ...el, 
                            x: node.x(),
                            y: node.y(),
                            rotation: node.rotation(),
                            scaleX: node.scaleX(),
                            scaleY: node.scaleY()
                          }
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
                fontSize={gradientEl.fontSize || 24}
                fontFamily={gradientEl.fontFamily}
                rotation={gradientEl.rotation || 0}
                scaleX={gradientEl.scaleX || 1}
                scaleY={gradientEl.scaleY || 1}
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
                onTransformEnd={(e) => {
                  const node = e.target;
                  setGradientTextElements(prev => 
                    prev.map(el => 
                      el.id === gradientEl.id 
                        ? { 
                            ...el, 
                            x: node.x(),
                            y: node.y(),
                            rotation: node.rotation(),
                            scaleX: node.scaleX(),
                            scaleY: node.scaleY()
                          }
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
                x={svgEl.x + svgEl.width / 2}
                y={svgEl.y + svgEl.height / 2}
                width={svgEl.width}
                height={svgEl.height}
                offsetX={svgEl.width / 2}
                offsetY={svgEl.height / 2}
                rotation={svgEl.rotation || 0}
                scaleX={svgEl.scaleX || 1}
                scaleY={svgEl.scaleY || 1}
                draggable
                onClick={() => setSelectedId(svgEl.id)}
                onTap={() => setSelectedId(svgEl.id)}
                onDragEnd={(e) => {
                  const node = e.target;
                  setSvgElements(prev => 
                    prev.map(el => 
                      el.id === svgEl.id 
                        ? { 
                            ...el, 
                            x: node.x() - svgEl.width / 2,
                            y: node.y() - svgEl.height / 2
                          }
                        : el
                    )
                  );
                }}
                onTransformEnd={(e) => {
                  const node = e.target;
                  const scaleX = node.scaleX();
                  const scaleY = node.scaleY();
                  
                  // Calculate new dimensions
                  const newWidth = Math.max(5, svgEl.width * scaleX);
                  const newHeight = Math.max(5, svgEl.height * scaleY);
                  
                  // Reset scale to 1
                  node.scaleX(1);
                  node.scaleY(1);
                  
                  // Update offsets for new size
                  node.offsetX(newWidth / 2);
                  node.offsetY(newHeight / 2);
                  
                  setSvgElements(prev =>
                    prev.map(el =>
                      el.id === svgEl.id
                        ? {
                            ...el,
                            x: node.x() - newWidth / 2,
                            y: node.y() - newHeight / 2,
                            width: newWidth,
                            height: newHeight,
                            rotation: node.rotation(),
                            scaleX: 1,
                            scaleY: 1
                          }
                        : el
                    )
                  );
                }}
              />
            ))}
            {imageElements.map((imgEl) => (
              <ImageElement
                key={imgEl.id}
                imageElement={imgEl}
                isSelected={selectedId === imgEl.id}
                onSelect={() => setSelectedId(imgEl.id)}
                onChange={(newAttrs) => {
                  setImageElements(prev =>
                    prev.map(el =>
                      el.id === imgEl.id ? { ...el, ...newAttrs } : el
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
                rotation={curvedEl.rotation || 0}
                scaleX={curvedEl.scaleX || 1}
                scaleY={curvedEl.scaleY || 1}
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
                onTransformEnd={(e) => {
                  const node = e.target;
                  setCurvedTextElements(prev => 
                    prev.map(el => 
                      el.id === curvedEl.id 
                        ? { 
                            ...el, 
                            x: node.x(),
                            // Calculate topY from centerY based on flip state
                            topY: curvedEl.flipped 
                              ? node.y() + curvedEl.radius 
                              : node.y() - curvedEl.radius,
                            rotation: node.rotation(),
                            scaleX: node.scaleX(),
                            scaleY: node.scaleY()
                          }
                        : el
                    )
                  );
                }}
              >
                <TextPath
                  text={curvedEl.text}
                  data={pathData}
                  fontSize={curvedEl.fontSize || 20}
                  fontFamily={curvedEl.fontFamily}
                  fill={curvedEl.fill || "black"}
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
            centeredScaling
            boundBoxFunc={(oldBox, newBox) => {
              // Limit resize
              if (newBox.width < 5 || newBox.height < 5) {
                return oldBox;
              }
              return newBox;
            }}
            anchorCornerRadius={5}
            anchorSize={8}
            borderStroke="#0066ff"
            anchorStroke="#0066ff"
            anchorFill="white"
            keepRatio={true}
            rotateEnabled={true}
            rotateAnchorOffset={20}
            enabledAnchors={[
              'top-left',
              'top-center',
              'top-right',
              'middle-right',
              'middle-left',
              'bottom-left',
              'bottom-center',
              'bottom-right',
            ]}
          />
        </Layer>
        </Stage>
        </div>
      </div>
    </div>
  );
};


export default DesignerCanvas;
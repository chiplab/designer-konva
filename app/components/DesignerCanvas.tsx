import React from 'react';
import { Stage, Layer, Text, TextPath, Transformer, Group, Image, Rect } from 'react-konva';
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
  onDragEnd?: () => void;
  onTransformEnd?: () => void;
}> = ({ imageElement, onSelect, onChange, onDragEnd, onTransformEnd }) => {
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
        if (onDragEnd) onDragEnd();
      }}
      onTransformEnd={() => {
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
        if (onTransformEnd) onTransformEnd();
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
  // Use 'anonymous' only for external URLs (S3), not for local files
  const [baseImage] = useImage(baseImageUrl, baseImageUrl.startsWith('http') ? 'anonymous' : undefined);
  const [textElements, setTextElements] = React.useState<Array<{id: string, text: string, x: number, y: number, fontFamily: string, fontSize?: number, fill?: string, stroke?: string, strokeWidth?: number, rotation?: number, scaleX?: number, scaleY?: number}>>([]);
  const [gradientTextElements, setGradientTextElements] = React.useState<Array<{id: string, text: string, x: number, y: number, fontFamily: string, fontSize?: number, rotation?: number, scaleX?: number, scaleY?: number}>>([]);
  const [curvedTextElements, setCurvedTextElements] = React.useState<Array<{id: string, text: string, x: number, topY: number, radius: number, flipped: boolean, fontFamily: string, fontSize?: number, fill?: string, stroke?: string, strokeWidth?: number, rotation?: number, scaleX?: number, scaleY?: number}>>([]);
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
  const [isSaving, setIsSaving] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [templates, setTemplates] = React.useState<Array<{id: string, name: string}>>([]);
  const [floatingToolbarPos, setFloatingToolbarPos] = React.useState<{ x: number; y: number } | null>(null);
  const transformerRef = React.useRef<any>(null);
  const [showColorPicker, setShowColorPicker] = React.useState(false);
  const [showBackgroundColorPicker, setShowBackgroundColorPicker] = React.useState(false);
  const [showDesignAreaControls, setShowDesignAreaControls] = React.useState(false);
  const [showStrokeColorPicker, setShowStrokeColorPicker] = React.useState(false);

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
        
        // Calculate floating toolbar position
        const box = transformerRef.current.getClientRect();
        const stageBox = stage.container().getBoundingClientRect();
        
        // Position toolbar above the transformer with some padding
        setFloatingToolbarPos({
          x: stageBox.left + (box.x + box.width / 2) * scale,
          y: stageBox.top + (box.y - 50) * scale // 50px above the element
        });
      }
    } else {
      setFloatingToolbarPos(null);
      setShowColorPicker(false); // Close color picker when deselecting
      setShowBackgroundColorPicker(false); // Close background color picker when deselecting
      setShowDesignAreaControls(false); // Close design area controls when deselecting
      setShowStrokeColorPicker(false); // Close stroke color picker when deselecting
      // Detach transformer when nothing is selected
      if (transformerRef.current) {
        transformerRef.current.nodes([]);
        transformerRef.current.getLayer()?.batchDraw();
      }
    }
  }, [selectedId, scale]);

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



  const handleStageClick = (e: any) => {
    // Get the clicked target
    const clickedTarget = e.target;
    
    // Check if we clicked on something that should deselect
    // This includes: stage, background elements, non-draggable shapes
    const shouldDeselect = 
      clickedTarget === e.target.getStage() || // Clicked on stage itself
      clickedTarget.getClassName() === 'Layer' || // Clicked on layer
      (clickedTarget.getClassName() === 'Rect' && !clickedTarget.draggable()) || // Background rect
      (clickedTarget.getClassName() === 'Image' && !clickedTarget.draggable()) || // Base image (non-draggable)
      (clickedTarget.getClassName() === 'Group' && !clickedTarget.draggable()); // Group container
    
    if (shouldDeselect) {
      setSelectedId(null);
      setShowColorPicker(false);
      setShowBackgroundColorPicker(false);
      setShowDesignAreaControls(false);
      setShowStrokeColorPicker(false);
      // Immediately detach transformer
      if (transformerRef.current) {
        transformerRef.current.nodes([]);
        transformerRef.current.getLayer()?.batchDraw();
      }
    }
  };

  // Duplicate element function
  const duplicateElement = () => {
    if (!selectedId) return;
    
    // Find the element to duplicate
    const textEl = textElements.find(el => el.id === selectedId);
    if (textEl) {
      const newEl = {
        ...textEl,
        id: `text-${Date.now()}`,
        x: textEl.x + 20,
        y: textEl.y + 20
      };
      setTextElements(prev => [...prev, newEl]);
      setSelectedId(newEl.id);
      return;
    }
    
    const curvedEl = curvedTextElements.find(el => el.id === selectedId);
    if (curvedEl) {
      const newEl = {
        ...curvedEl,
        id: `curved-text-${Date.now()}`,
        x: curvedEl.x + 20,
        topY: curvedEl.topY + 20
      };
      setCurvedTextElements(prev => [...prev, newEl]);
      setSelectedId(newEl.id);
      return;
    }
    
    const gradientEl = gradientTextElements.find(el => el.id === selectedId);
    if (gradientEl) {
      const newEl = {
        ...gradientEl,
        id: `gradient-text-${Date.now()}`,
        x: gradientEl.x + 20,
        y: gradientEl.y + 20
      };
      setGradientTextElements(prev => [...prev, newEl]);
      setSelectedId(newEl.id);
      return;
    }
    
    const imgEl = imageElements.find(el => el.id === selectedId);
    if (imgEl) {
      const newEl = {
        ...imgEl,
        id: `image-${Date.now()}`,
        x: imgEl.x + 20,
        y: imgEl.y + 20
      };
      setImageElements(prev => [...prev, newEl]);
      setSelectedId(newEl.id);
    }
  };


  // Update floating toolbar position
  const updateToolbarPosition = () => {
    if (selectedId && transformerRef.current && stageRef.current) {
      const stage = stageRef.current;
      const box = transformerRef.current.getClientRect();
      const stageBox = stage.container().getBoundingClientRect();
      
      setFloatingToolbarPos({
        x: stageBox.left + (box.x + box.width / 2) * scale,
        y: stageBox.top + (box.y - 50) * scale
      });
    }
  };


  const handleDiameterChange = (newRadius: number) => {
    if (selectedId) {
      setCurvedTextElements(prev => 
        prev.map(el => {
          if (el.id === selectedId) {
            // When changing radius, we want to keep the top edge of the text fixed
            // For normal text: the top edge is at topY
            // For flipped text: the top edge is at (topY - 2*oldRadius)
            // We need to adjust topY to maintain the visual top position
            
            if (el.flipped) {
              // For flipped text, the visual top is at (topY - 2*radius)
              // We want to keep this constant, so:
              // oldVisualTop = topY - 2*oldRadius
              // newVisualTop = newTopY - 2*newRadius
              // Since we want oldVisualTop = newVisualTop:
              // topY - 2*oldRadius = newTopY - 2*newRadius
              // newTopY = topY + 2*(newRadius - oldRadius)
              const oldRadius = el.radius;
              const newTopY = el.topY + 2 * (newRadius - oldRadius);
              return { ...el, radius: newRadius, topY: newTopY };
            } else {
              // For normal text, topY already represents the top edge
              // so we don't need to adjust it
              return { ...el, radius: newRadius };
            }
          }
          return el;
        })
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

  const handleFontSizeChange = (fontSize: number) => {
    if (!selectedId) return;
    
    // Update the appropriate element state
    // Check if it's a curved text element
    const curvedElement = curvedTextElements.find(el => el.id === selectedId);
    if (curvedElement) {
      setCurvedTextElements(prev => 
        prev.map(el => el.id === selectedId ? { ...el, fontSize } : el)
      );
    }
    
    // Check if it's a regular text element
    const textElement = textElements.find(el => el.id === selectedId);
    if (textElement) {
      setTextElements(prev => 
        prev.map(el => el.id === selectedId ? { ...el, fontSize } : el)
      );
    }
    
    // Check if it's a gradient text element
    const gradientElement = gradientTextElements.find(el => el.id === selectedId);
    if (gradientElement) {
      setGradientTextElements(prev => 
        prev.map(el => el.id === selectedId ? { ...el, fontSize } : el)
      );
    }
    
    // Force re-render and update transformer bounds after font size change
    setTimeout(() => {
      if (transformerRef.current) {
        const stage = transformerRef.current.getStage();
        const selectedNode = stage?.findOne('#' + selectedId);
        if (selectedNode) {
          // Re-render the layer first
          selectedNode.getLayer()?.batchDraw();
          
          // Force transformer to recalculate bounds for new font size
          transformerRef.current.nodes([selectedNode]);
          transformerRef.current.forceUpdate();
          transformerRef.current.getLayer()?.batchDraw();
        }
      }
    }, 50); // Small delay to ensure font size is applied
  };

  const handleColorChange = (color: string) => {
    if (!selectedId) return;
    
    // Update the appropriate element state
    // Check if it's a curved text element
    const curvedElement = curvedTextElements.find(el => el.id === selectedId);
    if (curvedElement) {
      setCurvedTextElements(prev => 
        prev.map(el => el.id === selectedId ? { ...el, fill: color } : el)
      );
    }
    
    // Check if it's a regular text element
    const textElement = textElements.find(el => el.id === selectedId);
    if (textElement) {
      setTextElements(prev => 
        prev.map(el => el.id === selectedId ? { ...el, fill: color } : el)
      );
    }
    
    // Note: Gradient text elements don't use the fill property
  };

  const handleStrokeColorChange = (color: string) => {
    if (!selectedId) return;
    
    // Update the appropriate element state
    // Check if it's a curved text element
    const curvedElement = curvedTextElements.find(el => el.id === selectedId);
    if (curvedElement) {
      setCurvedTextElements(prev => 
        prev.map(el => el.id === selectedId ? { ...el, stroke: color, strokeWidth: el.strokeWidth || 2 } : el)
      );
    }
    
    // Check if it's a regular text element
    const textElement = textElements.find(el => el.id === selectedId);
    if (textElement) {
      setTextElements(prev => 
        prev.map(el => el.id === selectedId ? { ...el, stroke: color, strokeWidth: el.strokeWidth || 2 } : el)
      );
    }
    
    // Note: Gradient text elements don't use stroke
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
        imageElements
      },
      assets: {
        baseImage: baseImageUrl,
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
      if (state.elements.imageElements) setImageElements(state.elements.imageElements);
    }
    
    // Load assets (with fallback to local defaults)
    if (state.assets) {
      if (state.assets.baseImage) {
        setBaseImageUrl(state.assets.baseImage);
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

  // Delete element function
  const deleteSelectedElement = () => {
    if (!selectedId) return;
    
    // Find and remove the element from appropriate state
    setTextElements(prev => prev.filter(el => el.id !== selectedId));
    setCurvedTextElements(prev => prev.filter(el => el.id !== selectedId));
    setGradientTextElements(prev => prev.filter(el => el.id !== selectedId));
    setImageElements(prev => prev.filter(el => el.id !== selectedId));
    
    // Clear selection and force transformer to detach
    setSelectedId(null);
    if (transformerRef.current) {
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  };

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+D or Cmd+D to duplicate
      if (e.key === 'd' && (e.ctrlKey || e.metaKey) && selectedId) {
        e.preventDefault();
        duplicateElement();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId]);

  // Close color picker when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Check if click is outside color picker
      const target = e.target as HTMLElement;
      const colorPicker = target.closest('[data-color-picker]');
      const colorButton = target.closest('[data-color-button]');
      
      if (!colorPicker && !colorButton && showColorPicker) {
        setShowColorPicker(false);
      }
    };

    if (showColorPicker) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showColorPicker]);

  // Close background color picker when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Check if click is outside background color picker
      const target = e.target as HTMLElement;
      const bgColorPicker = target.closest('[data-bg-color-picker]');
      const bgColorButton = target.closest('[data-bg-color-button]');
      
      if (!bgColorPicker && !bgColorButton && showBackgroundColorPicker) {
        setShowBackgroundColorPicker(false);
      }
    };

    if (showBackgroundColorPicker) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showBackgroundColorPicker]);

  // Close design area controls when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Check if click is outside design area controls
      const target = e.target as HTMLElement;
      const designControls = target.closest('[data-design-controls]');
      const designButton = target.closest('[data-design-button]');
      
      if (!designControls && !designButton && showDesignAreaControls) {
        setShowDesignAreaControls(false);
      }
    };

    if (showDesignAreaControls) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showDesignAreaControls]);

  // Close stroke color picker when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Check if click is outside stroke color picker
      const target = e.target as HTMLElement;
      const strokeColorPicker = target.closest('[data-stroke-color-picker]');
      const strokeColorButton = target.closest('[data-stroke-color-button]');
      
      if (!strokeColorPicker && !strokeColorButton && showStrokeColorPicker) {
        setShowStrokeColorPicker(false);
      }
    };

    if (showStrokeColorPicker) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showStrokeColorPicker]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '10px', flexShrink: 0, backgroundColor: '#f7f8fa', borderBottom: '1px solid #ddd', maxHeight: '300px', overflowY: 'auto' }}>
        <button onClick={addText} style={{ padding: '8px 16px', fontSize: '14px', marginRight: '10px' }}>
          Add Text
        </button>
        <button onClick={addCurvedText} style={{ padding: '8px 16px', fontSize: '14px', marginRight: '10px' }}>
          Add Curved Text
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
                    // Load the image to get its natural dimensions
                    const img = new window.Image();
                    img.crossOrigin = 'anonymous';
                    img.onload = () => {
                      // Calculate size maintaining aspect ratio
                      const maxSize = 400; // Maximum width or height
                      const aspectRatio = img.width / img.height;
                      let width, height;
                      
                      if (img.width > img.height) {
                        // Landscape image
                        width = Math.min(img.width, maxSize);
                        height = width / aspectRatio;
                      } else {
                        // Portrait or square image
                        height = Math.min(img.height, maxSize);
                        width = height * aspectRatio;
                      }
                      
                      // Add image to canvas at center of designable area
                      const newImage = {
                        id: `image-${Date.now()}`,
                        url: result.asset.url,
                        x: designableArea.x + designableArea.width / 2 - width / 2, // Center horizontally
                        y: designableArea.y + designableArea.height / 2 - height / 2, // Center vertically
                        width: width,
                        height: height,
                        rotation: 0
                      };
                      setImageElements(prev => [...prev, newImage]);
                    };
                    img.onerror = () => {
                      console.error('Failed to load image for dimensions');
                      // Fallback to square if image fails to load
                      const newImage = {
                        id: `image-${Date.now()}`,
                        url: result.asset.url,
                        x: designableArea.x + designableArea.width / 2 - 50,
                        y: designableArea.y + designableArea.height / 2 - 50,
                        width: 100,
                        height: 100,
                        rotation: 0
                      };
                      setImageElements(prev => [...prev, newImage]);
                    };
                    img.src = result.asset.url;
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
        
        {/* Background Color Control in Top Nav */}
        <div style={{ display: 'inline-block', marginLeft: '20px', position: 'relative' }}>
          <button
            data-bg-color-button="true"
            onClick={() => setShowBackgroundColorPicker(!showBackgroundColorPicker)}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              borderRadius: '4px',
              border: '1px solid #ddd',
              background: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
          >
            <span style={{ fontSize: '12px', color: '#666' }}>Background:</span>
            <div
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '3px',
                backgroundColor: backgroundColor === 'transparent' ? '#f0f0f0' : backgroundColor,
                backgroundImage: backgroundColor === 'transparent' 
                  ? 'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc)'
                  : backgroundColor === 'linear-gradient'
                  ? 'linear-gradient(135deg, #c8102e 0%, #ffaaaa 100%)'
                  : backgroundColor === 'radial-gradient'
                  ? 'radial-gradient(circle at center, #c8102e 0%, #ffaaaa 100%)'
                  : undefined,
                backgroundSize: backgroundColor === 'transparent' ? '6px 6px' : undefined,
                backgroundPosition: backgroundColor === 'transparent' ? '0 0, 3px 3px' : undefined,
                border: '1px solid #ccc',
                boxShadow: backgroundColor === '#ffffff' ? 'inset 0 0 0 1px #ddd' : 'none'
              }}
            />
          </button>
          
          {/* Background Color Picker Popup */}
          {showBackgroundColorPicker && (
            <div
              data-bg-color-picker="true"
              style={{
                position: 'absolute',
                top: '40px',
                left: 0,
                background: 'white',
                border: '1px solid #ccc',
                borderRadius: '6px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                padding: '8px',
                display: 'flex',
                gap: '6px',
                flexWrap: 'wrap',
                width: '280px',
                zIndex: 1001,
              }}
            >
              {/* Transparent option */}
              <button
                onClick={() => {
                  setBackgroundColor('transparent');
                  setShowBackgroundColorPicker(false);
                }}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: '#f0f0f0',
                  backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc)',
                  backgroundSize: '10px 10px',
                  backgroundPosition: '0 0, 5px 5px',
                  border: backgroundColor === 'transparent' ? '3px solid #0066ff' : '2px solid #ccc',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'all 0.2s',
                }}
                title="Transparent"
                onMouseEnter={(e) => {
                  if (backgroundColor !== 'transparent') {
                    e.currentTarget.style.transform = 'scale(1.1)';
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              
              {/* Color swatches */}
              {[
                { name: 'White', hex: '#ffffff' },
                { name: 'Red', hex: '#c8102e' },
                { name: 'Blue', hex: '#0057b8' },
                { name: 'Green', hex: '#009639' },
                { name: 'Black', hex: '#000000' },
                { name: 'Purple', hex: '#5f259f' },
                { name: 'Yellow', hex: '#fff110' },
                { name: 'Grey', hex: '#a2aaad' },
                { name: 'Orange', hex: '#ff8200' },
                { name: 'Ivory', hex: '#f1e6b2' },
                { name: 'Light Blue', hex: '#71c5e8' },
                { name: 'Pink', hex: '#f8a3bc' },
                { name: 'Brown', hex: '#9e652e' }
              ].map((color) => (
                <button
                  key={color.hex}
                  onClick={() => {
                    setBackgroundColor(color.hex);
                    setShowBackgroundColorPicker(false);
                  }}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: color.hex,
                    border: backgroundColor === color.hex ? '3px solid #0066ff' : '2px solid #ccc',
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'all 0.2s',
                    boxShadow: color.hex === '#ffffff' ? 'inset 0 0 0 1px #ddd' : 'none'
                  }}
                  title={color.name}
                  onMouseEnter={(e) => {
                    if (backgroundColor !== color.hex) {
                      e.currentTarget.style.transform = 'scale(1.1)';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = color.hex === '#ffffff' ? 'inset 0 0 0 1px #ddd' : 'none';
                  }}
                />
              ))}
              
              {/* Gradient options */}
              <button
                onClick={() => {
                  setBackgroundColor('linear-gradient');
                  setShowBackgroundColorPicker(false);
                }}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #c8102e 0%, #ffaaaa 100%)',
                  border: backgroundColor === 'linear-gradient' ? '3px solid #0066ff' : '2px solid #ccc',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'all 0.2s',
                }}
                title="Linear Gradient"
                onMouseEnter={(e) => {
                  if (backgroundColor !== 'linear-gradient') {
                    e.currentTarget.style.transform = 'scale(1.1)';
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              <button
                onClick={() => {
                  setBackgroundColor('radial-gradient');
                  setShowBackgroundColorPicker(false);
                }}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle at center, #c8102e 0%, #ffaaaa 100%)',
                  border: backgroundColor === 'radial-gradient' ? '3px solid #0066ff' : '2px solid #ccc',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'all 0.2s',
                }}
                title="Radial Gradient"
                onMouseEnter={(e) => {
                  if (backgroundColor !== 'radial-gradient') {
                    e.currentTarget.style.transform = 'scale(1.1)';
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>
          )}
        </div>
        
        {/* Design Area Controls Dropdown in Top Nav */}
        <div style={{ display: 'inline-block', marginLeft: '20px', position: 'relative' }}>
          <button
            data-design-button="true"
            onClick={() => setShowDesignAreaControls(!showDesignAreaControls)}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              borderRadius: '4px',
              border: '1px solid #ddd',
              background: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
          >
            <span style={{ fontSize: '14px' }}>Design Area</span>
            <span style={{ fontSize: '10px' }}>{showDesignAreaControls ? '▲' : '▼'}</span>
          </button>
          
          {/* Design Area Controls Dropdown */}
          {showDesignAreaControls && (
            <div
              data-design-controls="true"
              style={{
                position: 'absolute',
                top: '40px',
                left: 0,
                background: 'white',
                border: '1px solid #ccc',
                borderRadius: '6px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                padding: '16px',
                zIndex: 1001,
                minWidth: '300px',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Center X Control */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                    Center X: {Math.round(designableArea.x + designableArea.width / 2)}px
                  </label>
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
                    style={{ width: '100%', cursor: 'pointer' }}
                  />
                </div>
                
                {/* Center Y Control */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                    Center Y: {Math.round(designableArea.y + designableArea.height / 2)}px
                  </label>
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
                    style={{ width: '100%', cursor: 'pointer' }}
                  />
                </div>
                
                {/* Width Control */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                    Width: {designableArea.width}px
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={() => {
                        const newWidth = Math.max(100, designableArea.width - 10);
                        const centerX = designableArea.x + designableArea.width / 2;
                        setDesignableArea(prev => ({ 
                          ...prev, 
                          width: newWidth,
                          x: centerX - newWidth / 2,
                          cornerRadius: Math.min(prev.cornerRadius, newWidth / 2)
                        }));
                      }}
                      style={{ padding: '2px 8px', fontSize: '14px', cursor: 'pointer' }}
                    >
                      -
                    </button>
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
                          x: centerX - newWidth / 2,
                          cornerRadius: Math.min(prev.cornerRadius, newWidth / 2)
                        }));
                      }}
                      style={{ flex: 1, cursor: 'pointer' }}
                    />
                    <button
                      onClick={() => {
                        const newWidth = Math.min(1000, designableArea.width + 10);
                        const centerX = designableArea.x + designableArea.width / 2;
                        setDesignableArea(prev => ({ 
                          ...prev, 
                          width: newWidth,
                          x: centerX - newWidth / 2,
                          cornerRadius: Math.min(prev.cornerRadius, newWidth / 2)
                        }));
                      }}
                      style={{ padding: '2px 8px', fontSize: '14px', cursor: 'pointer' }}
                    >
                      +
                    </button>
                  </div>
                </div>
                
                {/* Height Control */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                    Height: {designableArea.height}px
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={() => {
                        const newHeight = Math.max(100, designableArea.height - 10);
                        const centerY = designableArea.y + designableArea.height / 2;
                        setDesignableArea(prev => ({ 
                          ...prev, 
                          height: newHeight,
                          y: centerY - newHeight / 2,
                          cornerRadius: Math.min(prev.cornerRadius, newHeight / 2)
                        }));
                      }}
                      style={{ padding: '2px 8px', fontSize: '14px', cursor: 'pointer' }}
                    >
                      -
                    </button>
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
                          y: centerY - newHeight / 2,
                          cornerRadius: Math.min(prev.cornerRadius, newHeight / 2)
                        }));
                      }}
                      style={{ flex: 1, cursor: 'pointer' }}
                    />
                    <button
                      onClick={() => {
                        const newHeight = Math.min(1000, designableArea.height + 10);
                        const centerY = designableArea.y + designableArea.height / 2;
                        setDesignableArea(prev => ({ 
                          ...prev, 
                          height: newHeight,
                          y: centerY - newHeight / 2,
                          cornerRadius: Math.min(prev.cornerRadius, newHeight / 2)
                        }));
                      }}
                      style={{ padding: '2px 8px', fontSize: '14px', cursor: 'pointer' }}
                    >
                      +
                    </button>
                  </div>
                </div>
                
                {/* Corner Radius Control */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                    Corner Radius: {designableArea.cornerRadius}px
                    <span style={{ marginLeft: '8px', fontSize: '11px', color: '#999' }}>
                      {designableArea.cornerRadius === Math.min(designableArea.width, designableArea.height) / 2 ? '(Circle)' : '(Rectangle)'}
                    </span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max={Math.min(designableArea.width, designableArea.height) / 2}
                    value={designableArea.cornerRadius}
                    onChange={(e) => setDesignableArea(prev => ({ ...prev, cornerRadius: parseInt(e.target.value) }))}
                    style={{ width: '100%', cursor: 'pointer' }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Base Image Controls in Top Nav */}
        <div style={{ display: 'inline-block', marginLeft: '20px' }}>
          <select
            value={baseImageUrl}
            onChange={(e) => setBaseImageUrl(e.target.value)}
            style={{ 
              padding: '8px 16px', 
              fontSize: '14px',
              marginRight: '10px',
              borderRadius: '4px',
              border: '1px solid #ddd',
              cursor: 'pointer',
              background: 'white',
            }}
          >
            <option value="/media/images/8-spot-red-base-image.png">Red Base</option>
            <option value="/media/images/8-spot-black-base.png">Black Base</option>
            <option value="/media/images/8-spot-blue-base.png">Blue Base</option>
            <option value="https://shopify-designs.s3.us-west-1.amazonaws.com/assets/default/images/8-spot-red-base-image.png">Red Base (S3)</option>
            <option value="https://shopify-designs.s3.us-west-1.amazonaws.com/assets/default/images/8-spot-black-base.png">Black Base (S3)</option>
            <option value="https://shopify-designs.s3.us-west-1.amazonaws.com/assets/default/images/8-spot-blue-base.png">Blue Base (S3)</option>
          </select>
          
          <label style={{ 
            padding: '8px 16px', 
            fontSize: '14px', 
            backgroundColor: '#f0f0f0',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'inline-block',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e8e8e8'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
          >
            Upload Base Image
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
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
                      alert('Base image uploaded successfully!');
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
            />
          </label>
        </div>
        
        
        {/* Canvas Size Debug Info */}
        <div style={{ marginTop: '10px', padding: '5px', fontSize: '12px', color: '#6c757d', fontFamily: 'monospace' }}>
          Canvas Size: {dimensions.width} px width × {dimensions.height} px height
        </div>
      </div>
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
            onTouchStart={handleStageClick}
          >
        <Layer onMouseDown={handleStageClick} onTouchStart={handleStageClick}>
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
            
            {/* Render images first so text appears on top */}
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
                onDragEnd={() => setTimeout(updateToolbarPosition, 0)}
                onTransformEnd={() => setTimeout(updateToolbarPosition, 0)}
              />
            ))}
            
            {textElements.map((textEl) => (
              <Text
                key={textEl.id}
                id={textEl.id}
                text={textEl.text}
                x={textEl.x}
                y={textEl.y}
                fontSize={textEl.fontSize || 24}
                fontFamily={textEl.fontFamily}
                fill={textEl.fill === 'gold-gradient' ? undefined : (textEl.fill || "black")}
                fillLinearGradientStartPoint={textEl.fill === 'gold-gradient' ? { x: 0, y: 0 } : undefined}
                fillLinearGradientEndPoint={textEl.fill === 'gold-gradient' ? { x: 0, y: textEl.fontSize || 24 } : undefined}
                fillLinearGradientColorStops={textEl.fill === 'gold-gradient' ? [0, '#FFD700', 0.5, '#FFA500', 1, '#B8860B'] : undefined}
                stroke={textEl.stroke && textEl.stroke !== 'transparent' ? textEl.stroke : undefined}
                strokeWidth={textEl.stroke && textEl.stroke !== 'transparent' ? (textEl.strokeWidth || 2) : 0}
                fillAfterStrokeEnabled={true}
                rotation={textEl.rotation || 0}
                scaleX={textEl.scaleX || 1}
                scaleY={textEl.scaleY || 1}
                draggable
                onClick={() => setSelectedId(textEl.id)}
                onTap={() => setSelectedId(textEl.id)}
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
                  setTimeout(updateToolbarPosition, 0);
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
                  setTimeout(updateToolbarPosition, 0);
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
                  setTimeout(updateToolbarPosition, 0);
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
                  setTimeout(updateToolbarPosition, 0);
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
            
            // Create path for text - scale with font size
            const fontSize = curvedEl.fontSize || 20;
            const textLength = curvedEl.text.length * fontSize * 0.6; // Scale text length with font size
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
                  setTimeout(updateToolbarPosition, 0);
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
                  setTimeout(updateToolbarPosition, 0);
                }}
              >
                <TextPath
                  text={curvedEl.text}
                  data={pathData}
                  fontSize={curvedEl.fontSize || 20}
                  fontFamily={curvedEl.fontFamily}
                  fill={curvedEl.fill === 'gold-gradient' ? undefined : (curvedEl.fill || "black")}
                  fillLinearGradientStartPoint={curvedEl.fill === 'gold-gradient' ? { x: 0, y: 0 } : undefined}
                  fillLinearGradientEndPoint={curvedEl.fill === 'gold-gradient' ? { x: 0, y: curvedEl.fontSize || 20 } : undefined}
                  fillLinearGradientColorStops={curvedEl.fill === 'gold-gradient' ? [0, '#FFD700', 0.5, '#FFA500', 1, '#B8860B'] : undefined}
                  stroke={curvedEl.stroke && curvedEl.stroke !== 'transparent' ? curvedEl.stroke : undefined}
                  strokeWidth={curvedEl.stroke && curvedEl.stroke !== 'transparent' ? (curvedEl.strokeWidth || 2) : 0}
                  fillAfterStrokeEnabled={true}
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
      
      {/* Fixed Top Toolbar - positioned at top of canvas */}
      {selectedId && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '80px',
            transform: 'translateX(-50%)',
            background: 'white',
            border: '1px solid #ddd',
            borderRadius: '8px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
            padding: '8px',
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            zIndex: 1000,
          }}
        >
          {/* Actions Group */}
          <button
            onClick={duplicateElement}
            style={{
              width: '36px',
              height: '36px',
              padding: '6px',
              border: 'none',
              borderRadius: '6px',
              background: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
            title="Duplicate (Ctrl+D)"
          >
            📋
          </button>
          <button
            onClick={deleteSelectedElement}
            style={{
              width: '36px',
              height: '36px',
              padding: '6px',
              border: 'none',
              borderRadius: '6px',
              background: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#ffebee'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
            title="Delete"
          >
            🗑️
          </button>
          
          {/* Font controls - only show for text elements */}
          {(textElements.find(el => el.id === selectedId) || gradientTextElements.find(el => el.id === selectedId) || curvedTextElements.find(el => el.id === selectedId)) && (
            <>
              <div style={{ width: '1px', background: '#e0e0e0', height: '24px', margin: '0 4px' }} />
              
              {/* Font Family Dropdown - no label */}
              <select
                value={
                  textElements.find(el => el.id === selectedId)?.fontFamily ||
                  gradientTextElements.find(el => el.id === selectedId)?.fontFamily ||
                  curvedTextElements.find(el => el.id === selectedId)?.fontFamily ||
                  'Arial'
                }
                onChange={(e) => handleFontChange(e.target.value)}
                style={{ 
                  padding: '4px 8px', 
                  fontSize: '14px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  background: 'white',
                  cursor: 'pointer'
                }}
              >
                {priorityFonts.map(font => (
                  <option key={font} value={font}>
                    {font} {loadedFonts.has(font) ? '✓' : '⏳'}
                  </option>
                ))}
              </select>
              
              {/* Font Size - with label */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '14px' }}>Size:</span>
                <input
                  type="number"
                  min="8"
                  max="72"
                  value={
                    textElements.find(el => el.id === selectedId)?.fontSize ||
                    gradientTextElements.find(el => el.id === selectedId)?.fontSize ||
                    curvedTextElements.find(el => el.id === selectedId)?.fontSize ||
                    24
                  }
                  onChange={(e) => handleFontSizeChange(parseInt(e.target.value) || 24)}
                  style={{ 
                    width: '50px', 
                    padding: '4px', 
                    fontSize: '14px',
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                  }}
                />
              </div>
              
              {/* Color Swatch */}
              <div style={{ position: 'relative' }}>
                <button
                  data-color-button="true"
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: (() => {
                      const color = textElements.find(el => el.id === selectedId)?.fill ||
                        curvedTextElements.find(el => el.id === selectedId)?.fill ||
                        '#000000';
                      return color === 'gold-gradient' ? 'transparent' : color;
                    })(),
                    background: (() => {
                      const color = textElements.find(el => el.id === selectedId)?.fill ||
                        curvedTextElements.find(el => el.id === selectedId)?.fill ||
                        '#000000';
                      return color === 'gold-gradient' ? 'linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #B8860B 100%)' : color;
                    })(),
                    border: '2px solid #ccc',
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'all 0.2s',
                    boxShadow: showColorPicker ? '0 0 0 2px #0066ff' : 'none'
                  }}
                  title="Text Color"
                />
                
                {/* Color Picker Popup */}
                {showColorPicker && (
                  <div
                    data-color-picker="true"
                    style={{
                    position: 'absolute',
                    top: '36px',
                    right: 0,
                    background: 'white',
                    border: '1px solid #ccc',
                    borderRadius: '6px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    padding: '8px',
                    display: 'flex',
                    gap: '6px',
                    flexWrap: 'wrap',
                    width: '200px',
                    zIndex: 1001,
                  }}>
                    {[
                      { name: 'White', hex: '#ffffff' },
                      { name: 'Red', hex: '#c8102e' },
                      { name: 'Blue', hex: '#0057b8' },
                      { name: 'Green', hex: '#009639' },
                      { name: 'Black', hex: '#000000' },
                      { name: 'Purple', hex: '#5f259f' },
                      { name: 'Yellow', hex: '#fff110' },
                      { name: 'Grey', hex: '#a2aaad' },
                      { name: 'Orange', hex: '#ff8200' },
                      { name: 'Ivory', hex: '#f1e6b2' },
                      { name: 'Light Blue', hex: '#71c5e8' },
                      { name: 'Pink', hex: '#f8a3bc' },
                      { name: 'Brown', hex: '#9e652e' }
                    ].map((color) => {
                      const currentColor = 
                        textElements.find(el => el.id === selectedId)?.fill ||
                        curvedTextElements.find(el => el.id === selectedId)?.fill ||
                        '#000000';
                      
                      return (
                        <button
                          key={color.hex}
                          onClick={() => {
                            handleColorChange(color.hex);
                            setShowColorPicker(false);
                          }}
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            backgroundColor: color.hex,
                            border: currentColor === color.hex ? '2px solid #0066ff' : '1px solid #ccc',
                            cursor: 'pointer',
                            padding: 0,
                            transition: 'all 0.2s',
                            boxShadow: color.hex === '#ffffff' ? 'inset 0 0 0 1px #ddd' : 'none'
                          }}
                          title={color.name}
                          onMouseEnter={(e) => {
                            if (currentColor !== color.hex) {
                              e.currentTarget.style.transform = 'scale(1.1)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                        />
                      );
                    })}
                    
                    {/* Gold Gradient option */}
                    <button
                      onClick={() => {
                        handleColorChange('gold-gradient');
                        setShowColorPicker(false);
                      }}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #B8860B 100%)',
                        border: (textElements.find(el => el.id === selectedId)?.fill || curvedTextElements.find(el => el.id === selectedId)?.fill) === 'gold-gradient' ? '2px solid #0066ff' : '1px solid #ccc',
                        cursor: 'pointer',
                        padding: 0,
                        transition: 'all 0.2s',
                      }}
                      title="Gold Gradient"
                      onMouseEnter={(e) => {
                        const currentColor = textElements.find(el => el.id === selectedId)?.fill || curvedTextElements.find(el => el.id === selectedId)?.fill;
                        if (currentColor !== 'gold-gradient') {
                          e.currentTarget.style.transform = 'scale(1.1)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    />
                  </div>
                )}
              </div>
              
              {/* Stroke Color Control */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '12px', color: '#666' }}>Stroke:</span>
                <div style={{ position: 'relative' }}>
                  <button
                    data-stroke-color-button="true"
                    onClick={() => setShowStrokeColorPicker(!showStrokeColorPicker)}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: (() => {
                        const stroke = textElements.find(el => el.id === selectedId)?.stroke ||
                          curvedTextElements.find(el => el.id === selectedId)?.stroke ||
                          'transparent';
                        return stroke === 'transparent' ? '#f0f0f0' : stroke;
                      })(),
                      backgroundImage: (() => {
                        const stroke = textElements.find(el => el.id === selectedId)?.stroke ||
                          curvedTextElements.find(el => el.id === selectedId)?.stroke ||
                          'transparent';
                        if (stroke === 'transparent') {
                          return 'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc)';
                        }
                        return undefined;
                      })(),
                      backgroundSize: '6px 6px',
                      backgroundPosition: '0 0, 3px 3px',
                      border: '2px solid #ccc',
                      cursor: 'pointer',
                      padding: 0,
                      transition: 'all 0.2s',
                      boxShadow: showStrokeColorPicker ? '0 0 0 2px #0066ff' : 'none'
                    }}
                    title="Stroke Color"
                  />
                  
                  {/* Stroke Color Picker Popup */}
                  {showStrokeColorPicker && (
                    <div
                      data-stroke-color-picker="true"
                      style={{
                      position: 'absolute',
                      top: '36px',
                      right: 0,
                      background: 'white',
                      border: '1px solid #ccc',
                      borderRadius: '6px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                      padding: '8px',
                      display: 'flex',
                      gap: '6px',
                      flexWrap: 'wrap',
                      width: '200px',
                      zIndex: 1001,
                    }}>
                      {/* None/Transparent option */}
                      <button
                        onClick={() => {
                          handleStrokeColorChange('transparent');
                          setShowStrokeColorPicker(false);
                        }}
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: '#f0f0f0',
                          backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc)',
                          backgroundSize: '8px 8px',
                          backgroundPosition: '0 0, 4px 4px',
                          border: (textElements.find(el => el.id === selectedId)?.stroke || curvedTextElements.find(el => el.id === selectedId)?.stroke || 'transparent') === 'transparent' ? '2px solid #0066ff' : '1px solid #ccc',
                          cursor: 'pointer',
                          padding: 0,
                          transition: 'all 0.2s',
                        }}
                        title="No Stroke"
                        onMouseEnter={(e) => {
                          const currentStroke = textElements.find(el => el.id === selectedId)?.stroke || curvedTextElements.find(el => el.id === selectedId)?.stroke || 'transparent';
                          if (currentStroke !== 'transparent') {
                            e.currentTarget.style.transform = 'scale(1.1)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)';
                        }}
                      />
                      
                      {[
                        { name: 'White', hex: '#ffffff' },
                        { name: 'Red', hex: '#c8102e' },
                        { name: 'Blue', hex: '#0057b8' },
                        { name: 'Green', hex: '#009639' },
                        { name: 'Black', hex: '#000000' },
                        { name: 'Purple', hex: '#5f259f' },
                        { name: 'Yellow', hex: '#fff110' },
                        { name: 'Grey', hex: '#a2aaad' },
                        { name: 'Orange', hex: '#ff8200' },
                        { name: 'Ivory', hex: '#f1e6b2' },
                        { name: 'Light Blue', hex: '#71c5e8' },
                        { name: 'Pink', hex: '#f8a3bc' },
                        { name: 'Brown', hex: '#9e652e' }
                      ].map((color) => {
                        const currentStroke = 
                          textElements.find(el => el.id === selectedId)?.stroke ||
                          curvedTextElements.find(el => el.id === selectedId)?.stroke ||
                          'transparent';
                        
                        return (
                          <button
                            key={color.hex}
                            onClick={() => {
                              handleStrokeColorChange(color.hex);
                              setShowStrokeColorPicker(false);
                            }}
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              backgroundColor: color.hex,
                              border: currentStroke === color.hex ? '2px solid #0066ff' : '1px solid #ccc',
                              cursor: 'pointer',
                              padding: 0,
                              transition: 'all 0.2s',
                              boxShadow: color.hex === '#ffffff' ? 'inset 0 0 0 1px #ddd' : 'none'
                            }}
                            title={color.name}
                            onMouseEnter={(e) => {
                              if (currentStroke !== color.hex) {
                                e.currentTarget.style.transform = 'scale(1.1)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'scale(1)';
                            }}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
          
          {/* Curved Text Controls - only show for curved text elements */}
          {curvedTextElements.find(el => el.id === selectedId) && (
            <>
              <div style={{ width: '1px', background: '#e0e0e0', height: '24px', margin: '0 4px' }} />
              
              {/* Curve Slider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '14px' }}>Curve:</span>
                <input
                  type="range"
                  min="50"
                  max="300"
                  value={curvedTextElements.find(el => el.id === selectedId)?.radius || 100}
                  onChange={(e) => handleDiameterChange(parseInt(e.target.value))}
                  style={{ 
                    width: '80px',
                    cursor: 'pointer'
                  }}
                />
                <span style={{ fontSize: '12px', color: '#666', minWidth: '35px' }}>
                  {(curvedTextElements.find(el => el.id === selectedId)?.radius || 100) * 2}
                </span>
              </div>
              
              {/* Flip Button */}
              <button
                onClick={handleFlipText}
                style={{
                  width: '32px',
                  height: '32px',
                  padding: '4px',
                  border: 'none',
                  borderRadius: '4px',
                  background: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e3f2fd'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                title="Flip Text"
              >
                ↕️
              </button>
            </>
          )}
        </div>
      )}
      
      {/* Text Input - positioned with transformer */}
      {floatingToolbarPos && selectedId && (textElements.find(el => el.id === selectedId) || gradientTextElements.find(el => el.id === selectedId) || curvedTextElements.find(el => el.id === selectedId)) && (
        <div
          style={{
            position: 'fixed',
            left: floatingToolbarPos.x,
            top: floatingToolbarPos.y,
            transform: 'translateX(-50%)',
            zIndex: 1001,
          }}
        >
          <input
            type="text"
            value={
              textElements.find(el => el.id === selectedId)?.text ||
              gradientTextElements.find(el => el.id === selectedId)?.text ||
              curvedTextElements.find(el => el.id === selectedId)?.text ||
              ''
            }
            onChange={(e) => {
              const newText = e.target.value;
              // Update text in real-time
              if (textElements.find(el => el.id === selectedId)) {
                setTextElements(prev => 
                  prev.map(el => el.id === selectedId ? { ...el, text: newText } : el)
                );
              } else if (curvedTextElements.find(el => el.id === selectedId)) {
                setCurvedTextElements(prev => 
                  prev.map(el => el.id === selectedId ? { ...el, text: newText } : el)
                );
              } else if (gradientTextElements.find(el => el.id === selectedId)) {
                setGradientTextElements(prev => 
                  prev.map(el => el.id === selectedId ? { ...el, text: newText } : el)
                );
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setSelectedId(null);
              }
            }}
            style={{ 
              padding: '8px 12px', 
              fontSize: '16px', 
              width: '300px',
              border: '2px solid #0066ff',
              borderRadius: '6px',
              outline: 'none',
              background: 'white',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              fontFamily: 'Arial, sans-serif',
              textAlign: 'center'
            }}
            placeholder="Enter text..."
            autoFocus
          />
        </div>
      )}
    </div>
  );
};


export default DesignerCanvas;
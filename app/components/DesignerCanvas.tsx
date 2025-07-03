import React from 'react';
import { Stage, Layer, Text, TextPath, Transformer, Group, Image, Rect, Ellipse, Ring } from 'react-konva';
import useImage from 'use-image';
import { CURATED_FONTS, getFontsByCategory, DEFAULT_FONT } from '../constants/fonts';
import { fontLoader } from '../services/font-loader';
import FontBrowser from './FontBrowser';
import MediaBrowser from './MediaBrowser';

// Declare global window properties
declare global {
  interface Window {
    __SHOP_DOMAIN__?: string;
    __INITIAL_DESIGN__?: any;
    __RETURN_URL__?: string;
    __tempBackgroundGradient?: {
      type: 'linear' | 'radial';
      colorStops: (number | string)[];
    };
  }
}

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

// Define unified element type
type UnifiedCanvasElement = {
  id: string;
  type: 'text' | 'gradientText' | 'curvedText' | 'image' | 'shape';
  zIndex: number;
  data: any; // Will contain the specific element data
};

interface DesignerCanvasProps {
  initialTemplate?: {
    id: string;
    name: string;
    canvasData: string;
    productLayoutId?: string;
    colorVariant?: string;
  } | null;
  productLayout?: {
    id: string;
    name: string;
    width: number;
    height: number;
    baseImageUrl: string;
    attributes: any;
    designableArea: any;
    variantImages?: any;
  } | null;
  shopifyProduct?: {
    id: string;
    title: string;
  } | null;
  shopifyVariant?: {
    id: string;
    title: string;
    displayName: string;
    image?: {
      url: string;
      altText?: string;
    };
    selectedOptions: Array<{
      name: string;
      value: string;
    }>;
  } | null;
  layoutVariant?: {
    id: string;
    variantTitle: string;
    baseImageUrl: string;
    color?: string | null;
    pattern?: string | null;
  } | null;
  initialState?: {
    templateId?: string;
    variantId?: string;
    productId?: string;
    textUpdates?: Record<string, string>;
    fromModal?: boolean;
  } | null;
  onSave?: (canvasData: any, thumbnail: string | undefined) => Promise<void>;
  isAdminView?: boolean;
  templateColors?: Array<{
    chipColor: string;
    color1: string;
    color2: string;
    color3: string;
    color4?: string | null;
    color5?: string | null;
  }>;
  initialColorVariant?: string | null;
  customerId?: string | null;
}

const DesignerCanvas: React.FC<DesignerCanvasProps> = ({ initialTemplate, productLayout, shopifyProduct, shopifyVariant, layoutVariant, initialState, onSave, isAdminView = true, templateColors = [], initialColorVariant, customerId }) => {
  // Debug logging
  console.log('[DesignerCanvas] Received customerId prop:', customerId);
  
  // Helper function to generate unique IDs
  const generateUniqueId = (type: string) => {
    return `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  // Deep copy functions for each element type
  const deepCopyTextElements = (elements: Array<{id: string, text: string, x: number, y: number, fontFamily: string, fontSize?: number, fontWeight?: string, fill?: string, stroke?: string, strokeWidth?: number, rotation?: number, scaleX?: number, scaleY?: number, zIndex?: number}>) => {
    return elements.map(el => ({
      ...el,
      id: generateUniqueId('text')
    }));
  };

  const deepCopyCurvedTextElements = (elements: Array<{id: string, text: string, x: number, topY: number, radius: number, flipped: boolean, fontFamily: string, fontSize?: number, fontWeight?: string, fill?: string, stroke?: string, strokeWidth?: number, rotation?: number, scaleX?: number, scaleY?: number, zIndex?: number}>) => {
    return elements.map(el => ({
      ...el,
      id: generateUniqueId('curved-text')
    }));
  };

  const deepCopyGradientTextElements = (elements: Array<{id: string, text: string, x: number, y: number, fontFamily: string, fontSize?: number, rotation?: number, scaleX?: number, scaleY?: number, zIndex?: number}>) => {
    return elements.map(el => ({
      ...el,
      id: generateUniqueId('gradient-text')
    }));
  };

  const deepCopyImageElements = (elements: Array<{id: string, url: string, x: number, y: number, width: number, height: number, rotation?: number, zIndex?: number}>) => {
    return elements.map(el => ({
      ...el,
      id: generateUniqueId('image')
    }));
  };

  const deepCopyShapeElements = (elements: Array<ShapeElement>) => {
    return elements.map(el => ({
      ...el,
      id: generateUniqueId('shape')
    }));
  };

  const shapeRef = React.useRef(null);
  const stageRef = React.useRef<any>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  // Current side being edited
  const [currentSide, setCurrentSide] = React.useState<'front' | 'back'>('front');
  
  // Same design on both sides toggle
  const [sameDesignBothSides, setSameDesignBothSides] = React.useState(false);
  
  const [dimensions, setDimensions] = React.useState({ 
    width: (shopifyVariant || layoutVariant) ? 1368 : (productLayout?.width || 1000), 
    height: (shopifyVariant || layoutVariant) ? 1368 : (productLayout?.height || 1000)
  });
  const [containerSize, setContainerSize] = React.useState({ width: 800, height: 600 });
  
  // Front side state
  const [frontTextElements, setFrontTextElements] = React.useState<Array<{id: string, text: string, x: number, y: number, fontFamily: string, fontSize?: number, fontWeight?: string, fill?: string, stroke?: string, strokeWidth?: number, rotation?: number, scaleX?: number, scaleY?: number, zIndex?: number}>>([]);
  const [frontGradientTextElements, setFrontGradientTextElements] = React.useState<Array<{id: string, text: string, x: number, y: number, fontFamily: string, fontSize?: number, rotation?: number, scaleX?: number, scaleY?: number, zIndex?: number}>>([]);
  const [frontCurvedTextElements, setFrontCurvedTextElements] = React.useState<Array<{id: string, text: string, x: number, topY: number, radius: number, flipped: boolean, fontFamily: string, fontSize?: number, fontWeight?: string, fill?: string, stroke?: string, strokeWidth?: number, rotation?: number, scaleX?: number, scaleY?: number, zIndex?: number}>>([]);
  const [frontImageElements, setFrontImageElements] = React.useState<Array<{id: string, url: string, x: number, y: number, width: number, height: number, rotation?: number, zIndex?: number}>>([]);
  const [frontBackgroundColor, setFrontBackgroundColor] = React.useState('transparent');
  const [frontBaseImageUrl, setFrontBaseImageUrl] = React.useState<string>('');
  
  // Back side state
  const [backTextElements, setBackTextElements] = React.useState<Array<{id: string, text: string, x: number, y: number, fontFamily: string, fontSize?: number, fontWeight?: string, fill?: string, stroke?: string, strokeWidth?: number, rotation?: number, scaleX?: number, scaleY?: number, zIndex?: number}>>([]);
  const [backGradientTextElements, setBackGradientTextElements] = React.useState<Array<{id: string, text: string, x: number, y: number, fontFamily: string, fontSize?: number, rotation?: number, scaleX?: number, scaleY?: number, zIndex?: number}>>([]);
  const [backCurvedTextElements, setBackCurvedTextElements] = React.useState<Array<{id: string, text: string, x: number, topY: number, radius: number, flipped: boolean, fontFamily: string, fontSize?: number, fontWeight?: string, fill?: string, stroke?: string, strokeWidth?: number, rotation?: number, scaleX?: number, scaleY?: number, zIndex?: number}>>([]);
  const [backImageElements, setBackImageElements] = React.useState<Array<{id: string, url: string, x: number, y: number, width: number, height: number, rotation?: number, zIndex?: number}>>([]);
  const [backBackgroundColor, setBackBackgroundColor] = React.useState('transparent');
  const [backBaseImageUrl, setBackBaseImageUrl] = React.useState<string>('');
  
  // Shape elements state
  type ShapeType = 'ellipse' | 'ring' | 'rect';
  type ShapeElement = {
    id: string;
    type: ShapeType;
    x: number;
    y: number;
    width: number;
    height: number;
    innerRadius?: number; // For ring only
    outerRadius?: number; // For ring only
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    rotation?: number;
    scaleX?: number;
    scaleY?: number;
    zIndex?: number;
  };
  
  const [frontShapeElements, setFrontShapeElements] = React.useState<Array<ShapeElement>>([]);
  const [backShapeElements, setBackShapeElements] = React.useState<Array<ShapeElement>>([]);
  
  // Get current side's state dynamically
  const textElements = currentSide === 'front' ? frontTextElements : backTextElements;
  const setTextElements = currentSide === 'front' ? setFrontTextElements : setBackTextElements;
  const gradientTextElements = currentSide === 'front' ? frontGradientTextElements : backGradientTextElements;
  const setGradientTextElements = currentSide === 'front' ? setFrontGradientTextElements : setBackGradientTextElements;
  const curvedTextElements = currentSide === 'front' ? frontCurvedTextElements : backCurvedTextElements;
  const setCurvedTextElements = currentSide === 'front' ? setFrontCurvedTextElements : setBackCurvedTextElements;
  const imageElements = currentSide === 'front' ? frontImageElements : backImageElements;
  const setImageElements = currentSide === 'front' ? setFrontImageElements : setBackImageElements;
  const backgroundColor = currentSide === 'front' ? frontBackgroundColor : backBackgroundColor;
  const setBackgroundColor = currentSide === 'front' ? setFrontBackgroundColor : setBackBackgroundColor;
  const shapeElements = currentSide === 'front' ? frontShapeElements : backShapeElements;
  const setShapeElements = currentSide === 'front' ? setFrontShapeElements : setBackShapeElements;
  
  // Clipboard for copy/paste
  const [clipboard, setClipboard] = React.useState<{
    type: 'text' | 'gradientText' | 'curvedText' | 'image' | 'shape';
    data: any;
    sourceSide: 'front' | 'back';
  } | null>(null);
  
  // Support for S3 URLs - use variant-specific image if available
  const getVariantImage = (side: 'front' | 'back' = 'front') => {
    // Only use S3 URLs from saved templates or layout variants
    // No fallbacks - if image is missing, let it 404
    
    // Use base image from saved template canvas data
    if (initialTemplate) {
      try {
        // Check for new dual-sided format first
        if (side === 'front' && initialTemplate.frontCanvasData) {
          const frontData = typeof initialTemplate.frontCanvasData === 'string' 
            ? JSON.parse(initialTemplate.frontCanvasData) 
            : initialTemplate.frontCanvasData;
          if (frontData?.assets?.baseImage) {
            return frontData.assets.baseImage;
          }
        } else if (side === 'back' && initialTemplate.backCanvasData) {
          const backData = typeof initialTemplate.backCanvasData === 'string' 
            ? JSON.parse(initialTemplate.backCanvasData) 
            : initialTemplate.backCanvasData;
          if (backData?.assets?.baseImage) {
            return backData.assets.baseImage;
          }
        }
        
        // Fall back to legacy single-sided format for front only
        if (side === 'front' && initialTemplate.canvasData) {
          const canvasData = typeof initialTemplate.canvasData === 'string' 
            ? JSON.parse(initialTemplate.canvasData) 
            : initialTemplate.canvasData;
          if (canvasData?.assets?.baseImage) {
            return canvasData.assets.baseImage;
          }
        }
      } catch (e) {
        console.warn('Failed to parse canvas data for base image:', e);
      }
    }
    
    // Use layout variant S3 image with support for different front/back images
    if (layoutVariant) {
      if (side === 'front') {
        // Use explicit front image if available, otherwise fall back to baseImageUrl
        return layoutVariant.frontBaseImageUrl || layoutVariant.baseImageUrl || '';
      } else if (side === 'back') {
        // Use explicit back image if available, otherwise fall back to baseImageUrl
        return layoutVariant.backBaseImageUrl || layoutVariant.baseImageUrl || '';
      }
    }
    
    // Return empty string to trigger 404 if no S3 image found
    return '';
  };
  
  // Initialize base image URLs
  React.useEffect(() => {
    setFrontBaseImageUrl(getVariantImage('front'));
    setBackBaseImageUrl(getVariantImage('back'));
  }, [initialTemplate, layoutVariant]);
  
  // Load base images for both sides
  const baseImageUrl = currentSide === 'front' ? frontBaseImageUrl : backBaseImageUrl;
  const [baseImage] = useImage(baseImageUrl, baseImageUrl.startsWith('http') ? 'anonymous' : undefined);
  
  // Log base image dimensions when loaded
  React.useEffect(() => {
    if (baseImage) {
      console.log(`Base image loaded for ${currentSide} side with dimensions:`, {
        naturalWidth: baseImage.width,
        naturalHeight: baseImage.height,
        url: baseImageUrl
      });
    }
  }, [baseImage, baseImageUrl, currentSide]);
  const [designableArea, setDesignableArea] = React.useState(() => {
    // Use designableArea from productLayout if available
    if (productLayout?.designableArea) {
      const area = productLayout.designableArea;
      if (area.shape === 'circle') {
        return {
          width: area.diameter,
          height: area.diameter,
          cornerRadius: area.diameter / 2,
          x: area.x,
          y: area.y,
          visible: true
        };
      } else {
        // Rectangle or other shapes
        return {
          width: area.width,
          height: area.height,
          cornerRadius: area.cornerRadius || 0,
          x: area.x,
          y: area.y,
          visible: true
        };
      }
    }
    
    // Default fallback
    const canvasWidth = shopifyVariant || layoutVariant ? 1200 : (productLayout?.width || 1000);
    const canvasHeight = shopifyVariant || layoutVariant ? 1200 : (productLayout?.height || 1000);
    const diameter = 894; // Fixed size for design area
    const radius = diameter / 2;
    
    return {
      width: diameter,
      height: diameter,
      cornerRadius: 447, // Half of 894px for perfect circle
      x: canvasWidth / 2 - radius,
      y: canvasHeight / 2 - radius,
      visible: true
    };
  });
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [templates, setTemplates] = React.useState<Array<{id: string, name: string}>>([]);
  const [notification, setNotification] = React.useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [floatingToolbarPos, setFloatingToolbarPos] = React.useState<{ x: number; y: number } | null>(null);
  const transformerRef = React.useRef<any>(null);
  const [showColorPicker, setShowColorPicker] = React.useState(false);
  const [showBackgroundColorPicker, setShowBackgroundColorPicker] = React.useState(false);
  const [showDesignAreaControls, setShowDesignAreaControls] = React.useState(false);
  const [showStrokeColorPicker, setShowStrokeColorPicker] = React.useState(false);
  
  // Design Color state
  const [selectedDesignColor, setSelectedDesignColor] = React.useState<string | null>(initialColorVariant || null);
  const [showDesignColorPicker, setShowDesignColorPicker] = React.useState(false);

  // Font Management - Using curated fonts from S3
  const [showFontPicker, setShowFontPicker] = React.useState(false);
  const [showFontBrowser, setShowFontBrowser] = React.useState(false);
  
  // Media Browser state
  const [showMediaBrowser, setShowMediaBrowser] = React.useState(false);
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  
  // Text Panel state
  const [showTextPanel, setShowTextPanel] = React.useState(true);
  const [editingTextId, setEditingTextId] = React.useState<string | null>(null);
  
  // Priority fonts for immediate loading
  const priorityFontIds = ['arial', 'roboto', 'open-sans', 'montserrat', 'playfair-display'];

  const loadFont = async (fontFamily: string) => {
    try {
      await fontLoader.loadFontByFamily(fontFamily);
    } catch (error) {
      console.warn(`Failed to load font: ${fontFamily}`, error);
    }
  };

  // Handle image selection from MediaBrowser
  const handleImageSelection = (imageUrl: string) => {
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
      const maxZIndex = Math.max(...unifiedElements.map(el => el.zIndex), -1) + 1;
      const newImage = {
        id: `image-${Date.now()}`,
        url: imageUrl,
        x: designableArea.x + designableArea.width / 2 - width / 2, // Center horizontally
        y: designableArea.y + designableArea.height / 2 - height / 2, // Center vertically
        width: width,
        height: height,
        rotation: 0,
        zIndex: maxZIndex
      };
      setImageElements(prev => [...prev, newImage]);
    };
    img.onerror = () => {
      console.error('Failed to load image for dimensions');
      // Fallback to square if image fails to load
      const maxZIndex = Math.max(...unifiedElements.map(el => el.zIndex), -1) + 1;
      const newImage = {
        id: `image-${Date.now()}`,
        url: imageUrl,
        x: designableArea.x + designableArea.width / 2 - 50,
        y: designableArea.y + designableArea.height / 2 - 50,
        width: 100,
        height: 100,
        rotation: 0,
        zIndex: maxZIndex
      };
      setImageElements(prev => [...prev, newImage]);
    };
    img.src = imageUrl;
  };
  
  // Preload priority fonts on mount
  React.useEffect(() => {
    const loadPriorityFonts = async () => {
      await fontLoader.preloadFonts(priorityFontIds);
    };
    loadPriorityFonts();
  }, []);

  // Initialize session ID for anonymous users
  React.useEffect(() => {
    // Get or create session ID
    let existingSessionId = localStorage.getItem('mediaBrowserSessionId');
    if (!existingSessionId) {
      existingSessionId = crypto.randomUUID();
      localStorage.setItem('mediaBrowserSessionId', existingSessionId);
    }
    setSessionId(existingSessionId);
  }, []);

  // Calculate scale factor for responsive canvas with padding
  const padding = 20; // Add some padding around the canvas
  const scale = Math.min(
    (containerSize.width - padding * 2) / dimensions.width,
    (containerSize.height - padding * 2) / dimensions.height,
    1 // Maximum scale of 1 to prevent canvas from becoming larger than actual size
  );

  React.useEffect(() => {
    // Fixed canvas size - 1200x1200 for Shopify variants and layout variants, 1000x1000 for others
    const newDimensions = (shopifyVariant || layoutVariant) ? {
      width: 1200,
      height: 1200
    } : {
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
  }, [shopifyVariant, layoutVariant]);

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

  // Update transformer when curved text changes
  React.useEffect(() => {
    if (selectedId && transformerRef.current) {
      const curvedEl = curvedTextElements.find(el => el.id === selectedId);
      if (curvedEl) {
        // Force transformer to update for curved text changes
        setTimeout(() => {
          const stage = transformerRef.current?.getStage();
          const selectedNode = stage?.findOne('#' + selectedId);
          if (selectedNode) {
            transformerRef.current.nodes([selectedNode]);
            transformerRef.current.forceUpdate();
            transformerRef.current.getLayer()?.batchDraw();
            updateToolbarPosition();
          }
        }, 50);
      }
    }
  }, [curvedTextElements, selectedId]);

  // Sync front to back when enabling same design mode
  React.useEffect(() => {
    if (sameDesignBothSides) {
      // Copy all front elements to back with new unique IDs
      setBackTextElements(deepCopyTextElements(frontTextElements));
      setBackGradientTextElements(deepCopyGradientTextElements(frontGradientTextElements));
      setBackCurvedTextElements(deepCopyCurvedTextElements(frontCurvedTextElements));
      setBackImageElements(deepCopyImageElements(frontImageElements));
      setBackShapeElements(deepCopyShapeElements(frontShapeElements));
      setBackBackgroundColor(frontBackgroundColor);
      
      // Force current side to front
      setCurrentSide('front');
      
      // Show notification
      setNotification({
        message: 'Front design copied to back side',
        type: 'success'
      });
      setTimeout(() => setNotification(null), 3000);
    }
  }, [sameDesignBothSides]);

  // Auto-sync front to back when same design mode is on
  React.useEffect(() => {
    if (sameDesignBothSides && currentSide === 'front') {
      setBackTextElements(deepCopyTextElements(frontTextElements));
      setBackGradientTextElements(deepCopyGradientTextElements(frontGradientTextElements));
      setBackCurvedTextElements(deepCopyCurvedTextElements(frontCurvedTextElements));
      setBackImageElements(deepCopyImageElements(frontImageElements));
      setBackShapeElements(deepCopyShapeElements(frontShapeElements));
      setBackBackgroundColor(frontBackgroundColor);
    }
  }, [
    sameDesignBothSides,
    frontTextElements,
    frontGradientTextElements,
    frontCurvedTextElements,
    frontImageElements,
    frontShapeElements,
    frontBackgroundColor
  ]);

  // Create unified array of all elements with their types and z-indexes
  const unifiedElements = React.useMemo(() => {
    const elements: UnifiedCanvasElement[] = [];
    let currentZIndex = 0;
    
    // Add all element types with zIndex
    imageElements.forEach((img) => {
      elements.push({
        id: img.id,
        type: 'image',
        zIndex: img.zIndex ?? currentZIndex++,
        data: img
      });
    });
    
    textElements.forEach((text) => {
      elements.push({
        id: text.id,
        type: 'text',
        zIndex: text.zIndex ?? currentZIndex++,
        data: text
      });
    });
    
    gradientTextElements.forEach((gradient) => {
      elements.push({
        id: gradient.id,
        type: 'gradientText',
        zIndex: gradient.zIndex ?? currentZIndex++,
        data: gradient
      });
    });
    
    curvedTextElements.forEach((curved) => {
      elements.push({
        id: curved.id,
        type: 'curvedText',
        zIndex: curved.zIndex ?? currentZIndex++,
        data: curved
      });
    });
    
    shapeElements.forEach((shape) => {
      elements.push({
        id: shape.id,
        type: 'shape',
        zIndex: shape.zIndex ?? currentZIndex++,
        data: shape
      });
    });
    
    const sorted = elements.sort((a, b) => a.zIndex - b.zIndex);
    console.log('Unified elements sorted by zIndex:', sorted.map(el => ({
      type: el.type,
      zIndex: el.zIndex,
      text: el.type === 'image' || el.type === 'shape' ? el.type : el.data.text
    })));
    return sorted;
  }, [textElements, gradientTextElements, curvedTextElements, imageElements, shapeElements]);


  // Helper function to update element zIndex
  const updateElementZIndex = (elementId: string, newZIndex: number) => {
    setTextElements(prev => 
      prev.map(el => el.id === elementId ? { ...el, zIndex: newZIndex } : el)
    );
    setGradientTextElements(prev => 
      prev.map(el => el.id === elementId ? { ...el, zIndex: newZIndex } : el)
    );
    setCurvedTextElements(prev => 
      prev.map(el => el.id === elementId ? { ...el, zIndex: newZIndex } : el)
    );
    setImageElements(prev => 
      prev.map(el => el.id === elementId ? { ...el, zIndex: newZIndex } : el)
    );
    setShapeElements(prev => 
      prev.map(el => el.id === elementId ? { ...el, zIndex: newZIndex } : el)
    );
  };

  // Helper function to swap zIndexes
  const swapZIndexes = (id1: string, id2: string) => {
    const el1 = unifiedElements.find(el => el.id === id1);
    const el2 = unifiedElements.find(el => el.id === id2);
    
    if (el1 && el2) {
      const tempZIndex = el1.zIndex;
      updateElementZIndex(id1, el2.zIndex);
      updateElementZIndex(id2, tempZIndex);
    }
  };

  // Layer control functions
  const moveLayerUp = () => {
    if (!selectedId) return;
    
    const element = unifiedElements.find(el => el.id === selectedId);
    if (!element) return;
    
    // Find the element with the next higher zIndex
    const nextElement = unifiedElements
      .filter(el => el.zIndex > element.zIndex)
      .sort((a, b) => a.zIndex - b.zIndex)[0];
    
    if (nextElement) {
      swapZIndexes(selectedId, nextElement.id);
    }
  };

  const moveLayerDown = () => {
    if (!selectedId) return;
    
    const element = unifiedElements.find(el => el.id === selectedId);
    if (!element) return;
    
    // Find the element with the next lower zIndex
    const prevElement = unifiedElements
      .filter(el => el.zIndex < element.zIndex)
      .sort((a, b) => b.zIndex - a.zIndex)[0];
    
    if (prevElement) {
      swapZIndexes(selectedId, prevElement.id);
    }
  };

  const moveToFront = () => {
    if (!selectedId) return;
    const maxZIndex = Math.max(...unifiedElements.map(el => el.zIndex), -1);
    updateElementZIndex(selectedId, maxZIndex + 1);
  };

  const moveToBack = () => {
    if (!selectedId) return;
    const minZIndex = Math.min(...unifiedElements.map(el => el.zIndex), 1);
    updateElementZIndex(selectedId, minZIndex - 1);
  };

  const addText = () => {
    const maxZIndex = Math.max(...unifiedElements.map(el => el.zIndex), -1) + 1;
    const newText = {
      id: `text-${Date.now()}`,
      text: 'Hello World',
      x: designableArea.x + designableArea.width / 2 - 50, // Center of designable area
      y: designableArea.y + designableArea.height / 2 - 12, // Center vertically (minus half font size)
      fontFamily: DEFAULT_FONT.family,
      fontSize: 24,
      fill: 'black',
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      zIndex: maxZIndex
    };
    setTextElements(prev => [...prev, newText]);
  };

  const addCurvedText = () => {
    const maxZIndex = Math.max(...unifiedElements.map(el => el.zIndex), -1) + 1;
    const radius = 100;
    const topY = dimensions.height / 2 - radius;
    const newCurvedText = {
      id: `curved-text-${Date.now()}`,
      text: 'Some Text along a circle radius very big',
      x: dimensions.width / 2,
      topY: topY,
      radius: radius,
      flipped: false,
      fontFamily: DEFAULT_FONT.family,
      fontSize: 20,
      fill: 'black',
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      zIndex: maxZIndex
    };
    setCurvedTextElements(prev => [...prev, newCurvedText]);
  };

  const addEllipse = () => {
    const maxZIndex = Math.max(...unifiedElements.map(el => el.zIndex), -1) + 1;
    const newEllipse: ShapeElement = {
      id: `ellipse-${Date.now()}`,
      type: 'ellipse',
      x: designableArea.x + designableArea.width / 2 - 200, // Center of designable area
      y: designableArea.y + designableArea.height / 2 - 200,
      width: 400,
      height: 400,
      fill: '#ffffff',
      stroke: '#000000',
      strokeWidth: 2,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      zIndex: maxZIndex
    };
    setShapeElements(prev => [...prev, newEllipse]);
  };

  const addRing = () => {
    const maxZIndex = Math.max(...unifiedElements.map(el => el.zIndex), -1) + 1;
    const newRing: ShapeElement = {
      id: `ring-${Date.now()}`,
      type: 'ring',
      x: designableArea.x + designableArea.width / 2 - 200, // Center of designable area
      y: designableArea.y + designableArea.height / 2 - 200,
      width: 400,
      height: 400,
      innerRadius: 100,
      outerRadius: 200,
      fill: '#ffffff',
      stroke: '#000000',
      strokeWidth: 2,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      zIndex: maxZIndex
    };
    setShapeElements(prev => [...prev, newRing]);
  };

  const addRectangle = () => {
    const maxZIndex = Math.max(...unifiedElements.map(el => el.zIndex), -1) + 1;
    const newRect: ShapeElement = {
      id: `rect-${Date.now()}`,
      type: 'rect',
      x: designableArea.x + designableArea.width / 2 - 200, // Center of designable area
      y: designableArea.y + designableArea.height / 2 - 200,
      width: 400,
      height: 400,
      fill: '#ffffff',
      stroke: '#000000',
      strokeWidth: 2,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      zIndex: maxZIndex
    };
    setShapeElements(prev => [...prev, newRect]);
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
    
    // Get the highest zIndex for new element
    const maxZIndex = Math.max(...unifiedElements.map(el => el.zIndex), -1) + 1;
    
    // Find the element to duplicate
    const textEl = textElements.find(el => el.id === selectedId);
    if (textEl) {
      const newEl = {
        ...textEl,
        id: `text-${Date.now()}`,
        x: textEl.x + 20,
        y: textEl.y + 20,
        zIndex: maxZIndex
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
        topY: curvedEl.topY + 20,
        zIndex: maxZIndex
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
        y: gradientEl.y + 20,
        zIndex: maxZIndex
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
        y: imgEl.y + 20,
        zIndex: maxZIndex
      };
      setImageElements(prev => [...prev, newEl]);
      setSelectedId(newEl.id);
      return;
    }
    
    const shapeEl = shapeElements.find(el => el.id === selectedId);
    if (shapeEl) {
      const newEl = {
        ...shapeEl,
        id: `${shapeEl.type}-${Date.now()}`,
        x: shapeEl.x + 20,
        y: shapeEl.y + 20,
        zIndex: maxZIndex
      };
      setShapeElements(prev => [...prev, newEl]);
      setSelectedId(newEl.id);
    }
  };
  
  // Helper function to get element type
  const getElementType = (elementId: string): 'text' | 'gradientText' | 'curvedText' | 'image' | 'shape' | null => {
    if (textElements.find(el => el.id === elementId)) return 'text';
    if (gradientTextElements.find(el => el.id === elementId)) return 'gradientText';
    if (curvedTextElements.find(el => el.id === elementId)) return 'curvedText';
    if (imageElements.find(el => el.id === elementId)) return 'image';
    if (shapeElements.find(el => el.id === elementId)) return 'shape';
    return null;
  };
  
  // Copy element to clipboard
  const copyElement = (elementId: string) => {
    const elementType = getElementType(elementId);
    if (!elementType) return;
    
    let element;
    switch (elementType) {
      case 'text':
        element = textElements.find(el => el.id === elementId);
        break;
      case 'gradientText':
        element = gradientTextElements.find(el => el.id === elementId);
        break;
      case 'curvedText':
        element = curvedTextElements.find(el => el.id === elementId);
        break;
      case 'image':
        element = imageElements.find(el => el.id === elementId);
        break;
      case 'shape':
        element = shapeElements.find(el => el.id === elementId);
        break;
    }
    
    if (element) {
      setClipboard({
        type: elementType,
        data: { ...element },
        sourceSide: currentSide
      });
      
      setNotification({
        type: 'info',
        message: 'Element copied to clipboard'
      });
      
      // Auto-hide notification after 3 seconds
      setTimeout(() => setNotification(null), 3000);
    }
  };
  
  // Paste element from clipboard
  const pasteElement = () => {
    if (!clipboard) return;
    
    // Get the highest zIndex for new element
    const maxZIndex = Math.max(...unifiedElements.map(el => el.zIndex), -1) + 1;
    
    // Generate new ID for pasted element
    const timestamp = Date.now();
    const newId = `${clipboard.type}-${timestamp}`;
    
    // Create pasted element with offset position
    const pastedElement = {
      ...clipboard.data,
      id: newId,
      zIndex: maxZIndex
    };
    
    // Offset position differently for cross-side paste
    const offset = clipboard.sourceSide !== currentSide ? 40 : 20;
    
    switch (clipboard.type) {
      case 'text':
      case 'gradientText':
        pastedElement.x = clipboard.data.x + offset;
        pastedElement.y = clipboard.data.y + offset;
        break;
      case 'curvedText':
        pastedElement.x = clipboard.data.x + offset;
        pastedElement.topY = clipboard.data.topY + offset;
        break;
      case 'image':
        pastedElement.x = clipboard.data.x + offset;
        pastedElement.y = clipboard.data.y + offset;
        break;
      case 'shape':
        pastedElement.x = clipboard.data.x + offset;
        pastedElement.y = clipboard.data.y + offset;
        break;
    }
    
    // Add to current side
    switch (clipboard.type) {
      case 'text':
        setTextElements(prev => [...prev, pastedElement]);
        break;
      case 'gradientText':
        setGradientTextElements(prev => [...prev, pastedElement]);
        break;
      case 'curvedText':
        setCurvedTextElements(prev => [...prev, pastedElement]);
        break;
      case 'image':
        setImageElements(prev => [...prev, pastedElement]);
        break;
      case 'shape':
        setShapeElements(prev => [...prev, pastedElement]);
        break;
    }
    
    // Select the new element
    setSelectedId(newId);
    
    // Show feedback
    const crossSide = clipboard.sourceSide !== currentSide;
    setNotification({
      type: 'success',
      message: crossSide 
        ? `Element pasted from ${clipboard.sourceSide} to ${currentSide}`
        : 'Element pasted'
    });
    
    // Auto-hide notification after 3 seconds
    setTimeout(() => setNotification(null), 3000);
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
    
    // Wait for fonts to be ready
    await document.fonts.ready;
    
    // Force re-render and update transformer bounds after font loads
    setTimeout(() => {
      if (stageRef.current) {
        // Clear cache to force font reload
        stageRef.current.clear();
        
        // Force all layers to redraw
        stageRef.current.getLayers().forEach((layer: any) => {
          layer.clear();
          layer.batchDraw();
        });
      }
      
      if (transformerRef.current) {
        const stage = transformerRef.current.getStage();
        const selectedNode = stage?.findOne('#' + selectedId);
        if (selectedNode) {
          // Force transformer to recalculate bounds for new font metrics
          transformerRef.current.nodes([selectedNode]);
          transformerRef.current.forceUpdate();
        }
      }
    }, 100); // Shorter delay since we're waiting for fonts.ready
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
    // Helper function to get background gradient for a side
    const getBackgroundGradient = (bgColor: string) => {
      let backgroundGradient = undefined;
      if (bgColor === 'linear-gradient') {
        backgroundGradient = {
          type: 'linear',
          colorStops: (window as any).__tempBackgroundGradient?.type === 'linear' 
            ? (window as any).__tempBackgroundGradient.colorStops 
            : [0, '#c8102e', 1, '#ffaaaa']
        };
      } else if (bgColor === 'radial-gradient') {
        backgroundGradient = {
          type: 'radial',
          colorStops: (window as any).__tempBackgroundGradient?.type === 'radial'
            ? (window as any).__tempBackgroundGradient.colorStops
            : [0, '#c8102e', 1, '#ffaaaa']
        };
      }
      return backgroundGradient;
    };
    
    // Ensure all elements have z-indexes before saving
    let nextZIndex = 0;
    const ensureZIndex = (elements: any[]) => {
      return elements.map(el => {
        if (el.zIndex === undefined || el.zIndex === null) {
          return { ...el, zIndex: nextZIndex++ };
        }
        nextZIndex = Math.max(nextZIndex, el.zIndex + 1);
        return el;
      });
    };
    
    // Create state for both sides
    const frontState = {
      dimensions,
      backgroundColor: frontBackgroundColor,
      backgroundGradient: getBackgroundGradient(frontBackgroundColor),
      designableArea,
      elements: {
        textElements: ensureZIndex(frontTextElements),
        curvedTextElements: ensureZIndex(frontCurvedTextElements),
        gradientTextElements: ensureZIndex(frontGradientTextElements),
        imageElements: ensureZIndex(frontImageElements),
        shapeElements: ensureZIndex(frontShapeElements)
      },
      assets: {
        baseImage: frontBaseImageUrl,
      }
    };
    
    // For back state, use front elements if same design mode is on
    const backState = sameDesignBothSides ? {
      dimensions,
      backgroundColor: frontBackgroundColor,
      backgroundGradient: getBackgroundGradient(frontBackgroundColor),
      designableArea,
      elements: {
        textElements: ensureZIndex(frontTextElements),
        curvedTextElements: ensureZIndex(frontCurvedTextElements),
        gradientTextElements: ensureZIndex(frontGradientTextElements),
        imageElements: ensureZIndex(frontImageElements),
        shapeElements: ensureZIndex(frontShapeElements)
      },
      assets: {
        baseImage: backBaseImageUrl, // Keep separate base image
      }
    } : {
      dimensions,
      backgroundColor: backBackgroundColor,
      backgroundGradient: getBackgroundGradient(backBackgroundColor),
      designableArea,
      elements: {
        textElements: ensureZIndex(backTextElements),
        curvedTextElements: ensureZIndex(backCurvedTextElements),
        gradientTextElements: ensureZIndex(backGradientTextElements),
        imageElements: ensureZIndex(backImageElements),
        shapeElements: ensureZIndex(backShapeElements)
      },
      assets: {
        baseImage: backBaseImageUrl,
      }
    };
    
    // Return dual-sided format
    return {
      front: frontState,
      back: backState,
      sameDesignBothSides, // Include toggle state in saved data
      // Include legacy format for backward compatibility (current side's state)
      dimensions,
      backgroundColor,
      backgroundGradient: getBackgroundGradient(backgroundColor),
      designableArea,
      elements: {
        textElements: ensureZIndex(textElements),
        curvedTextElements: ensureZIndex(curvedTextElements),
        gradientTextElements: ensureZIndex(gradientTextElements),
        imageElements: ensureZIndex(imageElements),
        shapeElements: ensureZIndex(shapeElements)
      },
      assets: {
        baseImage: baseImageUrl,
      }
    };
  };

  const loadCanvasState = async (state: any) => {
    if (!state) return;
    
    // Load toggle state if present
    if (state.sameDesignBothSides !== undefined) {
      setSameDesignBothSides(state.sameDesignBothSides);
    }
    
    // Helper function to apply state to a specific side
    const applySideState = async (sideState: any, side: 'front' | 'back') => {
      if (!sideState) return;
      
      // Load dimensions and designable area (shared between sides)
      if (sideState.dimensions) setDimensions(sideState.dimensions);
      if (sideState.designableArea) setDesignableArea(sideState.designableArea);
      
      // Load side-specific properties
      if (side === 'front') {
        if (sideState.backgroundColor) setFrontBackgroundColor(sideState.backgroundColor);
        if (sideState.backgroundGradient) {
          (window as any).__tempBackgroundGradient = sideState.backgroundGradient;
        }
        if (sideState.elements) {
          if (sideState.elements.textElements) setFrontTextElements(sideState.elements.textElements);
          if (sideState.elements.curvedTextElements) setFrontCurvedTextElements(sideState.elements.curvedTextElements);
          if (sideState.elements.gradientTextElements) setFrontGradientTextElements(sideState.elements.gradientTextElements);
          if (sideState.elements.imageElements) setFrontImageElements(sideState.elements.imageElements);
          if (sideState.elements.shapeElements) setFrontShapeElements(sideState.elements.shapeElements);
        }
        if (sideState.assets?.baseImage) setFrontBaseImageUrl(sideState.assets.baseImage);
      } else {
        if (sideState.backgroundColor) setBackBackgroundColor(sideState.backgroundColor);
        if (sideState.backgroundGradient && currentSide === 'back') {
          (window as any).__tempBackgroundGradient = sideState.backgroundGradient;
        }
        if (sideState.elements) {
          // If sameDesignBothSides is true, create unique IDs for back elements
          if (state.sameDesignBothSides) {
            if (sideState.elements.textElements) setBackTextElements(deepCopyTextElements(sideState.elements.textElements));
            if (sideState.elements.curvedTextElements) setBackCurvedTextElements(deepCopyCurvedTextElements(sideState.elements.curvedTextElements));
            if (sideState.elements.gradientTextElements) setBackGradientTextElements(deepCopyGradientTextElements(sideState.elements.gradientTextElements));
            if (sideState.elements.imageElements) setBackImageElements(deepCopyImageElements(sideState.elements.imageElements));
            if (sideState.elements.shapeElements) setBackShapeElements(deepCopyShapeElements(sideState.elements.shapeElements));
          } else {
            if (sideState.elements.textElements) setBackTextElements(sideState.elements.textElements);
            if (sideState.elements.curvedTextElements) setBackCurvedTextElements(sideState.elements.curvedTextElements);
            if (sideState.elements.gradientTextElements) setBackGradientTextElements(sideState.elements.gradientTextElements);
            if (sideState.elements.imageElements) setBackImageElements(sideState.elements.imageElements);
            if (sideState.elements.shapeElements) setBackShapeElements(sideState.elements.shapeElements);
          }
        }
        if (sideState.assets?.baseImage) setBackBaseImageUrl(sideState.assets.baseImage);
      }
      
      // Load fonts for this side
      const fontsToLoad = new Set<string>();
      sideState.elements?.textElements?.forEach((el: any) => {
        if (el.fontFamily) fontsToLoad.add(el.fontFamily);
      });
      sideState.elements?.curvedTextElements?.forEach((el: any) => {
        if (el.fontFamily) fontsToLoad.add(el.fontFamily);
      });
      sideState.elements?.gradientTextElements?.forEach((el: any) => {
        if (el.fontFamily) fontsToLoad.add(el.fontFamily);
      });
      
      const fontLoadPromises = Array.from(fontsToLoad).map(fontFamily => loadFont(fontFamily));
      await Promise.all(fontLoadPromises);
    };
    
    // Check if it's the new dual-sided format
    if (state.front || state.back) {
      // Load both sides
      if (state.front) {
        await applySideState(state.front, 'front');
      }
      if (state.back) {
        await applySideState(state.back, 'back');
      }
    } else {
      // Legacy single-sided format - load into front side only
      await applySideState(state, 'front');
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

  // Apply Design Color transformation
  const applyDesignColor = (newDesignColor: string) => {
    if (!templateColors || templateColors.length === 0) return;
    if (!newDesignColor) return;
    if (selectedDesignColor === newDesignColor) return; // No change needed
    
    // Use the current selected design color as source, or initial if not set
    const currentColor = selectedDesignColor || initialColorVariant;
    if (!currentColor) return;
    
    // Find the source and target color mappings
    const sourceColors = templateColors.find(tc => tc.chipColor === currentColor);
    const targetColors = templateColors.find(tc => tc.chipColor === newDesignColor);
    
    if (!sourceColors || !targetColors) return;
    
    // Helper function to replace color by position
    const replaceColor = (color: string | undefined): string | undefined => {
      if (!color || color === 'gold-gradient') return color; // Don't change gold gradient
      
      const normalizedColor = color.toLowerCase();
      
      // Check each color position
      if (normalizedColor === sourceColors.color1.toLowerCase()) return targetColors.color1;
      if (normalizedColor === sourceColors.color2.toLowerCase()) return targetColors.color2;
      if (normalizedColor === sourceColors.color3.toLowerCase()) return targetColors.color3;
      if (sourceColors.color4 && normalizedColor === sourceColors.color4.toLowerCase()) return targetColors.color4 || color;
      if (sourceColors.color5 && normalizedColor === sourceColors.color5.toLowerCase()) return targetColors.color5 || color;
      
      return color; // Return unchanged if no match
    };
    
    // Transform text elements
    setTextElements(prev => 
      prev.map(el => ({
        ...el,
        fill: replaceColor(el.fill),
        stroke: replaceColor(el.stroke)
      }))
    );
    
    // Transform curved text elements
    setCurvedTextElements(prev => 
      prev.map(el => ({
        ...el,
        fill: replaceColor(el.fill),
        stroke: replaceColor(el.stroke)
      }))
    );
    
    // Transform background color
    if (backgroundColor !== 'transparent' && backgroundColor !== 'linear-gradient' && backgroundColor !== 'radial-gradient') {
      const newBgColor = replaceColor(backgroundColor);
      if (newBgColor && newBgColor !== backgroundColor) {
        setBackgroundColor(newBgColor);
      }
    }
    
    // Transform background gradient color stops
    if ((backgroundColor === 'linear-gradient' || backgroundColor === 'radial-gradient') && window.__tempBackgroundGradient) {
      const gradient = window.__tempBackgroundGradient;
      if (gradient.colorStops) {
        const newColorStops = [...gradient.colorStops];
        // Process color stops (they alternate between position and color)
        for (let i = 1; i < newColorStops.length; i += 2) {
          const newColor = replaceColor(newColorStops[i] as string);
          if (newColor) {
            newColorStops[i] = newColor;
          }
        }
        window.__tempBackgroundGradient = {
          ...gradient,
          colorStops: newColorStops
        };
      }
    }
    
    setSelectedDesignColor(newDesignColor);
  };

  // Save customer design as draft
  const saveCustomerDesign = async () => {
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
              setTimeout(() => resolve(true), 500);
              return;
            }
            
            if (img.complete) {
              resolve(true);
            } else {
              const onLoad = () => {
                img.removeEventListener('load', onLoad);
                img.removeEventListener('error', onError);
                resolve(true);
              };
              const onError = () => {
                console.warn('Image failed to load for thumbnail:', img.src);
                img.removeEventListener('load', onLoad);
                img.removeEventListener('error', onError);
                resolve(true);
              };
              
              img.addEventListener('load', onLoad);
              img.addEventListener('error', onError);
              
              setTimeout(() => {
                img.removeEventListener('load', onLoad);
                img.removeEventListener('error', onError);
                resolve(true);
              }, 5000);
            }
          });
        });
        
        await Promise.all(imageLoadPromises);
        stage.batchDraw();
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Generate thumbnail
      let thumbnail: string | undefined;
      try {
        thumbnail = stageRef.current?.toDataURL({ 
          x: 0,
          y: 0,
          width: dimensions.width * scale,
          height: dimensions.height * scale,
          pixelRatio: 1 / scale,
          mimeType: 'image/png'
        });
      } catch (thumbnailError) {
        console.error('Error generating thumbnail:', thumbnailError);
        try {
          thumbnail = stageRef.current?.toDataURL({ 
            x: 0,
            y: 0,
            width: dimensions.width * scale,
            height: dimensions.height * scale,
            pixelRatio: 0.6 / scale,
            mimeType: 'image/png'
          });
        } catch (fallbackError) {
          console.error('Fallback thumbnail generation also failed:', fallbackError);
        }
      }
      
      // Check if we have a shop context (authenticated) or need to use localStorage
      const shop = window.__SHOP_DOMAIN__ || null;
      
      if (shop && initialTemplate?.id && initialState?.variantId && initialState?.productId) {
        // Save to database as CustomerDesign draft
        const formData = new FormData();
        formData.append('templateId', initialTemplate.id);
        formData.append('variantId', initialState.variantId);
        formData.append('productId', initialState.productId || '');
        formData.append('canvasState', JSON.stringify(canvasState));
        if (thumbnail) {
          formData.append('thumbnail', thumbnail);
        }
        
        const response = await fetch('/api/designs/draft', {
          method: 'POST',
          body: formData,
        });
        
        const result = await response.json();
        
        if (result.success) {
          setNotification({ 
            message: 'Design saved successfully!', 
            type: 'success' 
          });
          
          // Store design ID for future updates
          if (window.__INITIAL_DESIGN__) {
            window.__INITIAL_DESIGN__.id = result.design.id;
          }
          
          // Send message to parent window if in iframe or opened window
          if (window.opener || window.parent !== window) {
            const targetWindow = window.opener || window.parent;
            
            // Debug logging
            console.log('[DesignerCanvas] Sending design-saved message');
            console.log('[DesignerCanvas] Canvas state:', canvasState);
            console.log('[DesignerCanvas] Template colors prop:', templateColors);
            console.log('[DesignerCanvas] Template colors length:', templateColors?.length);
            console.log('[DesignerCanvas] Initial template:', initialTemplate);
            console.log('[DesignerCanvas] Message being sent:', {
              type: 'design-saved',
              hasCanvasState: !!canvasState,
              hasTemplateColors: !!templateColors && templateColors.length > 0,
              templateColorsLength: templateColors?.length || 0
            });
            
            targetWindow.postMessage({
              type: 'design-saved',
              designId: result.design.id,
              thumbnail: result.design.thumbnail || thumbnail,
              templateId: initialTemplate.id,
              variantId: initialState.variantId,
              productId: initialState.productId,
              canvasState: canvasState,
              templateColors: templateColors
            }, '*');
            
            // Show return message
            setNotification({ 
              message: 'Design saved! Returning to product...', 
              type: 'success' 
            });
            
            // Auto-close after delay if opened in new window
            if (window.opener) {
              setTimeout(() => {
                window.close();
              }, 2000);
            }
          }
        } else {
          throw new Error(result.error || 'Failed to save design');
        }
      } else {
        // Save to localStorage for non-authenticated users
        const designId = `local-${Date.now()}`;
        const designData = {
          id: designId,
          templateId: initialTemplate?.id,
          variantId: initialState?.variantId,
          productId: initialState?.productId,
          canvasState: canvasState,
          thumbnail: thumbnail,
          savedAt: new Date().toISOString(),
        };
        
        localStorage.setItem('customerDesignDraft', JSON.stringify(designData));
        
        setNotification({ 
          message: 'Design saved locally!', 
          type: 'success' 
        });
        
        // Send message to parent window
        if (window.opener || window.parent !== window) {
          const targetWindow = window.opener || window.parent;
          
          // Debug logging
          console.log('[DesignerCanvas] Sending design-saved message (localStorage)');
          console.log('[DesignerCanvas] Canvas state:', canvasState);
          console.log('[DesignerCanvas] Template colors prop:', templateColors);
          console.log('[DesignerCanvas] Template colors length:', templateColors?.length);
          
          targetWindow.postMessage({
            type: 'design-saved',
            designId: designId,
            thumbnail: thumbnail,
            templateId: initialTemplate?.id,
            variantId: initialState?.variantId,
            productId: initialState?.productId,
            isLocal: true,
            canvasState: canvasState,
            templateColors: templateColors
          }, '*');
          
          // Show return message
          setNotification({ 
            message: 'Design saved! Returning to product...', 
            type: 'success' 
          });
          
          // Auto-close after delay if opened in new window
          if (window.opener) {
            setTimeout(() => {
              window.close();
            }, 2000);
          }
        }
      }
      
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      console.error('Error saving design:', error);
      setNotification({ 
        message: 'Failed to save design: ' + (error instanceof Error ? error.message : 'Unknown error'), 
        type: 'error' 
      });
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  // Save template function
  const saveTemplate = async () => {
    // If onSave prop is provided, use it instead of internal save logic
    if (onSave) {
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
        
        // Generate thumbnails for both sides
        let thumbnail: string | undefined;
        let frontThumbnail: string | undefined;
        let backThumbnail: string | undefined;
        
        // Helper function to generate thumbnail
        const generateThumbnail = async (pixelRatio: number = 1): Promise<string | undefined> => {
          try {
            return stageRef.current?.toDataURL({ 
              x: 0,
              y: 0,
              width: dimensions.width * scale,
              height: dimensions.height * scale,
              pixelRatio: pixelRatio / scale,
              mimeType: 'image/png'
            });
          } catch (error) {
            console.error('Error generating thumbnail:', error);
            return undefined;
          }
        };
        
        // Generate thumbnail for current side (for backward compatibility)
        thumbnail = await generateThumbnail() || await generateThumbnail(0.6);
        
        // If this is a dual-sided template, generate thumbnails for both sides
        const hasDualSides = canvasState.front || canvasState.back;
        if (hasDualSides) {
          // Save current side
          const originalSide = currentSide;
          
          // Generate front thumbnail
          if (canvasState.front) {
            setCurrentSide('front');
            await new Promise(resolve => setTimeout(resolve, 100)); // Wait for render
            frontThumbnail = await generateThumbnail() || await generateThumbnail(0.6);
          }
          
          // Generate back thumbnail
          if (canvasState.back) {
            setCurrentSide('back');
            await new Promise(resolve => setTimeout(resolve, 100)); // Wait for render
            backThumbnail = await generateThumbnail() || await generateThumbnail(0.6);
          }
          
          // Restore original side
          setCurrentSide(originalSide);
          await new Promise(resolve => setTimeout(resolve, 100)); // Wait for render
        }
        
        // Call the onSave prop with canvas data and thumbnails
        await onSave(canvasState, thumbnail, frontThumbnail, backThumbnail);
        
        setNotification({ 
          message: 'Template saved successfully!', 
          type: 'success' 
        });
        setTimeout(() => setNotification(null), 3000);
      } catch (error) {
        console.error('Error saving template:', error);
        setNotification({ 
          message: 'Failed to save template: ' + (error instanceof Error ? error.message : 'Unknown error'), 
          type: 'error' 
        });
        setTimeout(() => setNotification(null), 5000);
      } finally {
        setIsSaving(false);
      }
      return;
    }
    
    // Original save logic (for backward compatibility)
    // If editing existing template, use its name, otherwise prompt for new name
    const templateName = initialTemplate?.name || prompt('Enter template name:');
    if (!templateName) return;

    // Extract color from variant or use legacy colorVariant
    let colorVariant = initialTemplate?.colorVariant;
    
    // If we have a Shopify variant, extract color from it
    if (shopifyVariant && !colorVariant) {
      const colorOption = shopifyVariant.selectedOptions?.find(opt => opt.name === "Color");
      if (colorOption) {
        colorVariant = colorOption.value.toLowerCase();
      }
    }
    
    // If we have a productLayout but no colorVariant, prompt for it (legacy)
    if (productLayout && !colorVariant) {
      const availableColors = productLayout.attributes?.colors || [];
      if (availableColors.length > 0) {
        const selectedColor = prompt(
          `Select color for this template:\n${availableColors.join(', ')}\n\nEnter color:`
        );
        if (!selectedColor || !availableColors.includes(selectedColor)) {
          alert('Invalid color selection. Please choose from: ' + availableColors.join(', '));
          return;
        }
        colorVariant = selectedColor;
      } else {
        const selectedColor = prompt('Enter color variant for this template:');
        if (!selectedColor) return;
        colorVariant = selectedColor;
      }
    }

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
      
      // Debug logging
      console.log('Save Template Debug:', {
        shopifyProduct,
        shopifyVariant,
        productLayout,
        colorVariant,
        initialTemplate
      });
      
      // Include template ID if we're updating an existing template
      if (initialTemplate?.id) {
        formData.append('templateId', initialTemplate.id);
      }
      
      // Include Shopify references if available (new system)
      if (shopifyProduct?.id) {
        formData.append('shopifyProductId', shopifyProduct.id);
      }
      if (shopifyVariant?.id) {
        formData.append('shopifyVariantId', shopifyVariant.id);
      }
      
      // Include productLayoutId and colorVariant for legacy support
      if (productLayout?.id) {
        formData.append('productLayoutId', productLayout.id);
      }
      if (colorVariant) {
        formData.append('colorVariant', colorVariant);
      }

      const response = await fetch('/api/templates/save', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      
      if (result.success) {
        if (result.warning) {
          setNotification({ 
            message: `Template saved but with warning: ${result.warning}`, 
            type: 'info' 
          });
        } else {
          setNotification({ 
            message: 'Template saved and synced successfully!', 
            type: 'success' 
          });
        }
        loadTemplatesList(); // Refresh templates list
        // Auto-hide notification after 3 seconds
        setTimeout(() => setNotification(null), 3000);
      } else {
        throw new Error(result.error || 'Failed to save template');
      }
    } catch (error) {
      console.error('Error saving template:', error);
      setNotification({ 
        message: 'Failed to save template: ' + (error instanceof Error ? error.message : 'Unknown error'), 
        type: 'error' 
      });
      // Auto-hide error notification after 5 seconds
      setTimeout(() => setNotification(null), 5000);
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
        await loadCanvasState(canvasData);
        setNotification({ 
          message: 'Template loaded successfully!', 
          type: 'success' 
        });
        setTimeout(() => setNotification(null), 3000);
      } else {
        throw new Error(result.error || 'Failed to load template');
      }
    } catch (error) {
      console.error('Error loading template:', error);
      setNotification({ 
        message: 'Failed to load template: ' + (error instanceof Error ? error.message : 'Unknown error'), 
        type: 'error' 
      });
      setTimeout(() => setNotification(null), 5000);
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
    const loadInitialTemplate = async () => {
      if (initialTemplate) {
        try {
          // Check for new dual-sided format first
          if (initialTemplate.frontCanvasData || initialTemplate.backCanvasData) {
            const dualSidedState: any = {};
            
            if (initialTemplate.frontCanvasData) {
              dualSidedState.front = typeof initialTemplate.frontCanvasData === 'string'
                ? JSON.parse(initialTemplate.frontCanvasData)
                : initialTemplate.frontCanvasData;
            }
            
            if (initialTemplate.backCanvasData) {
              dualSidedState.back = typeof initialTemplate.backCanvasData === 'string'
                ? JSON.parse(initialTemplate.backCanvasData)
                : initialTemplate.backCanvasData;
            }
            
            await loadCanvasState(dualSidedState);
          } 
          // Fall back to legacy single-sided format
          else if (initialTemplate.canvasData) {
            const canvasData = typeof initialTemplate.canvasData === 'string'
              ? JSON.parse(initialTemplate.canvasData)
              : initialTemplate.canvasData;
            await loadCanvasState(canvasData);
          }
        } catch (error) {
          console.error('Error loading initial template:', error);
        }
      }
    };
    loadInitialTemplate();
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
    setShapeElements(prev => prev.filter(el => el.id !== selectedId));
    
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
      // Ctrl+C or Cmd+C to copy
      if (e.key === 'c' && (e.ctrlKey || e.metaKey) && selectedId) {
        e.preventDefault();
        copyElement(selectedId);
      }
      
      // Ctrl+V or Cmd+V to paste
      if (e.key === 'v' && (e.ctrlKey || e.metaKey) && clipboard) {
        e.preventDefault();
        pasteElement();
      }
      
      // Ctrl+D or Cmd+D to duplicate
      if (e.key === 'd' && (e.ctrlKey || e.metaKey) && selectedId) {
        e.preventDefault();
        duplicateElement();
      }
      
      // Ctrl+] or Cmd+] to move layer up
      if (e.key === ']' && (e.ctrlKey || e.metaKey) && selectedId) {
        e.preventDefault();
        moveLayerUp();
      }
      
      // Ctrl+[ or Cmd+[ to move layer down
      if (e.key === '[' && (e.ctrlKey || e.metaKey) && selectedId) {
        e.preventDefault();
        moveLayerDown();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, clipboard]);

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

  // Close font picker when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Check if click is outside font picker
      const target = e.target as HTMLElement;
      const fontPicker = target.closest('[data-font-picker]');
      const fontButton = target.closest('[data-font-button]');
      
      if (!fontPicker && !fontButton && showFontPicker) {
        setShowFontPicker(false);
      }
    };

    if (showFontPicker) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showFontPicker]);

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

  // Close design color picker when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Check if click is outside design color picker
      const target = e.target as HTMLElement;
      const designColorPicker = target.closest('[data-design-color-picker]');
      const designColorButton = target.closest('[data-design-color-button]');
      
      if (!designColorPicker && !designColorButton && showDesignColorPicker) {
        setShowDesignColorPicker(false);
      }
    };

    if (showDesignColorPicker) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showDesignColorPicker]);

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Left Text Panel */}
      <div style={{
        width: showTextPanel ? '208px' : '0',
        transition: 'width 0.3s ease',
        overflow: 'hidden',
        background: 'white',
        boxShadow: '2px 0 4px rgba(0,0,0,0.1)',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}>
        {/* Text Panel Toggle Tab */}
        <div
          onClick={() => setShowTextPanel(!showTextPanel)}
          style={{
            position: 'absolute',
            right: '-32px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '32px',
            height: '64px',
            background: 'white',
            border: '1px solid #e6e6e6',
            borderLeft: 'none',
            borderRadius: '0 4px 4px 0',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#666',
            boxShadow: '2px 0 4px rgba(0,0,0,0.05)',
            transition: 'all 0.2s',
            zIndex: 10
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f8f9fa';
            e.currentTarget.style.color = '#000';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'white';
            e.currentTarget.style.color = '#666';
          }}
        >
          T
        </div>
        
        {/* Text Panel Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid #e6e6e6' }}>
          <h3 style={{ 
            margin: 0, 
            fontSize: '16px', 
            fontWeight: 'bold',
            color: '#000',
            marginBottom: '8px'
          }}>
            Text
          </h3>
          <p style={{ 
            margin: 0, 
            fontSize: '12px', 
            color: '#666',
            lineHeight: '1.5'
          }}>
            Edit your text below, or click on the field you'd like to edit directly on your design.
          </p>
        </div>
        
        {/* Text Elements List */}
        <div style={{ 
          flex: 1, 
          padding: '16px',
          overflowY: 'auto'
        }}>
          {/* Regular Text Elements */}
          {textElements.map((element) => (
            <div key={element.id} style={{ marginBottom: '12px' }}>
              <input
                type="text"
                value={element.text}
                onChange={(e) => {
                  const newText = e.target.value;
                  setTextElements(prev => 
                    prev.map(el => 
                      el.id === element.id ? { ...el, text: newText } : el
                    )
                  );
                }}
                onFocus={() => {
                  setSelectedId(element.id);
                  setEditingTextId(element.id);
                }}
                onBlur={() => setEditingTextId(null)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  border: editingTextId === element.id ? '2px solid #6fd0f5' : '1px solid #e6e6e6',
                  borderRadius: '4px',
                  background: '#f8f9fa',
                  transition: 'all 0.2s',
                  outline: 'none'
                }}
                placeholder="Enter text"
              />
            </div>
          ))}
          
          {/* Curved Text Elements */}
          {curvedTextElements.map((element) => (
            <div key={element.id} style={{ marginBottom: '12px' }}>
              <input
                type="text"
                value={element.text}
                onChange={(e) => {
                  const newText = e.target.value;
                  setCurvedTextElements(prev => 
                    prev.map(el => 
                      el.id === element.id ? { ...el, text: newText } : el
                    )
                  );
                }}
                onFocus={() => {
                  setSelectedId(element.id);
                  setEditingTextId(element.id);
                }}
                onBlur={() => setEditingTextId(null)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  border: editingTextId === element.id ? '2px solid #6fd0f5' : '1px solid #e6e6e6',
                  borderRadius: '4px',
                  background: '#f8f9fa',
                  transition: 'all 0.2s',
                  outline: 'none'
                }}
                placeholder="Enter curved text"
              />
            </div>
          ))}
          
          {/* Gradient Text Elements */}
          {gradientTextElements.map((element) => (
            <div key={element.id} style={{ marginBottom: '12px' }}>
              <input
                type="text"
                value={element.text}
                onChange={(e) => {
                  const newText = e.target.value;
                  setGradientTextElements(prev => 
                    prev.map(el => 
                      el.id === element.id ? { ...el, text: newText } : el
                    )
                  );
                }}
                onFocus={() => {
                  setSelectedId(element.id);
                  setEditingTextId(element.id);
                }}
                onBlur={() => setEditingTextId(null)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  border: editingTextId === element.id ? '2px solid #6fd0f5' : '1px solid #e6e6e6',
                  borderRadius: '4px',
                  background: '#f8f9fa',
                  transition: 'all 0.2s',
                  outline: 'none'
                }}
                placeholder="Enter gradient text"
              />
            </div>
          ))}
          
          {/* New Text Field Button */}
          <button
            onClick={addText}
            style={{
              width: '100%',
              padding: '10px',
              marginTop: '16px',
              fontSize: '14px',
              fontWeight: '500',
              color: 'white',
              background: '#6fd0f5',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#5ab8dd';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#6fd0f5';
            }}
          >
            + New Text Field
          </button>
        </div>
      </div>
      
      {/* Main Canvas Container */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        {/* Notification Banner */}
        {notification && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: notification.type === 'success' ? '#108043' : notification.type === 'error' ? '#d82c0d' : '#005fb3',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '4px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          zIndex: 2000,
          fontSize: '14px',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          animation: 'slideDown 0.3s ease-out'
        }}>
          <span>{notification.type === 'success' ? '✓' : notification.type === 'error' ? '✕' : 'ℹ'}</span>
          {notification.message}
          <button 
            onClick={() => setNotification(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              padding: '4px',
              marginLeft: '8px',
              fontSize: '16px',
              opacity: 0.8,
              transition: 'opacity 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
          >
            ×
          </button>
        </div>
      )}
      <div style={{ padding: '10px', flexShrink: 0, backgroundColor: '#f7f8fa', borderBottom: '1px solid #ddd', maxHeight: '300px', overflowY: 'auto' }}>
        {/* Side Navigation - Only show if template has dual sides */}
        {((initialTemplate?.frontCanvasData && initialTemplate?.backCanvasData) || layoutVariant?.backBaseImageUrl) && (
          <div style={{ display: 'inline-flex', marginRight: '20px', borderRight: '2px solid #ddd', paddingRight: '20px' }}>
            <button
              onClick={() => setCurrentSide('front')}
              style={{
                padding: '8px 20px',
                fontSize: '14px',
                backgroundColor: currentSide === 'front' ? '#007bff' : '#f0f0f0',
                color: currentSide === 'front' ? 'white' : '#333',
                border: '1px solid #ccc',
                borderRadius: '4px 0 0 4px',
                borderRight: 'none',
                cursor: 'pointer',
                fontWeight: currentSide === 'front' ? 'bold' : 'normal',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (currentSide !== 'front') {
                  e.currentTarget.style.backgroundColor = '#e0e0e0';
                }
              }}
              onMouseLeave={(e) => {
                if (currentSide !== 'front') {
                  e.currentTarget.style.backgroundColor = '#f0f0f0';
                }
              }}
            >
              Front
            </button>
            <button
              onClick={() => !sameDesignBothSides && setCurrentSide('back')}
              disabled={sameDesignBothSides}
              style={{
                padding: '8px 20px',
                fontSize: '14px',
                backgroundColor: currentSide === 'back' ? '#007bff' : '#f0f0f0',
                color: currentSide === 'back' ? 'white' : '#333',
                border: '1px solid #ccc',
                borderRadius: '0 4px 4px 0',
                cursor: sameDesignBothSides ? 'not-allowed' : 'pointer',
                opacity: sameDesignBothSides ? 0.5 : 1,
                fontWeight: currentSide === 'back' ? 'bold' : 'normal',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (currentSide !== 'back' && !sameDesignBothSides) {
                  e.currentTarget.style.backgroundColor = '#e0e0e0';
                }
              }}
              onMouseLeave={(e) => {
                if (currentSide !== 'back' && !sameDesignBothSides) {
                  e.currentTarget.style.backgroundColor = '#f0f0f0';
                }
              }}
            >
              Back
            </button>
            
            {/* Same Design Toggle - Only show if template has dual sides */}
            <div style={{ display: 'inline-flex', alignItems: 'center', marginLeft: '20px' }}>
              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                fontSize: '14px',
                color: '#333',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={sameDesignBothSides}
                  onChange={(e) => setSameDesignBothSides(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                Same artwork on both sides?
              </label>
            </div>
          </div>
        )}
        
        <button onClick={addText} style={{ padding: '8px 16px', fontSize: '14px', marginRight: '10px' }}>
          Add Text
        </button>
        <button onClick={addCurvedText} style={{ padding: '8px 16px', fontSize: '14px', marginRight: '10px' }}>
          Add Curved Text
        </button>
        
        {/* Shape buttons */}
        <button onClick={addEllipse} style={{ padding: '8px 16px', fontSize: '14px', marginRight: '10px' }}>
          Add Ellipse
        </button>
        <button onClick={addRing} style={{ padding: '8px 16px', fontSize: '14px', marginRight: '10px' }}>
          Add Ring
        </button>
        <button onClick={addRectangle} style={{ padding: '8px 16px', fontSize: '14px', marginRight: '10px' }}>
          Add Rectangle
        </button>
        
        {/* Browse Images Button */}
        <button 
          onClick={() => setShowMediaBrowser(true)}
          style={{ 
            padding: '8px 16px', 
            fontSize: '14px', 
            marginRight: '10px',
            backgroundColor: '#f0f0f0',
            border: '1px solid #ccc',
            borderRadius: '3px',
            cursor: 'pointer',
            display: 'inline-block'
          }}
        >
          Browse Images
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
        
        {/* Save/Load Controls - Show different UI based on admin view */}
        {isAdminView ? (
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
        ) : (
          <div style={{ display: 'inline-block', marginLeft: '20px', borderLeft: '2px solid #ddd', paddingLeft: '20px' }}>
            <button 
              onClick={saveCustomerDesign} 
              disabled={isSaving}
              style={{ 
                padding: '8px 16px', 
                fontSize: '14px', 
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                opacity: isSaving ? 0.6 : 1,
                cursor: isSaving ? 'not-allowed' : 'pointer',
                marginRight: '10px'
              }}
            >
              {isSaving ? 'Saving...' : 'Done'}
            </button>
            {window.__RETURN_URL__ && (
              <a 
                href={window.__RETURN_URL__}
                style={{ 
                  padding: '8px 16px', 
                  fontSize: '14px', 
                  color: '#666',
                  textDecoration: 'none',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  display: 'inline-block',
                  backgroundColor: 'white',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f5f5f5';
                  e.currentTarget.style.borderColor = '#999';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.borderColor = '#ddd';
                }}
              >
                ← Return to Product
              </a>
            )}
          </div>
        )}
        
        {/* Design Color Control - Only show in customer view */}
        {!isAdminView && templateColors.length > 0 && (
          <div style={{ display: 'inline-block', marginLeft: '20px', position: 'relative' }}>
            <button
              data-design-color-button="true"
              onClick={() => setShowDesignColorPicker(!showDesignColorPicker)}
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
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
            >
              <span style={{ fontSize: '12px', color: '#666' }}>Design Color:</span>
              <span style={{ 
                fontSize: '14px', 
                fontWeight: 500, 
                textTransform: 'capitalize' 
              }}>
                {selectedDesignColor || 'Select'}
              </span>
            </button>
            
            {/* Design Color Picker Dropdown */}
            {showDesignColorPicker && (
              <div
                data-design-color-picker="true"
                style={{
                  position: 'absolute',
                  top: '40px',
                  left: 0,
                  background: 'white',
                  border: '1px solid #ccc',
                  borderRadius: '6px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  padding: '8px',
                  minWidth: '200px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  zIndex: 1001,
                }}
              >
                {templateColors.map((colorOption) => (
                  <button
                    key={colorOption.chipColor}
                    onClick={() => {
                      applyDesignColor(colorOption.chipColor);
                      setShowDesignColorPicker(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      width: '100%',
                      padding: '8px 12px',
                      border: 'none',
                      background: selectedDesignColor === colorOption.chipColor ? '#f0f0f0' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                      borderRadius: '4px',
                      textAlign: 'left'
                    }}
                    onMouseEnter={(e) => {
                      if (selectedDesignColor !== colorOption.chipColor) {
                        e.currentTarget.style.backgroundColor = '#f5f5f5';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = selectedDesignColor === colorOption.chipColor ? '#f0f0f0' : 'transparent';
                    }}
                  >
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: colorOption.color1,
                        border: '2px solid #ddd',
                        flexShrink: 0
                      }}
                    />
                    <span style={{ 
                      fontSize: '14px', 
                      textTransform: 'capitalize',
                      color: '#333'
                    }}>
                      {colorOption.chipColor.replace('-', ' ')}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        
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
                { name: 'Brown', hex: '#9e652e' },
                { name: 'Light Grey', hex: '#cccccc' },
                { name: 'Light Pink', hex: '#ffaaaa' },
                { name: 'Sky Blue', hex: '#7fa8db' },
                { name: 'Mint Green', hex: '#e0eed5' },
                { name: 'Lavender', hex: '#aaaaff' },
                { name: 'Amber', hex: '#febd11' },
                { name: 'Olive', hex: '#97872a' },
                { name: 'Peach', hex: '#ffcfa3' },
                { name: 'Cream', hex: '#f7f4e8' },
                { name: 'Powder Blue', hex: '#b8d6e0' },
                { name: 'Blush', hex: '#ffd6e1' },
                { name: 'Tan', hex: '#c49a73' }
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
                  // Initialize gradient data if not already set
                  if (!(window as any).__tempBackgroundGradient || (window as any).__tempBackgroundGradient.type !== 'linear') {
                    (window as any).__tempBackgroundGradient = {
                      type: 'linear',
                      colorStops: [0, '#c8102e', 1, '#ffaaaa']
                    };
                  }
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
                  // Initialize gradient data if not already set
                  if (!(window as any).__tempBackgroundGradient || (window as any).__tempBackgroundGradient.type !== 'radial') {
                    (window as any).__tempBackgroundGradient = {
                      type: 'radial',
                      colorStops: [0, '#c8102e', 1, '#ffaaaa']
                    };
                  }
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
                      max="1368"
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
                        const newWidth = Math.min(1368, designableArea.width + 10);
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
                      max="1368"
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
                        const newHeight = Math.min(1368, designableArea.height + 10);
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
              width={dimensions.width}
              height={dimensions.height}
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
                fillLinearGradientColorStops={backgroundColor === 'linear-gradient' ? 
                  ((window as any).__tempBackgroundGradient?.type === 'linear' ? 
                    (window as any).__tempBackgroundGradient.colorStops : 
                    [0, '#c8102e', 1, '#ffaaaa']) : undefined}
                fillRadialGradientStartPoint={backgroundColor === 'radial-gradient' ? { x: designableArea.width / 2, y: designableArea.height / 2 } : undefined}
                fillRadialGradientEndPoint={backgroundColor === 'radial-gradient' ? { x: designableArea.width / 2, y: designableArea.height / 2 } : undefined}
                fillRadialGradientStartRadius={backgroundColor === 'radial-gradient' ? 0 : undefined}
                fillRadialGradientEndRadius={backgroundColor === 'radial-gradient' ? Math.min(designableArea.width, designableArea.height) / 2 : undefined}
                fillRadialGradientColorStops={backgroundColor === 'radial-gradient' ? 
                  ((window as any).__tempBackgroundGradient?.type === 'radial' ? 
                    (window as any).__tempBackgroundGradient.colorStops : 
                    [0, '#c8102e', 1, '#ffaaaa']) : undefined}
                listening={false}
              />
            )}
            
            {/* Render all elements in z-order */}
            {unifiedElements.map((element) => {
              if (element.type === 'image') {
                const imgEl = element.data;
                return (
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
                );
              }
              
              if (element.type === 'text') {
                const textEl = element.data;
                return (
                  <Text
                    key={textEl.id}
                    id={textEl.id}
                    text={textEl.text}
                    x={textEl.x}
                    y={textEl.y}
                    fontSize={textEl.fontSize || 24}
                    fontFamily={textEl.fontFamily}
                    fontStyle={textEl.fontWeight === 'bold' ? 'bold' : 'normal'}
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
                      const scaleY = node.scaleY(); // Use vertical scale for font size
                      const currentFontSize = textEl.fontSize || 24;
                      const newFontSize = Math.round(Math.max(8, Math.min(200, currentFontSize * scaleY))); // Clamp between 8-200
                      
                      // Reset scale to 1
                      node.scaleX(1);
                      node.scaleY(1);
                      
                      setTextElements(prev => 
                        prev.map(el => 
                          el.id === textEl.id 
                            ? { 
                                ...el, 
                                x: node.x(),
                                y: node.y(),
                                rotation: node.rotation(),
                                fontSize: newFontSize,
                                scaleX: 1,
                                scaleY: 1
                              }
                            : el
                        )
                      );
                      setTimeout(updateToolbarPosition, 0);
                    }}
                  />
                );
              }
              
              if (element.type === 'gradientText') {
                const gradientEl = element.data;
                return (
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
                      const scaleY = node.scaleY(); // Use vertical scale for font size
                      const currentFontSize = gradientEl.fontSize || 24;
                      const newFontSize = Math.round(Math.max(8, Math.min(200, currentFontSize * scaleY))); // Clamp between 8-200
                      
                      // Reset scale to 1
                      node.scaleX(1);
                      node.scaleY(1);
                      
                      setGradientTextElements(prev => 
                        prev.map(el => 
                          el.id === gradientEl.id 
                            ? { 
                                ...el, 
                                x: node.x(),
                                y: node.y(),
                                rotation: node.rotation(),
                                fontSize: newFontSize,
                                scaleX: 1,
                                scaleY: 1
                              }
                            : el
                        )
                      );
                      setTimeout(updateToolbarPosition, 0);
                    }}
                  />
                );
              }
              
              if (element.type === 'curvedText') {
                const curvedEl = element.data;
                // Calculate center Y based on whether text is flipped
                // For normal text: pin top edge, so center = topY + radius
                // For flipped text: pin bottom edge, so center = topY - radius
                const centerY = curvedEl.flipped 
                  ? curvedEl.topY - curvedEl.radius  // Bottom edge stays at topY
                  : curvedEl.topY + curvedEl.radius; // Top edge stays at topY
                
                // Create path for text - measure actual text width
                const fontSize = curvedEl.fontSize || 20;
                
                // Measure actual text width using a temporary Konva Text node
                const tempText = new (window as any).Konva.Text({
                  text: curvedEl.text,
                  fontSize: fontSize,
                  fontFamily: curvedEl.fontFamily,
                  fontStyle: curvedEl.fontWeight === 'bold' ? 'bold' : 'normal'
                });
                const measuredWidth = tempText.width();
                tempText.destroy(); // Clean up temporary node
                
                // Use measured width with a small padding factor
                const textLength = measuredWidth * 1.1; // Add 10% padding for better spacing
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
                      const scaleY = node.scaleY(); // Use vertical scale
                      const currentFontSize = curvedEl.fontSize || 20;
                      const currentRadius = curvedEl.radius;
                      
                      // Update both font size and radius proportionally
                      const newFontSize = Math.round(Math.max(8, Math.min(200, currentFontSize * scaleY))); // Clamp between 8-200
                      const newRadius = Math.round(Math.max(50, Math.min(1000, currentRadius * scaleY))); // Scale radius with reasonable bounds
                      
                      // Reset scale to 1
                      node.scaleX(1);
                      node.scaleY(1);
                      
                      setCurvedTextElements(prev => 
                        prev.map(el => 
                          el.id === curvedEl.id 
                            ? { 
                                ...el, 
                                x: node.x(),
                                // Calculate topY with new radius
                                topY: curvedEl.flipped 
                                  ? node.y() + newRadius  // Use new radius
                                  : node.y() - newRadius,
                                rotation: node.rotation(),
                                fontSize: newFontSize,
                                radius: newRadius, // Update the radius!
                                scaleX: 1,
                                scaleY: 1
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
                      fontStyle={curvedEl.fontWeight === 'bold' ? 'bold' : 'normal'}
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
              }
              
              if (element.type === 'shape') {
                const shapeEl = element.data;
                
                // Common props for all shapes
                const commonProps = {
                  key: shapeEl.id,
                  id: shapeEl.id,
                  x: shapeEl.x + (shapeEl.width || 0) / 2, // Center-based positioning
                  y: shapeEl.y + (shapeEl.height || 0) / 2,
                  fill: shapeEl.fill || '#ffffff',
                  stroke: shapeEl.stroke || '#000000',
                  strokeWidth: shapeEl.stroke ? (shapeEl.strokeWidth || 2) : 0,
                  rotation: shapeEl.rotation || 0,
                  scaleX: shapeEl.scaleX || 1,
                  scaleY: shapeEl.scaleY || 1,
                  draggable: true,
                  onClick: () => setSelectedId(shapeEl.id),
                  onTap: () => setSelectedId(shapeEl.id),
                  onDragEnd: (e: any) => {
                    const node = e.target;
                    setShapeElements(prev =>
                      prev.map(el =>
                        el.id === shapeEl.id
                          ? { ...el, x: node.x() - shapeEl.width / 2, y: node.y() - shapeEl.height / 2 }
                          : el
                      )
                    );
                    setTimeout(updateToolbarPosition, 0);
                  },
                  onTransformEnd: (e: any) => {
                    const node = e.target;
                    const scaleX = node.scaleX();
                    const scaleY = node.scaleY();
                    
                    // Reset scale and apply to dimensions
                    node.scaleX(1);
                    node.scaleY(1);
                    
                    if (shapeEl.type === 'rect') {
                      const newWidth = Math.max(5, shapeEl.width * scaleX);
                      const newHeight = Math.max(5, shapeEl.height * scaleY);
                      setShapeElements(prev =>
                        prev.map(el =>
                          el.id === shapeEl.id
                            ? {
                                ...el,
                                x: node.x() - newWidth / 2,
                                y: node.y() - newHeight / 2,
                                width: newWidth,
                                height: newHeight,
                                rotation: node.rotation()
                              }
                            : el
                        )
                      );
                    } else if (shapeEl.type === 'ellipse') {
                      const newWidth = Math.max(10, shapeEl.width * scaleX);
                      const newHeight = Math.max(10, shapeEl.height * scaleY);
                      setShapeElements(prev =>
                        prev.map(el =>
                          el.id === shapeEl.id
                            ? {
                                ...el,
                                x: node.x() - newWidth / 2,
                                y: node.y() - newHeight / 2,
                                width: newWidth,
                                height: newHeight,
                                rotation: node.rotation()
                              }
                            : el
                        )
                      );
                    } else if (shapeEl.type === 'ring') {
                      const scale = Math.max(scaleX, scaleY);
                      const newOuter = Math.max(20, (shapeEl.outerRadius || 50) * scale);
                      const newInner = Math.max(10, (shapeEl.innerRadius || 25) * scale);
                      setShapeElements(prev =>
                        prev.map(el =>
                          el.id === shapeEl.id
                            ? {
                                ...el,
                                x: node.x() - newOuter,
                                y: node.y() - newOuter,
                                outerRadius: newOuter,
                                innerRadius: newInner,
                                width: newOuter * 2,
                                height: newOuter * 2,
                                rotation: node.rotation()
                              }
                            : el
                        )
                      );
                    }
                    setTimeout(updateToolbarPosition, 0);
                  }
                };
                
                if (shapeEl.type === 'rect') {
                  return (
                    <Rect
                      {...commonProps}
                      width={shapeEl.width}
                      height={shapeEl.height}
                      offsetX={shapeEl.width / 2}
                      offsetY={shapeEl.height / 2}
                    />
                  );
                } else if (shapeEl.type === 'ellipse') {
                  return (
                    <Ellipse
                      {...commonProps}
                      radiusX={shapeEl.width / 2}
                      radiusY={shapeEl.height / 2}
                    />
                  );
                } else if (shapeEl.type === 'ring') {
                  return (
                    <Ring
                      {...commonProps}
                      innerRadius={shapeEl.innerRadius || 25}
                      outerRadius={shapeEl.outerRadius || 50}
                    />
                  );
                }
              }
              
              return null; // Should never reach here
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
            onClick={() => copyElement(selectedId)}
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
            title="Copy (Ctrl+C)"
          >
            📋
          </button>
          
          {clipboard && (
            <button
              onClick={pasteElement}
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
                position: 'relative'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
              title={`Paste ${clipboard.type} from ${clipboard.sourceSide} (Ctrl+V)`}
            >
              📄
              {clipboard.sourceSide !== currentSide && (
                <div style={{
                  position: 'absolute',
                  top: '-2px',
                  right: '-2px',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#6fd0f5',
                }}/>
              )}
            </button>
          )}
          
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
            ➕
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
          
          {/* Layer controls */}
          <div style={{ width: '1px', background: '#e0e0e0', height: '24px', margin: '0 4px' }} />
          
          <button
            onClick={moveLayerDown}
            disabled={!selectedId || unifiedElements.findIndex(el => el.id === selectedId) === 0}
            style={{
              width: '36px',
              height: '36px',
              padding: '6px',
              border: 'none',
              borderRadius: '6px',
              background: 'white',
              cursor: !selectedId || unifiedElements.findIndex(el => el.id === selectedId) === 0 ? 'not-allowed' : 'pointer',
              opacity: !selectedId || unifiedElements.findIndex(el => el.id === selectedId) === 0 ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (selectedId && unifiedElements.findIndex(el => el.id === selectedId) > 0) {
                e.currentTarget.style.backgroundColor = '#f5f5f5';
              }
            }}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
            title="Move Layer Down (Ctrl+[)"
          >
            ↓
          </button>
          
          <button
            onClick={moveLayerUp}
            disabled={!selectedId || unifiedElements.findIndex(el => el.id === selectedId) === unifiedElements.length - 1}
            style={{
              width: '36px',
              height: '36px',
              padding: '6px',
              border: 'none',
              borderRadius: '6px',
              background: 'white',
              cursor: !selectedId || unifiedElements.findIndex(el => el.id === selectedId) === unifiedElements.length - 1 ? 'not-allowed' : 'pointer',
              opacity: !selectedId || unifiedElements.findIndex(el => el.id === selectedId) === unifiedElements.length - 1 ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (selectedId && unifiedElements.findIndex(el => el.id === selectedId) < unifiedElements.length - 1) {
                e.currentTarget.style.backgroundColor = '#f5f5f5';
              }
            }}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
            title="Move Layer Up (Ctrl+])"
          >
            ↑
          </button>
          
          <button
            onClick={moveToFront}
            disabled={!selectedId || unifiedElements.findIndex(el => el.id === selectedId) === unifiedElements.length - 1}
            style={{
              width: '36px',
              height: '36px',
              padding: '6px',
              border: 'none',
              borderRadius: '6px',
              background: 'white',
              cursor: !selectedId || unifiedElements.findIndex(el => el.id === selectedId) === unifiedElements.length - 1 ? 'not-allowed' : 'pointer',
              opacity: !selectedId || unifiedElements.findIndex(el => el.id === selectedId) === unifiedElements.length - 1 ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (selectedId && unifiedElements.findIndex(el => el.id === selectedId) < unifiedElements.length - 1) {
                e.currentTarget.style.backgroundColor = '#f5f5f5';
              }
            }}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
            title="Move to Front"
          >
            ⬆️
          </button>
          
          <button
            onClick={moveToBack}
            disabled={!selectedId || unifiedElements.findIndex(el => el.id === selectedId) === 0}
            style={{
              width: '36px',
              height: '36px',
              padding: '6px',
              border: 'none',
              borderRadius: '6px',
              background: 'white',
              cursor: !selectedId || unifiedElements.findIndex(el => el.id === selectedId) === 0 ? 'not-allowed' : 'pointer',
              opacity: !selectedId || unifiedElements.findIndex(el => el.id === selectedId) === 0 ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (selectedId && unifiedElements.findIndex(el => el.id === selectedId) > 0) {
                e.currentTarget.style.backgroundColor = '#f5f5f5';
              }
            }}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
            title="Move to Back"
          >
            ⬇️
          </button>
          
          {/* Font controls - only show for text elements */}
          {(textElements.find(el => el.id === selectedId) || gradientTextElements.find(el => el.id === selectedId) || curvedTextElements.find(el => el.id === selectedId)) && (
            <>
              <div style={{ width: '1px', background: '#e0e0e0', height: '24px', margin: '0 4px' }} />
              
              {/* Font Picker Button */}
              <div style={{ position: 'relative' }}>
                <button
                  data-font-button="true"
                  onClick={() => setShowFontPicker(!showFontPicker)}
                  style={{
                    padding: '4px 12px',
                    fontSize: '14px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    background: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    minWidth: '140px',
                    justifyContent: 'space-between',
                    transition: 'all 0.2s',
                    fontFamily: textElements.find(el => el.id === selectedId)?.fontFamily ||
                      gradientTextElements.find(el => el.id === selectedId)?.fontFamily ||
                      curvedTextElements.find(el => el.id === selectedId)?.fontFamily ||
                      'Arial'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {textElements.find(el => el.id === selectedId)?.fontFamily ||
                      gradientTextElements.find(el => el.id === selectedId)?.fontFamily ||
                      curvedTextElements.find(el => el.id === selectedId)?.fontFamily ||
                      'Arial'}
                  </span>
                  <span style={{ fontSize: '12px' }}>▼</span>
                </button>
                
                {/* Font Picker Dropdown */}
                {showFontPicker && (
                  <div
                    data-font-picker="true"
                    style={{
                      position: 'absolute',
                      top: '38px',
                      left: 0,
                      background: 'white',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      minWidth: '220px',
                      maxHeight: '400px',
                      overflowY: 'auto',
                      zIndex: 1002,
                    }}
                  >
                    {(['sans-serif', 'serif', 'display', 'script', 'monospace'] as const).map(category => {
                      const fonts = getFontsByCategory(category);
                      if (fonts.length === 0) return null;
                      
                      const categoryLabels = {
                        'sans-serif': 'Sans Serif',
                        'serif': 'Serif',
                        'display': 'Display & Decorative',
                        'script': 'Script & Handwriting',
                        'monospace': 'Monospace'
                      };
                      
                      return (
                        <div key={category}>
                          <div style={{
                            padding: '8px 12px 4px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            color: '#666',
                            borderBottom: '1px solid #eee',
                            backgroundColor: '#f9f9f9'
                          }}>
                            {categoryLabels[category]}
                          </div>
                          {fonts.map(fontDef => (
                            <button
                              key={fontDef.id}
                              onClick={() => {
                                handleFontChange(fontDef.family);
                                setShowFontPicker(false);
                              }}
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                border: 'none',
                                background: 'none',
                                cursor: 'pointer',
                                textAlign: 'left',
                                fontSize: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                transition: 'background 0.2s',
                                backgroundColor: (
                                  textElements.find(el => el.id === selectedId)?.fontFamily === fontDef.family ||
                                  gradientTextElements.find(el => el.id === selectedId)?.fontFamily === fontDef.family ||
                                  curvedTextElements.find(el => el.id === selectedId)?.fontFamily === fontDef.family
                                ) ? '#e3f2fd' : 'transparent'
                              }}
                              onMouseEnter={(e) => {
                                if (e.currentTarget.style.backgroundColor !== 'rgb(227, 242, 253)') {
                                  e.currentTarget.style.backgroundColor = '#f5f5f5';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (e.currentTarget.style.backgroundColor === '#f5f5f5') {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }
                              }}
                            >
                              <img 
                                src={fontDef.previewUrl} 
                                alt={fontDef.displayName}
                                style={{ 
                                  height: '24px', 
                                  maxWidth: '180px',
                                  objectFit: 'contain',
                                  objectPosition: 'left center'
                                }}
                                onError={(e) => {
                                  // Fallback to text if preview image fails
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const span = document.createElement('span');
                                  span.textContent = fontDef.displayName;
                                  span.style.fontFamily = fontDef.family;
                                  target.parentNode?.appendChild(span);
                                }}
                              />
                              <span style={{ fontSize: '12px', color: '#999', marginLeft: 'auto' }}>
                                {fontLoader.isFontLoaded(fontDef.family) ? '✓' : '⏳'}
                              </span>
                            </button>
                          ))}
                        </div>
                      );
                    })}
                    
                    {/* Browse More Fonts Button */}
                    <div style={{
                      borderTop: '1px solid #eee',
                      padding: '8px'
                    }}>
                      <button
                        onClick={() => {
                          setShowFontPicker(false);
                          setShowFontBrowser(true);
                        }}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: 'none',
                          background: '#f0f0f0',
                          cursor: 'pointer',
                          textAlign: 'center',
                          fontSize: '14px',
                          fontWeight: 500,
                          color: '#0066ff',
                          borderRadius: '6px',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#e0e0e0';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#f0f0f0';
                        }}
                      >
                        Browse All Fonts...
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
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
              
              {/* Bold Button */}
              <button
                onClick={async () => {
                  const isTextEl = textElements.find(el => el.id === selectedId);
                  const isCurvedTextEl = curvedTextElements.find(el => el.id === selectedId);
                  
                  if (isTextEl) {
                    const newWeight = isTextEl.fontWeight === 'bold' ? 'normal' : 'bold';
                    // Load bold font weight if needed
                    if (newWeight === 'bold') {
                      const fontDef = CURATED_FONTS.find(f => f.family === isTextEl.fontFamily);
                      if (fontDef && fontDef.weights[700]) {
                        await fontLoader.loadFont(fontDef, 700);
                      }
                    }
                    setTextElements(prev =>
                      prev.map(el =>
                        el.id === selectedId
                          ? { ...el, fontWeight: newWeight }
                          : el
                      )
                    );
                  } else if (isCurvedTextEl) {
                    const newWeight = isCurvedTextEl.fontWeight === 'bold' ? 'normal' : 'bold';
                    // Load bold font weight if needed
                    if (newWeight === 'bold') {
                      const fontDef = CURATED_FONTS.find(f => f.family === isCurvedTextEl.fontFamily);
                      if (fontDef && fontDef.weights[700]) {
                        await fontLoader.loadFont(fontDef, 700);
                      }
                    }
                    setCurvedTextElements(prev =>
                      prev.map(el =>
                        el.id === selectedId
                          ? { ...el, fontWeight: newWeight }
                          : el
                      )
                    );
                  }
                  
                  // Force transformer to update after font weight change
                  // Small delay to allow React to re-render with new font weight
                  setTimeout(() => {
                    if (transformerRef.current && selectedId) {
                      const stage = transformerRef.current.getStage();
                      const selectedNode = stage.findOne('#' + selectedId);
                      if (selectedNode) {
                        transformerRef.current.nodes([selectedNode]);
                        transformerRef.current.getLayer().batchDraw();
                      }
                    }
                  }, 50);
                }}
                style={{
                  width: '36px',
                  height: '36px',
                  padding: '6px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  background: (
                    textElements.find(el => el.id === selectedId)?.fontWeight === 'bold' ||
                    curvedTextElements.find(el => el.id === selectedId)?.fontWeight === 'bold'
                  ) ? '#e3f2fd' : 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (e.currentTarget.style.backgroundColor !== 'rgb(227, 242, 253)') {
                    e.currentTarget.style.backgroundColor = '#f5f5f5';
                  }
                }}
                onMouseLeave={(e) => {
                  const isBold = textElements.find(el => el.id === selectedId)?.fontWeight === 'bold' ||
                    curvedTextElements.find(el => el.id === selectedId)?.fontWeight === 'bold';
                  e.currentTarget.style.backgroundColor = isBold ? '#e3f2fd' : 'white';
                }}
                title="Bold"
              >
                B
              </button>
              
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
                      { name: 'Brown', hex: '#9e652e' },
                      { name: 'Light Grey', hex: '#cccccc' },
                      { name: 'Light Pink', hex: '#ffaaaa' },
                      { name: 'Sky Blue', hex: '#7fa8db' },
                      { name: 'Mint Green', hex: '#e0eed5' },
                      { name: 'Lavender', hex: '#aaaaff' },
                      { name: 'Amber', hex: '#febd11' },
                      { name: 'Olive', hex: '#97872a' },
                      { name: 'Peach', hex: '#ffcfa3' },
                      { name: 'Cream', hex: '#f7f4e8' },
                      { name: 'Powder Blue', hex: '#b8d6e0' },
                      { name: 'Blush', hex: '#ffd6e1' },
                      { name: 'Tan', hex: '#c49a73' }
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
                        { name: 'Brown', hex: '#9e652e' },
                        { name: 'Light Grey', hex: '#cccccc' },
                        { name: 'Light Pink', hex: '#ffaaaa' },
                        { name: 'Sky Blue', hex: '#7fa8db' },
                        { name: 'Mint Green', hex: '#e0eed5' },
                        { name: 'Lavender', hex: '#aaaaff' },
                        { name: 'Amber', hex: '#febd11' },
                        { name: 'Olive', hex: '#97872a' },
                        { name: 'Peach', hex: '#ffcfa3' },
                        { name: 'Cream', hex: '#f7f4e8' },
                        { name: 'Powder Blue', hex: '#b8d6e0' },
                        { name: 'Blush', hex: '#ffd6e1' },
                        { name: 'Tan', hex: '#c49a73' }
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
                  max="500"
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
          
          {/* Shape Controls - only show for shape elements */}
          {shapeElements.find(el => el.id === selectedId) && (
            <>
              <div style={{ width: '1px', background: '#e0e0e0', height: '24px', margin: '0 4px' }} />
              
              {/* Fill Color */}
              <div style={{ position: 'relative' }}>
                <button
                  data-shape-fill-button="true"
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: shapeElements.find(el => el.id === selectedId)?.fill || '#ffffff',
                    border: '2px solid #ccc',
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'all 0.2s',
                    boxShadow: showColorPicker ? '0 0 0 2px #0066ff' : 'none'
                  }}
                  title="Fill Color"
                />
                
                {/* Shape Fill Color Picker Popup */}
                {showColorPicker && (
                  <div
                    data-shape-fill-picker="true"
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
                      { name: 'Brown', hex: '#9e652e' },
                      { name: 'Light Grey', hex: '#cccccc' },
                      { name: 'Light Pink', hex: '#ffaaaa' },
                      { name: 'Sky Blue', hex: '#7fa8db' },
                      { name: 'Mint Green', hex: '#e0eed5' },
                      { name: 'Lavender', hex: '#aaaaff' },
                      { name: 'Amber', hex: '#febd11' },
                      { name: 'Olive', hex: '#97872a' },
                      { name: 'Peach', hex: '#ffcfa3' },
                      { name: 'Cream', hex: '#f7f4e8' },
                      { name: 'Powder Blue', hex: '#b8d6e0' },
                      { name: 'Blush', hex: '#ffd6e1' },
                      { name: 'Tan', hex: '#c49a73' }
                    ].map((color) => {
                      const currentFill = shapeElements.find(el => el.id === selectedId)?.fill || '#ffffff';
                      
                      return (
                        <button
                          key={color.hex}
                          onClick={() => {
                            setShapeElements(prev =>
                              prev.map(el =>
                                el.id === selectedId ? { ...el, fill: color.hex } : el
                              )
                            );
                            setShowColorPicker(false);
                          }}
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            backgroundColor: color.hex,
                            border: currentFill === color.hex ? '2px solid #0066ff' : '1px solid #ccc',
                            cursor: 'pointer',
                            padding: 0,
                            transition: 'all 0.2s',
                            boxShadow: color.hex === '#ffffff' ? 'inset 0 0 0 1px #ddd' : 'none'
                          }}
                          title={color.name}
                          onMouseEnter={(e) => {
                            if (currentFill !== color.hex) {
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
              
              {/* Stroke Color Control */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '12px', color: '#666' }}>Stroke:</span>
                <div style={{ position: 'relative' }}>
                  <button
                    data-shape-stroke-button="true"
                    onClick={() => setShowStrokeColorPicker(!showStrokeColorPicker)}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: (() => {
                        const stroke = shapeElements.find(el => el.id === selectedId)?.stroke || '#000000';
                        return stroke === 'transparent' ? '#f0f0f0' : stroke;
                      })(),
                      backgroundImage: (() => {
                        const stroke = shapeElements.find(el => el.id === selectedId)?.stroke || '#000000';
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
                  
                  {/* Shape Stroke Color Picker Popup */}
                  {showStrokeColorPicker && (
                    <div
                      data-shape-stroke-picker="true"
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
                          setShapeElements(prev =>
                            prev.map(el =>
                              el.id === selectedId ? { ...el, stroke: 'transparent', strokeWidth: 0 } : el
                            )
                          );
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
                          border: (shapeElements.find(el => el.id === selectedId)?.stroke || 'transparent') === 'transparent' ? '2px solid #0066ff' : '1px solid #ccc',
                          cursor: 'pointer',
                          padding: 0,
                          transition: 'all 0.2s',
                        }}
                        title="No Stroke"
                        onMouseEnter={(e) => {
                          const currentStroke = shapeElements.find(el => el.id === selectedId)?.stroke || 'transparent';
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
                        { name: 'Brown', hex: '#9e652e' },
                        { name: 'Light Grey', hex: '#cccccc' },
                        { name: 'Light Pink', hex: '#ffaaaa' },
                        { name: 'Sky Blue', hex: '#7fa8db' },
                        { name: 'Mint Green', hex: '#e0eed5' },
                        { name: 'Lavender', hex: '#aaaaff' },
                        { name: 'Amber', hex: '#febd11' },
                        { name: 'Olive', hex: '#97872a' },
                        { name: 'Peach', hex: '#ffcfa3' },
                        { name: 'Cream', hex: '#f7f4e8' },
                        { name: 'Powder Blue', hex: '#b8d6e0' },
                        { name: 'Blush', hex: '#ffd6e1' },
                        { name: 'Tan', hex: '#c49a73' }
                      ].map((color) => {
                        const currentStroke = shapeElements.find(el => el.id === selectedId)?.stroke || '#000000';
                        
                        return (
                          <button
                            key={color.hex}
                            onClick={() => {
                              setShapeElements(prev =>
                                prev.map(el =>
                                  el.id === selectedId ? { ...el, stroke: color.hex, strokeWidth: el.strokeWidth || 2 } : el
                                )
                              );
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
              
              {/* Stroke Width Control */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '12px', color: '#666' }}>Width:</span>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={shapeElements.find(el => el.id === selectedId)?.strokeWidth || 2}
                  onChange={(e) => {
                    const width = parseInt(e.target.value) || 0;
                    setShapeElements(prev =>
                      prev.map(el =>
                        el.id === selectedId ? { ...el, strokeWidth: width } : el
                      )
                    );
                  }}
                  style={{
                    width: '40px',
                    padding: '2px 4px',
                    fontSize: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                  }}
                />
              </div>
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
      
        {/* Font Browser Modal */}
        <FontBrowser
          isOpen={showFontBrowser}
          onClose={() => setShowFontBrowser(false)}
          onSelectFont={handleFontChange}
          currentFont={
            textElements.find(el => el.id === selectedId)?.fontFamily ||
            gradientTextElements.find(el => el.id === selectedId)?.fontFamily ||
            curvedTextElements.find(el => el.id === selectedId)?.fontFamily ||
            'Arial'
          }
          previewText={
            textElements.find(el => el.id === selectedId)?.text ||
            gradientTextElements.find(el => el.id === selectedId)?.text ||
            curvedTextElements.find(el => el.id === selectedId)?.text ||
            "The quick brown fox jumps over the lazy dog"
          }
        />
        
        {/* CSS Animation for notification */}
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes slideDown {
            from {
              transform: translateX(-50%) translateY(-20px);
              opacity: 0;
            }
            to {
              transform: translateX(-50%) translateY(0);
              opacity: 1;
            }
          }
        `}} />
      </div>
      
      {/* Right Side Panel */}
      <div style={{
        width: '240px',
        background: 'white',
        boxShadow: '-2px 0 4px rgba(0,0,0,0.1)',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}>
        {/* Sides Section */}
        <div style={{ padding: '16px', borderBottom: '1px solid #e6e6e6' }}>
          <h4 style={{ 
            margin: '0 0 12px 0', 
            fontSize: '14px', 
            fontWeight: 'bold',
            color: '#000'
          }}>
            Sides
          </h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Front Side Button */}
            <button
              onClick={() => {
                setCurrentSide('front');
                setSelectedId(null); // Clear selection when switching
              }}
              style={{
                padding: '12px 16px',
                border: currentSide === 'front' ? '2px solid #6fd0f5' : '1px solid #e6e6e6',
                borderRadius: '4px',
                background: currentSide === 'front' ? '#f0fbff' : 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                fontSize: '14px',
                fontWeight: currentSide === 'front' ? 'bold' : 'normal'
              }}
              onMouseEnter={(e) => {
                if (currentSide !== 'front') {
                  e.currentTarget.style.background = '#f8f9fa';
                }
              }}
              onMouseLeave={(e) => {
                if (currentSide !== 'front') {
                  e.currentTarget.style.background = 'white';
                }
              }}
            >
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '4px',
                background: currentSide === 'front' ? '#6fd0f5' : '#e6e6e6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                color: currentSide === 'front' ? 'white' : '#666',
                fontWeight: 'bold'
              }}>
                F
              </div>
              <span>Front</span>
            </button>
            
            {/* Back Side Button */}
            <button
              onClick={() => {
                setCurrentSide('back');
                setSelectedId(null); // Clear selection when switching
              }}
              style={{
                padding: '12px 16px',
                border: currentSide === 'back' ? '2px solid #6fd0f5' : '1px solid #e6e6e6',
                borderRadius: '4px',
                background: currentSide === 'back' ? '#f0fbff' : 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                fontSize: '14px',
                fontWeight: currentSide === 'back' ? 'bold' : 'normal'
              }}
              onMouseEnter={(e) => {
                if (currentSide !== 'back') {
                  e.currentTarget.style.background = '#f8f9fa';
                }
              }}
              onMouseLeave={(e) => {
                if (currentSide !== 'back') {
                  e.currentTarget.style.background = 'white';
                }
              }}
            >
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '4px',
                background: currentSide === 'back' ? '#6fd0f5' : '#e6e6e6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                color: currentSide === 'back' ? 'white' : '#666',
                fontWeight: 'bold'
              }}>
                B
              </div>
              <span>Back</span>
            </button>
          </div>
        </div>
        
        {/* Clipboard Indicator */}
        {clipboard && (
          <div style={{ 
            padding: '12px 16px', 
            background: '#f8f9fa',
            borderBottom: '1px solid #e6e6e6'
          }}>
            <div style={{
              fontSize: '12px',
              color: '#666',
              marginBottom: '4px'
            }}>
              Clipboard
            </div>
            <div style={{
              fontSize: '13px',
              color: '#000',
              marginBottom: '8px'
            }}>
              {clipboard.type} from {clipboard.sourceSide}
            </div>
            <button
              onClick={() => setClipboard(null)}
              style={{
                padding: '4px 8px',
                fontSize: '12px',
                background: 'white',
                border: '1px solid #e6e6e6',
                borderRadius: '3px',
                cursor: 'pointer',
                color: '#666'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f8f9fa';
                e.currentTarget.style.color = '#000';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'white';
                e.currentTarget.style.color = '#666';
              }}
            >
              Clear
            </button>
          </div>
        )}
      </div>
      
      {/* FontBrowser Modal */}
      <FontBrowser
        isOpen={showFontBrowser}
        onClose={() => setShowFontBrowser(false)}
        onSelectFont={handleFontChange}
        currentFont={(() => {
          const textEl = textElements.find(el => el.id === selectedId);
          const curvedEl = curvedTextElements.find(el => el.id === selectedId);
          const gradientEl = gradientTextElements.find(el => el.id === selectedId);
          return textEl?.fontFamily || curvedEl?.fontFamily || gradientEl?.fontFamily || DEFAULT_FONT;
        })()}
      />
      
      {/* MediaBrowser Modal */}
      <MediaBrowser
        isOpen={showMediaBrowser}
        onClose={() => setShowMediaBrowser(false)}
        onSelectImage={handleImageSelection}
        shop={window.__SHOP_DOMAIN__ || 'unknown'}
        sessionId={sessionId}
        customerId={customerId}
      />
    </div>
  );
};


export default DesignerCanvas;
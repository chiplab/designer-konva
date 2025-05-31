/**
 * Konva-based Template Renderer for Product Customization
 * This module renders templates using Konva for 100% consistency with the designer
 * Lazy-loaded to minimize impact on page performance
 */

if (typeof CanvasTextRenderer === 'undefined') {
  class CanvasTextRenderer {
  constructor(canvasContainer, options = {}) {
    this.container = typeof canvasContainer === 'string' 
      ? document.getElementById(canvasContainer) 
      : canvasContainer;
    this.template = null;
    this.textUpdates = {};
    this.stage = null;
    this.layer = null;
    this.backgroundLayer = null;
    this.designLayer = null;
    this.elements = {};
    this.images = {};
    this.apiUrl = options.apiUrl || '/apps/designer';
    this.onReady = options.onReady || (() => {});
    
    // Ensure Konva is loaded
    if (typeof Konva === 'undefined') {
      console.error('Konva is not loaded. Please include Konva before initializing CanvasTextRenderer.');
    }
  }

  async loadTemplate(templateId) {
    try {
      const response = await fetch(`${this.apiUrl}/template/${templateId}`);
      const data = await response.json();
      this.template = data.template;
      
      // Initialize Konva stage
      this.initializeStage();
      
      // Preload images
      await this.preloadImages();
      
      // Initial render
      this.render();
      this.onReady();
    } catch (error) {
      console.error('Failed to load template:', error);
    }
  }

  initializeStage() {
    const { dimensions } = this.template;
    
    // Create Konva stage
    this.stage = new Konva.Stage({
      container: this.container,
      width: dimensions.width,
      height: dimensions.height
    });
    
    // Create layers
    this.backgroundLayer = new Konva.Layer();
    this.designLayer = new Konva.Layer();
    
    this.stage.add(this.backgroundLayer);
    this.stage.add(this.designLayer);
  }

  async preloadImages() {
    const loadImage = (src) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });
    };

    // Load base image
    if (this.template.assets?.baseImage) {
      try {
        let imageUrl = this.template.assets.baseImage;
        if (imageUrl.startsWith('/media/')) {
          imageUrl = `${this.apiUrl}/assets${imageUrl}`;
        }
        this.images.base = await loadImage(imageUrl);
      } catch (error) {
        console.warn('Failed to load base image:', error);
      }
    }

    // Load additional images from imageElements
    if (this.template.elements?.imageElements) {
      for (const imgEl of this.template.elements.imageElements) {
        try {
          let imageUrl = imgEl.url;
          if (imageUrl.startsWith('/media/')) {
            imageUrl = `${this.apiUrl}/assets${imageUrl}`;
          }
          this.images[imgEl.id] = await loadImage(imageUrl);
        } catch (error) {
          console.warn(`Failed to load image ${imgEl.id}:`, error);
        }
      }
    }
  }

  updateText(elementId, newText) {
    this.textUpdates[elementId] = newText;
    
    // Instead of updating the existing element, we need to re-render
    // because curved text paths need to be recalculated based on text length
    this.render();
  }

  render() {
    if (!this.template) return;

    const { backgroundColor, designableArea, elements } = this.template;

    // Clear layers
    this.backgroundLayer.destroyChildren();
    this.designLayer.destroyChildren();

    // Draw base image on background layer
    if (this.images.base) {
      const baseImage = new Konva.Image({
        image: this.images.base,
        x: 0,
        y: 0,
        width: this.template.dimensions.width,
        height: this.template.dimensions.height
      });
      this.backgroundLayer.add(baseImage);
    }

    // Create clipping group for design area
    const clipGroup = new Konva.Group({
      clip: designableArea ? {
        x: designableArea.x,
        y: designableArea.y,
        width: designableArea.width,
        height: designableArea.height
      } : undefined
    });

    // If corner radius is needed, we'll use a custom clip function
    if (designableArea && designableArea.cornerRadius > 0) {
      clipGroup.clipFunc((ctx) => {
        const { x, y, width, height, cornerRadius } = designableArea;
        ctx.beginPath();
        ctx.moveTo(x + cornerRadius, y);
        ctx.arcTo(x + width, y, x + width, y + height, cornerRadius);
        ctx.arcTo(x + width, y + height, x, y + height, cornerRadius);
        ctx.arcTo(x, y + height, x, y, cornerRadius);
        ctx.arcTo(x, y, x + width, y, cornerRadius);
        ctx.closePath();
      });
    }

    // Draw background in clipped area
    if (backgroundColor && backgroundColor !== 'transparent' && designableArea) {
      let bgRect;
      
      if (backgroundColor === 'linear-gradient') {
        bgRect = new Konva.Rect({
          x: designableArea.x,
          y: designableArea.y,
          width: designableArea.width,
          height: designableArea.height,
          cornerRadius: designableArea.cornerRadius,
          fillLinearGradientStartPoint: { x: 0, y: 0 },
          fillLinearGradientEndPoint: { x: designableArea.width, y: 0 },
          fillLinearGradientColorStops: [0, '#c8102e', 1, '#ffaaaa']
        });
      } else if (backgroundColor === 'radial-gradient') {
        bgRect = new Konva.Rect({
          x: designableArea.x,
          y: designableArea.y,
          width: designableArea.width,
          height: designableArea.height,
          cornerRadius: designableArea.cornerRadius,
          fillRadialGradientStartPoint: { x: designableArea.width / 2, y: designableArea.height / 2 },
          fillRadialGradientEndPoint: { x: designableArea.width / 2, y: designableArea.height / 2 },
          fillRadialGradientStartRadius: 0,
          fillRadialGradientEndRadius: Math.min(designableArea.width, designableArea.height) / 2,
          fillRadialGradientColorStops: [0, '#c8102e', 1, '#ffaaaa']
        });
      } else {
        bgRect = new Konva.Rect({
          x: designableArea.x,
          y: designableArea.y,
          width: designableArea.width,
          height: designableArea.height,
          cornerRadius: designableArea.cornerRadius,
          fill: backgroundColor
        });
      }
      
      clipGroup.add(bgRect);
    }

    // Render images first (so text appears on top)
    elements.imageElements?.forEach(el => {
      if (this.images[el.id]) {
        const img = new Konva.Image({
          id: el.id,
          image: this.images[el.id],
          x: el.x,
          y: el.y,
          width: el.width,
          height: el.height,
          rotation: el.rotation || 0,
          scaleX: el.scaleX || 1,
          scaleY: el.scaleY || 1
        });
        clipGroup.add(img);
      }
    });

    // Render regular text elements
    elements.textElements?.forEach(el => {
      const text = this.textUpdates[el.id] || el.text;
      let textConfig = {
        id: el.id,
        text: text,
        x: el.x,
        y: el.y,
        fontSize: el.fontSize || 24,
        fontFamily: el.fontFamily || 'Arial',
        rotation: el.rotation || 0,
        scaleX: el.scaleX || 1,
        scaleY: el.scaleY || 1
      };

      // Handle fill
      if (el.fill === 'gold-gradient') {
        textConfig.fillLinearGradientStartPoint = { x: 0, y: 0 };
        textConfig.fillLinearGradientEndPoint = { x: 0, y: el.fontSize || 24 };
        textConfig.fillLinearGradientColorStops = [0, '#FFD700', 0.5, '#FFA500', 1, '#B8860B'];
      } else {
        textConfig.fill = el.fill || 'black';
      }

      // Handle stroke
      if (el.stroke && el.stroke !== 'transparent') {
        textConfig.stroke = el.stroke;
        textConfig.strokeWidth = el.strokeWidth || 2;
        textConfig.fillAfterStrokeEnabled = true;
      }

      const textNode = new Konva.Text(textConfig);
      clipGroup.add(textNode);
    });

    // Render gradient text elements
    elements.gradientTextElements?.forEach(el => {
      const text = this.textUpdates[el.id] || el.text;
      const textNode = new Konva.Text({
        id: el.id,
        text: text,
        x: el.x,
        y: el.y,
        fontSize: el.fontSize || 24,
        fontFamily: el.fontFamily || 'Arial',
        rotation: el.rotation || 0,
        scaleX: el.scaleX || 1,
        scaleY: el.scaleY || 1,
        fillLinearGradientStartPoint: { x: 0, y: 0 },
        fillLinearGradientEndPoint: { x: 0, y: el.fontSize || 24 },
        fillLinearGradientColorStops: [0, '#FFD700', 0.5, '#FFA500', 1, '#B8860B']
      });
      clipGroup.add(textNode);
    });

    // Render curved text elements
    elements.curvedTextElements?.forEach(el => {
      const text = this.textUpdates[el.id] || el.text;
      
      // Calculate center Y based on whether text is flipped
      const centerY = el.flipped 
        ? el.topY - el.radius
        : el.topY + el.radius;
      
      // Create group for curved text
      const group = new Konva.Group({
        id: el.id,
        x: el.x,
        y: centerY,
        rotation: el.rotation || 0,
        scaleX: el.scaleX || 1,
        scaleY: el.scaleY || 1
      });

      // Calculate text path
      const fontSize = el.fontSize || 20;
      const textLength = text.length * fontSize * 0.6;
      const angleSpan = Math.min(textLength / el.radius, Math.PI * 1.5);
      
      let startAngle, endAngle, sweepFlag;
      if (el.flipped) {
        startAngle = Math.PI/2 + angleSpan/2;
        endAngle = Math.PI/2 - angleSpan/2;
        sweepFlag = 0;
      } else {
        startAngle = -Math.PI/2 - angleSpan/2;
        endAngle = -Math.PI/2 + angleSpan/2;
        sweepFlag = 1;
      }
      
      const startX = Math.cos(startAngle) * el.radius;
      const startY = Math.sin(startAngle) * el.radius;
      const endX = Math.cos(endAngle) * el.radius;
      const endY = Math.sin(endAngle) * el.radius;
      
      const largeArcFlag = angleSpan > Math.PI ? 1 : 0;
      const pathData = `M ${startX},${startY} A ${el.radius},${el.radius} 0 ${largeArcFlag},${sweepFlag} ${endX},${endY}`;

      let textPathConfig = {
        text: text,
        data: pathData,
        fontSize: fontSize,
        fontFamily: el.fontFamily || 'Arial',
        align: 'center'
      };

      // Handle fill
      if (el.fill === 'gold-gradient') {
        textPathConfig.fillLinearGradientStartPoint = { x: 0, y: 0 };
        textPathConfig.fillLinearGradientEndPoint = { x: 0, y: fontSize };
        textPathConfig.fillLinearGradientColorStops = [0, '#FFD700', 0.5, '#FFA500', 1, '#B8860B'];
      } else {
        textPathConfig.fill = el.fill || 'black';
      }

      // Handle stroke
      if (el.stroke && el.stroke !== 'transparent') {
        textPathConfig.stroke = el.stroke;
        textPathConfig.strokeWidth = el.strokeWidth || 2;
        textPathConfig.fillAfterStrokeEnabled = true;
      }

      const textPath = new Konva.TextPath(textPathConfig);
      group.add(textPath);
      clipGroup.add(group);
    });

    // Add clip group to design layer
    this.designLayer.add(clipGroup);

    // Draw designable area outline if visible
    if (designableArea && designableArea.visible) {
      const outline = new Konva.Rect({
        x: designableArea.x,
        y: designableArea.y,
        width: designableArea.width,
        height: designableArea.height,
        cornerRadius: designableArea.cornerRadius,
        stroke: '#007bff',
        strokeWidth: 2,
        dash: [5, 5],
        fill: 'rgba(0, 123, 255, 0.1)',
        listening: false
      });
      this.designLayer.add(outline);
    }

    // Draw layers
    this.backgroundLayer.batchDraw();
    this.designLayer.batchDraw();
  }

  getDataURL(options = {}) {
    // Default options
    const defaultOptions = {
      pixelRatio: 1,
      designAreaOnly: false
    };
    const opts = { ...defaultOptions, ...options };
    
    if (opts.designAreaOnly && this.template?.designableArea) {
      // Return just the design area
      const { x, y, width, height } = this.template.designableArea;
      return this.stage.toDataURL({
        x: x,
        y: y,
        width: width,
        height: height,
        pixelRatio: opts.pixelRatio
      });
    }
    
    // Return full stage
    return this.stage.toDataURL({ pixelRatio: opts.pixelRatio });
  }
  
  // Convenience method to get just the design area at lower resolution
  getDesignAreaPreview(pixelRatio = 0.5) {
    return this.getDataURL({
      designAreaOnly: true,
      pixelRatio: pixelRatio
    });
  }

  getAllTextElements() {
    if (!this.template) return [];
    
    const { elements } = this.template;
    const allElements = [];

    elements.textElements?.forEach(el => {
      allElements.push({
        id: el.id,
        type: 'text',
        text: this.textUpdates[el.id] || el.text
      });
    });

    elements.gradientTextElements?.forEach(el => {
      allElements.push({
        id: el.id,
        type: 'gradient',
        text: this.textUpdates[el.id] || el.text
      });
    });

    elements.curvedTextElements?.forEach(el => {
      allElements.push({
        id: el.id,
        type: 'curved',
        text: this.textUpdates[el.id] || el.text
      });
    });

    return allElements;
  }

  destroy() {
    if (this.stage) {
      this.stage.destroy();
    }
  }
  }

  // Export for use in theme
  window.CanvasTextRenderer = CanvasTextRenderer;
}
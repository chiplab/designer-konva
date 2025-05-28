/**
 * Lightweight Canvas Text Renderer for Product Customization
 * This module renders Konva-created templates using only Canvas API
 * Bundle size target: ~15KB vs Konva's ~400KB
 */

class CanvasTextRenderer {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.template = null;
    this.textUpdates = {};
    this.images = {};
    this.apiUrl = options.apiUrl || '/apps/designer';
    this.onReady = options.onReady || (() => {});
  }

  async loadTemplate(templateId) {
    try {
      const response = await fetch(`${this.apiUrl}/template/${templateId}`);
      const data = await response.json();
      this.template = data.template;
      
      // Set canvas dimensions
      this.canvas.width = this.template.dimensions.width;
      this.canvas.height = this.template.dimensions.height;
      
      // Preload images
      await this.preloadImages();
      
      // Initial render
      this.render();
      this.onReady();
    } catch (error) {
      console.error('Failed to load template:', error);
    }
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
        // Convert local paths to app proxy URLs
        let imageUrl = this.template.assets.baseImage;
        if (imageUrl.startsWith('/media/')) {
          // Route through app proxy to handle CORS
          imageUrl = `${this.apiUrl}/assets${imageUrl}`;
        }
        this.images.base = await loadImage(imageUrl);
      } catch (error) {
        console.warn('Failed to load base image:', error);
      }
    }
  }

  updateText(elementId, newText) {
    this.textUpdates[elementId] = newText;
    this.render();
  }

  render() {
    if (!this.template) return;

    const { ctx, template } = this;
    const { dimensions, backgroundColor, designableArea, elements } = template;

    // Clear canvas
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    // Draw base image
    if (this.images.base) {
      ctx.drawImage(this.images.base, 0, 0, dimensions.width, dimensions.height);
    }

    // Set up clipping for designable area
    if (designableArea && !designableArea.visible) {
      ctx.save();
      this.createClippingPath(designableArea);
      ctx.clip();
    }

    // Draw background if set
    if (backgroundColor && backgroundColor !== 'transparent') {
      this.drawBackground(backgroundColor, designableArea || dimensions);
    }

    // Draw text elements
    elements.textElements?.forEach(el => {
      const text = this.textUpdates[el.id] || el.text;
      this.drawText({ ...el, text });
    });

    // Draw gradient text elements
    elements.gradientTextElements?.forEach(el => {
      const text = this.textUpdates[el.id] || el.text;
      this.drawGradientText({ ...el, text });
    });

    // Draw curved text elements
    elements.curvedTextElements?.forEach(el => {
      const text = this.textUpdates[el.id] || el.text;
      this.drawCurvedText({ ...el, text });
    });

    // Restore clipping
    if (designableArea && !designableArea.visible) {
      ctx.restore();
    }
  }

  createClippingPath(area) {
    const { ctx } = this;
    const { x, y, width, height, cornerRadius } = area;

    ctx.beginPath();
    if (cornerRadius > 0) {
      // Rounded rectangle
      ctx.moveTo(x + cornerRadius, y);
      ctx.arcTo(x + width, y, x + width, y + height, cornerRadius);
      ctx.arcTo(x + width, y + height, x, y + height, cornerRadius);
      ctx.arcTo(x, y + height, x, y, cornerRadius);
      ctx.arcTo(x, y, x + width, y, cornerRadius);
    } else {
      ctx.rect(x, y, width, height);
    }
    ctx.closePath();
  }

  drawBackground(backgroundColor, area) {
    const { ctx } = this;

    if (backgroundColor.includes('gradient')) {
      // Handle gradients later if needed
      ctx.fillStyle = '#ffffff';
    } else {
      ctx.fillStyle = backgroundColor;
    }

    this.createClippingPath(area);
    ctx.fill();
  }

  drawText(element) {
    const { ctx } = this;
    const { text, x, y, fontFamily = 'Arial', fontSize = 24 } = element;

    ctx.save();
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.fillStyle = element.fill || 'black';
    ctx.textBaseline = 'top';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  drawGradientText(element) {
    const { ctx } = this;
    const { text, x, y, fontFamily = 'Arial', fontSize = 24 } = element;

    // Create gradient (matching Konva's gold gradient)
    const gradient = ctx.createLinearGradient(x, y, x, y + fontSize);
    gradient.addColorStop(0, '#FFD700');
    gradient.addColorStop(0.5, '#FFA500');
    gradient.addColorStop(1, '#B8860B');

    ctx.save();
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.fillStyle = gradient;
    ctx.textBaseline = 'top';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  drawCurvedText(element) {
    const { ctx } = this;
    const { text, x, topY, radius, flipped, fontFamily = 'Arial', fontSize = 20 } = element;

    // Calculate center Y based on whether text is flipped
    const centerY = flipped 
      ? topY - radius  // Bottom edge stays at topY
      : topY + radius; // Top edge stays at topY

    ctx.save();
    ctx.translate(x, centerY);
    
    // Set up text properties to match Konva
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.fillStyle = element.fill || 'black';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Measure the actual text width
    const measuredWidth = ctx.measureText(text).width;
    
    // Use a more accurate angle calculation
    // Konva seems to use a tighter spacing than text.length * 12
    const angleSpan = measuredWidth / radius;
    
    // Create the path for the text - matching Konva exactly
    let startAngle;
    if (flipped) {
      // Bottom arc - text reads left to right along bottom
      startAngle = Math.PI/2 + angleSpan/2;
    } else {
      // Top arc - text reads left to right along top
      startAngle = -Math.PI/2 - angleSpan/2;
    }

    // Measure individual character widths for accurate positioning
    const chars = text.split('');
    const charWidths = chars.map(char => ctx.measureText(char).width);
    
    // Calculate positions for each character
    let currentDistance = 0;
    
    chars.forEach((char, i) => {
      ctx.save();
      
      // Calculate the angle for the center of this character
      const charCenterDistance = currentDistance + charWidths[i] / 2;
      const charAngle = charCenterDistance / radius;
      
      let angle;
      if (flipped) {
        // For flipped text, go clockwise from top
        angle = startAngle - charAngle;
      } else {
        // For normal text, go clockwise from top
        angle = startAngle + charAngle;
      }
      
      // Calculate position
      const charX = Math.cos(angle) * radius;
      const charY = Math.sin(angle) * radius;
      
      // Move to character position
      ctx.translate(charX, charY);
      
      // Rotate to follow the curve
      ctx.rotate(angle + Math.PI/2);
      
      // Draw character
      ctx.fillText(char, 0, 0);
      
      ctx.restore();
      
      // Move to next character position
      currentDistance += charWidths[i];
    });

    ctx.restore();
  }

  getDataURL() {
    return this.canvas.toDataURL('image/png');
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
}

// Export for use in theme
window.CanvasTextRenderer = CanvasTextRenderer;
/**
 * Product Customizer Modal
 * Provides a slide-out modal interface for simple text customization
 */

if (typeof ProductCustomizerModal === 'undefined') {
  class ProductCustomizerModal {
  constructor(options = {}) {
    this.options = {
      variantId: options.variantId,
      templateId: options.templateId,
      apiUrl: options.apiUrl || '/apps/designer',
      onSave: options.onSave || (() => {}),
      productImageUrl: options.productImageUrl || null,
      ...options
    };
    
    this.modal = null;
    this.renderer = null;
    this.isOpen = false;
    this.customizationData = null;
    this.updateTimer = null;
    this.hasProductImage = false; // Track if we're using product image as preview
    this.originalProductImages = []; // Store original images to restore later
    this.currentPreviewUrl = null; // Store current preview URL
  }

  init() {
    this.createModal();
    this.attachEventListeners();
  }

  createModal() {
    const modalHTML = `
      <div class="product-customizer-modal" id="productCustomizerModal">
        <div class="pcm-overlay"></div>
        <div class="pcm-panel">
          <button class="pcm-close" aria-label="Close customizer">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" stroke-width="2"/>
            </svg>
          </button>
          
          <div class="pcm-content">
            <div style="display: none;">
              <div id="customizer-canvas"></div>
              <img id="preview-image" alt="Product preview" />
            </div>
            
            <div class="pcm-controls">
              <div class="pcm-text-inputs">
                <!-- Text inputs will be dynamically inserted here -->
              </div>
              
              <div class="pcm-actions">
                <button class="pcm-btn pcm-btn-secondary" id="customizeMore">
                  Advanced Editor
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M6 12l4-4-4-4" stroke="currentColor" stroke-width="2"/>
                  </svg>
                </button>
                <button class="pcm-btn pcm-btn-primary" id="saveCustomization">
                  Add to Cart
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modal = document.getElementById('productCustomizerModal');

    // Add styles
    this.injectStyles();
  }

  injectStyles() {
    const styles = `
      <style>
        .product-customizer-modal {
          display: none;
        }

        .product-customizer-modal.open {
          display: block;
        }

        .pcm-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.3);
          animation: fadeIn 0.3s ease-out;
          z-index: 999998;
          display: none; /* Hide overlay on desktop */
        }
        
        @media (max-width: 749px) {
          .pcm-overlay {
            display: block; /* Show overlay on mobile */
          }
        }

        .pcm-panel {
          position: fixed;
          right: 0;
          top: 0;
          width: 100%;
          height: 100%;
          background: white;
          box-shadow: -4px 0 15px rgba(0, 0, 0, 0.15);
          transform: translateX(100%);
          transition: transform 0.3s ease-out;
          overflow-y: auto;
          z-index: 999999;
          border-left: 1px solid #e5e5e5;
        }
        
        /* Target the product info wrapper specifically */
        @supports (container-type: inline-size) {
          .product__info-wrapper,
          .product__info,
          .product-single__info-wrapper,
          [data-product-info] {
            container-type: inline-size;
          }
        }
        
        /* Calculate position based on product info section */
        .product__info-wrapper ~ .product-customizer-modal .pcm-panel,
        .product__info ~ .product-customizer-modal .pcm-panel,
        .product-single__info-wrapper ~ .product-customizer-modal .pcm-panel,
        [data-product-info] ~ .product-customizer-modal .pcm-panel {
          width: 40%;
          min-width: 400px;
          max-width: 600px;
        }
        
        /* Find and position relative to product info */
        @media (min-width: 750px) {
          .pcm-panel {
            width: calc(50% - 20px);
            max-width: 600px;
            right: 0;
          }
        }

        .product-customizer-modal.open .pcm-panel {
          transform: translateX(0);
        }

        /* Header styles removed as header is no longer in the markup */

        .pcm-close {
          position: absolute;
          top: 12px;
          right: 12px;
          background: white;
          border: 1px solid #ddd;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #666;
          transition: all 0.2s;
          z-index: 10;
        }

        .pcm-close:hover {
          color: #000;
          background: #f5f5f5;
          border-color: #999;
        }

        .pcm-content {
          padding: 24px;
          height: 100%;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
        }

        .pcm-controls {
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .pcm-text-inputs {
          flex: 1;
          overflow-y: auto;
          margin-bottom: 20px;
          padding-right: 10px;
        }

        .pcm-text-field {
          margin-bottom: 16px;
        }

        .pcm-text-field label {
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
          color: #333;
        }

        .pcm-text-field input {
          width: 100%;
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 16px;
          transition: border-color 0.2s;
        }

        .pcm-text-field input:focus {
          outline: none;
          border-color: #000;
        }

        .pcm-actions {
          display: flex;
          gap: 12px;
          justify-content: space-between;
          padding-top: 20px;
          border-top: 1px solid #e5e5e5;
        }

        .pcm-btn {
          padding: 12px 20px;
          border: none;
          border-radius: 4px;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .pcm-btn-primary {
          background: #000;
          color: white;
          flex: 1;
        }

        .pcm-btn-primary:hover {
          background: #333;
        }

        .pcm-btn-secondary {
          background: white;
          color: #000;
          border: 1px solid #ddd;
        }

        .pcm-btn-secondary:hover {
          background: #f5f5f5;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @media (max-width: 749px) {
          .pcm-panel {
            width: 100%;
            max-width: none;
          }
          
          .pcm-content {
            padding: 20px;
          }
        }
      </style>
    `;

    document.head.insertAdjacentHTML('beforeend', styles);
  }

  attachEventListeners() {
    // Close button
    this.modal.querySelector('.pcm-close').addEventListener('click', () => this.close());
    
    // Overlay click
    this.modal.querySelector('.pcm-overlay').addEventListener('click', () => this.close());
    
    // Save button
    document.getElementById('saveCustomization').addEventListener('click', () => this.save());
    
    // Customize More button
    document.getElementById('customizeMore').addEventListener('click', () => this.openFullDesigner());
    
    // Resize handler to reposition modal
    this.resizeHandler = () => {
      if (this.isOpen) {
        this.positionModal();
      }
    };
    window.addEventListener('resize', this.resizeHandler);
  }

  async open() {
    // Try to position the modal relative to product info section
    this.positionModal();
    
    this.modal.classList.add('open');
    this.isOpen = true;
    document.body.style.overflow = 'hidden';
    
    // Store original product image so we can restore it later
    this.storeOriginalProductImage();
    
    // First, show the product variant image if available
    await this.loadVariantImage();
    
    // Update the main product image to show the template preview
    this.updateMainProductImage();
    
    // Load Konva if not already loaded
    if (typeof Konva === 'undefined') {
      await this.loadKonva();
    }
    
    // Initialize renderer
    const canvasContainer = document.getElementById('customizer-canvas');
    this.renderer = new CanvasTextRenderer(canvasContainer, {
      apiUrl: this.options.apiUrl,
      onReady: () => this.onRendererReady()
    });
    
    // Load template
    await this.renderer.loadTemplate(this.options.templateId);
  }
  
  storeOriginalProductImage() {
    // Find all product images on the page and store their original sources
    const productImages = document.querySelectorAll(
      '.product__media img, ' +
      '.product-photo-container img, ' +
      '[data-product-featured-image], ' +
      '.product__main-photos img, ' +
      '.product-single__photo img'
    );
    
    this.originalProductImages = Array.from(productImages).map(img => ({
      element: img,
      originalSrc: img.src,
      originalSrcset: img.srcset
    }));
  }
  
  updateMainProductImage() {
    if (!this.currentPreviewUrl) return;
    
    // Update all product images to show the preview
    this.originalProductImages.forEach(({element}) => {
      element.src = this.currentPreviewUrl;
      if (element.srcset) {
        element.srcset = ''; // Clear srcset to prevent responsive image issues
      }
    });
  }
  
  restoreOriginalProductImages() {
    // Restore all product images to their original sources
    this.originalProductImages.forEach(({element, originalSrc, originalSrcset}) => {
      element.src = originalSrc;
      if (originalSrcset) {
        element.srcset = originalSrcset;
      }
    });
  }
  
  async loadVariantImage() {
    try {
      const previewImage = document.getElementById('preview-image');
      
      // First check if a product image URL was provided in options
      if (this.options.productImageUrl) {
        previewImage.src = this.options.productImageUrl;
        previewImage.style.display = 'block';
        this.hasProductImage = true;
        this.currentPreviewUrl = this.options.productImageUrl;
        return;
      }
      
      // Try to get the variant image from Shopify's product data
      if (window.ShopifyAnalytics && window.ShopifyAnalytics.meta && window.ShopifyAnalytics.meta.product) {
        const product = window.ShopifyAnalytics.meta.product;
        const variant = product.variants.find(v => v.id == this.options.variantId);
        
        if (variant && variant.featured_image) {
          previewImage.src = variant.featured_image.src;
          previewImage.style.display = 'block';
          this.hasProductImage = true;
          this.currentPreviewUrl = variant.featured_image.src;
          return;
        }
      }
      
      // Fallback: Try to get the current product image from the page
      const productImages = document.querySelectorAll('[data-product-featured-image], .product__media img, .product-photo-container img');
      if (productImages.length > 0) {
        previewImage.src = productImages[0].src;
        previewImage.style.display = 'block';
        this.hasProductImage = true;
        this.currentPreviewUrl = productImages[0].src;
        return;
      }
      
      // If no image found, we'll show the canvas preview later
      console.log('No product image found, will use canvas preview');
      this.hasProductImage = false;
    } catch (error) {
      console.warn('Could not load variant image:', error);
    }
  }
  
  async loadKonva() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/konva@9/konva.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  onRendererReady() {
    // Create text input fields
    this.createTextInputs();
    
    // If we don't have a product image, show the canvas preview
    if (!this.hasProductImage) {
      this.updatePreview();
    }
  }
  
  updatePreview() {
    const previewImage = document.getElementById('preview-image');
    if (!this.renderer || !previewImage) return;
    
    // Generate preview at 50% resolution
    const dataUrl = this.renderer.getDataURL({ pixelRatio: 0.5 });
    previewImage.src = dataUrl;
    previewImage.style.display = 'block';
    
    // Update the current preview URL and main product image
    this.currentPreviewUrl = dataUrl;
    this.updateMainProductImage();
  }
  
  debouncedUpdatePreview() {
    // Clear existing timer
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
    }
    
    // Set new timer
    this.updateTimer = setTimeout(() => {
      this.updatePreview();
    }, 500); // 500ms delay for better performance
  }

  createTextInputs() {
    const textInputsContainer = this.modal.querySelector('.pcm-text-inputs');
    const textElements = this.renderer.getAllTextElements();
    
    textInputsContainer.innerHTML = textElements.map((element, index) => `
      <div class="pcm-text-field">
        <label for="text-${element.id}">
          ${element.type === 'curved' ? 'Curved Text' : 
            element.type === 'gradient' ? 'Gradient Text' : 
            `Text ${index + 1}`}
        </label>
        <input 
          type="text" 
          id="text-${element.id}" 
          data-element-id="${element.id}"
          value="${element.text}"
          placeholder="Enter your text here"
        />
      </div>
    `).join('');
    
    // Attach input listeners
    textInputsContainer.querySelectorAll('input').forEach(input => {
      input.addEventListener('input', (e) => {
        this.renderer.updateText(e.target.dataset.elementId, e.target.value);
        this.debouncedUpdatePreview();
      });
    });
  }

  positionModal() {
    // Find the product info wrapper element
    const productInfo = document.querySelector(
      '.product__info-wrapper, .product__info, .product-single__info-wrapper, [data-product-info]'
    );
    
    if (productInfo) {
      // Get the position and dimensions of the product info section
      const rect = productInfo.getBoundingClientRect();
      const panel = this.modal.querySelector('.pcm-panel');
      
      // Position the panel to cover just the product info area
      if (window.innerWidth > 749) {
        // Set horizontal position and width
        panel.style.width = `${rect.width}px`;
        panel.style.left = `${rect.left}px`;
        panel.style.right = 'auto';
        
        // Set vertical position and height to match the product info section
        panel.style.top = `${rect.top + window.scrollY}px`;
        panel.style.height = `${rect.height}px`;
        panel.style.maxHeight = `${rect.height}px`;
      } else {
        // Reset to full viewport on mobile
        panel.style.width = '100%';
        panel.style.left = '';
        panel.style.right = '0';
        panel.style.top = '0';
        panel.style.height = '100%';
        panel.style.maxHeight = '';
      }
    }
  }
  
  close() {
    this.modal.classList.remove('open');
    this.isOpen = false;
    document.body.style.overflow = '';
    
    // Restore original product images
    this.restoreOriginalProductImages();
    
    // Clear any pending update timer
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = null;
    }
    
    // Clean up renderer
    if (this.renderer) {
      this.renderer.destroy();
      this.renderer = null;
    }
  }

  async save() {
    // Get all text updates
    const textElements = this.renderer.getAllTextElements();
    const customization = {
      templateId: this.options.templateId,
      variantId: this.options.variantId,
      textUpdates: {},
      preview: this.renderer.getDesignAreaPreview(0.5), // Just the design area at 50% resolution
      fullPreview: this.renderer.getDataURL({ pixelRatio: 0.5 }) // Full preview at 50% resolution
    };
    
    textElements.forEach(el => {
      customization.textUpdates[el.id] = el.text;
    });
    
    // Save to cart or handle as needed
    this.customizationData = customization;
    this.options.onSave(customization);
    this.close();
  }

  openFullDesigner() {
    // Save current state
    const currentState = {
      templateId: this.options.templateId,
      variantId: this.options.variantId,
      textUpdates: {}
    };
    
    this.renderer.getAllTextElements().forEach(el => {
      currentState.textUpdates[el.id] = el.text;
    });
    
    // Encode state for URL
    const stateParam = btoa(JSON.stringify(currentState));
    
    // Navigate to full designer
    window.location.href = `/apps/designer/customizer/full?state=${stateParam}`;
  }
  }

  // Export for use in theme
  window.ProductCustomizerModal = ProductCustomizerModal;
}
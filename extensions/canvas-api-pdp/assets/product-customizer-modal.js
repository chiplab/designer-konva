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
                <button class="pcm-btn pcm-btn-primary" id="saveCustomization">
                  Add to Cart
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Find the product details container
    const productDetails = document.querySelector('.product-details');
    
    if (productDetails && window.innerWidth > 749) {
      // For desktop, inject into product details
      productDetails.insertAdjacentHTML('beforeend', modalHTML);
    } else {
      // For mobile or if product details not found, add to body
      document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    
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
          position: absolute;
          width: 100%;
          height: 100%;
          background: white;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          transform: translateX(100%);
          transition: transform 0.3s ease-out;
          overflow-y: auto;
          z-index: 100;
          border: 1px solid #e5e5e5;
          border-radius: 8px;
        }
        
        /* Make product details container relative for absolute positioning */
        .product-details {
          position: relative !important;
        }
        
        /* When modal is injected into product details */
        .product-details .product-customizer-modal {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 99;
        }
        
        /* Full width panel within product details */
        .product-details .pcm-panel {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          max-width: none;
          border-radius: 8px;
        }
        
        @media (max-width: 749px) {
          .pcm-panel {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            max-width: none;
            border-radius: 0;
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
          max-height: calc(100vh - 200px);
        }
        
        @media (min-width: 750px) {
          .product-details .pcm-text-inputs {
            max-height: calc(100% - 100px);
          }
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
          justify-content: flex-end;
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
          min-width: 150px;
        }

        .pcm-btn-primary:hover {
          background: #333;
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
  }

  async open() {
    this.modal.classList.add('open');
    this.isOpen = true;
    
    // Only prevent body scroll on mobile
    if (window.innerWidth <= 749) {
      document.body.style.overflow = 'hidden';
    }
    
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
    // Find the main product section first (exclude recommendations)
    const mainProductSection = document.querySelector(
      // Modern theme patterns
      '.product-information, ' +
      '.product-details, ' +
      '[data-product-info], ' +
      '.product-info, ' +
      // Standard patterns
      'section.product:not(.product-recommendations), ' +
      '[data-section-type="product"]:not([data-section-type="related-products"]), ' +
      '.product-section:not(.product-recommendations), ' +
      'main .product, ' +
      '#MainContent .product, ' +
      // Additional patterns
      '.shopify-section.product-section, ' +
      '.product-template, ' +
      '#product-template, ' +
      // More generic patterns
      '[class*="product-info"], ' +
      '[class*="product__info"]'
    );
    
    let mainProductImage = null;
    
    if (mainProductSection) {
      // Search for the active/featured image ONLY within the main product section
      mainProductImage = mainProductSection.querySelector(
        // Modern theme selectors (Horizons 2025)
        '.media-gallery img:first-of-type, ' +
        '.product-media img:first-of-type, ' +
        '.media img:first-of-type, ' +
        '[data-media-type] img:first-of-type, ' +
        // Active/selected images
        '[data-media-type="image"][data-media-active="true"] img, ' +
        '[data-product-media].is-active img, ' +
        '.product-media.is-active img, ' +
        '.media-gallery__image.is-active img, ' +
        '.media.is-active img, ' +
        // Featured/main images
        '.product__media--featured img, ' +
        '.product__main-photos .slick-current img, ' +
        '.product-single__photo--main img, ' +
        '[data-product-featured-image], ' +
        // Gallery patterns
        '.product-gallery img:first-of-type, ' +
        '.product-images img:first-of-type'
      );
      
      // If no active image, get the first visible product image in the section
      if (!mainProductImage) {
        mainProductImage = mainProductSection.querySelector(
          'img:not([data-role="thumb"]):not(.thumbnail):not([width="100"]):not([width="150"]):first-of-type'
        );
      }
    } else {
      // Fallback: look for product images but exclude recommendation sections
      // Get all images that are likely to be product images (based on size and position)
      const allImagesOnPage = document.querySelectorAll('img');
      
      for (const img of allImagesOnPage) {
        // Skip small images (likely thumbnails) - but only if dimensions are actually loaded
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          if (img.naturalWidth < 150 && img.naturalHeight < 150) {
            continue;
          }
        }
        // Also check rendered size if natural size not available
        else if (img.width > 0 && img.height > 0) {
          if (img.width < 150 && img.height < 150) {
            continue;
          }
        }
        
        // Skip images in recommendation sections
        const isInRecommendations = img.closest(
          '.product-recommendations, ' +
          '.related-products, ' +
          '[data-section-type="related-products"], ' +
          '[data-section-type="product-recommendations"], ' +
          '.recommendation-products, ' +
          '.recommended-products, ' +
          '.recently-viewed, ' +
          '.also-like, ' +
          '.upsell'
        );
        
        if (isInRecommendations) {
          continue;
        }
        
        // Skip images in header/footer
        const isInHeaderFooter = img.closest('header, footer, nav');
        if (isInHeaderFooter) {
          continue;
        }
        
        // If we get here, this is likely a main product image
        mainProductImage = img;
        break;
      }
    }
    
    if (mainProductImage) {
      // Final check: make sure we're not selecting a recommendation product image
      const isRecommendation = mainProductImage.closest(
        '.product-recommendations, ' +
        '.related-products, ' +
        '[data-section-type="related-products"], ' +
        '.recommendation-products, ' +
        '.recommended-products'
      );
      
      if (isRecommendation) {
        this.originalProductImages = [];
        return;
      }
      
      this.originalProductImages = [{
        element: mainProductImage,
        originalSrc: mainProductImage.src,
        originalSrcset: mainProductImage.srcset
      }];
    } else {
      this.originalProductImages = [];
    }
  }
  
  updateMainProductImage() {
    if (!this.currentPreviewUrl || this.originalProductImages.length === 0) {
      return;
    }
    
    // Update only the main product image to show the preview
    const mainImage = this.originalProductImages[0];
    if (mainImage && mainImage.element) {
      // Double-check this isn't a recommendation image before updating
      const isRecommendation = mainImage.element.closest('.product-recommendations, .related-products, [data-section-type="related-products"]');
      if (isRecommendation) {
        return;
      }
      
      mainImage.element.src = this.currentPreviewUrl;
      if (mainImage.element.srcset) {
        mainImage.element.srcset = ''; // Clear srcset to prevent responsive image issues
      }
      
      // Add a data attribute to mark this as the customization preview
      mainImage.element.setAttribute('data-customization-preview', 'true');
      
    }
  }
  
  restoreOriginalProductImages() {
    // Restore the main product image to its original source
    this.originalProductImages.forEach(({element, originalSrc, originalSrcset}) => {
      if (element && document.contains(element)) {
        // Only restore if element is still in the DOM
        element.src = originalSrc;
        if (originalSrcset) {
          element.srcset = originalSrcset;
        }
        // Remove the customization preview marker
        element.removeAttribute('data-customization-preview');
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
      const productImages = document.querySelectorAll(
        '[data-media-type="image"] img, [data-product-media] img, ' +
        '[data-product-featured-image], .product__media img, .product-photo-container img'
      );
      if (productImages.length > 0) {
        previewImage.src = productImages[0].src;
        previewImage.style.display = 'block';
        this.hasProductImage = true;
        this.currentPreviewUrl = productImages[0].src;
        return;
      }
      
      // If no image found, we'll show the canvas preview later
      this.hasProductImage = false;
    } catch (error) {
      // Could not load variant image
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

  // Remove positionModal method as we're using CSS positioning within product-details
  
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

  }

  // Export for use in theme
  window.ProductCustomizerModal = ProductCustomizerModal;
}
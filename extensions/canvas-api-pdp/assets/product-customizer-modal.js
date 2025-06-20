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
    this.savedTextUpdates = null; // Store saved text updates
    this.textSaveTimer = null; // Timer for auto-saving text state
  }

  init() {
    this.createModal();
    this.attachEventListeners();
    this.setupMessageListener();
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
                <button class="pcm-btn pcm-btn-primary pcm-btn-full-width" id="saveCustomization">
                  Done
                </button>
                <button class="pcm-btn pcm-btn-secondary pcm-btn-full-width" id="advancedEditor">
                  Edit using Design Tool
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
          flex-direction: column;
          gap: 12px;
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
          justify-content: center;
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

        .pcm-btn-secondary {
          background: white;
          color: #000;
          border: 1px solid #000;
          min-width: 150px;
        }

        .pcm-btn-secondary:hover {
          background: #f5f5f5;
        }
        
        .pcm-btn-full-width {
          width: 100%;
          text-align: center;
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
    this.modal.querySelector('.pcm-close').addEventListener('click', () => this.close(false));
    
    // Overlay click
    this.modal.querySelector('.pcm-overlay').addEventListener('click', () => this.close(false));
    
    // Save button
    document.getElementById('saveCustomization').addEventListener('click', () => this.save());
    
    // Advanced editor button
    document.getElementById('advancedEditor').addEventListener('click', () => this.openAdvancedEditor());
  }

  async open() {
    this.modal.classList.add('open');
    this.isOpen = true;
    
    // Only prevent body scroll on mobile
    if (window.innerWidth <= 749) {
      document.body.style.overflow = 'hidden';
    }
    
    // First check for global canvas state from full designer
    const globalStateKey = `customization_global_state`;
    const savedGlobalState = localStorage.getItem(globalStateKey);
    let globalCanvasState = null;
    let globalTemplateColors = null;
    
    if (savedGlobalState) {
      try {
        const globalData = JSON.parse(savedGlobalState);
        // Check if data is less than 30 days old
        if (globalData.timestamp && Date.now() - globalData.timestamp < 30 * 24 * 60 * 60 * 1000) {
          console.log('[ProductCustomizer] Found global canvas state from full designer');
          globalCanvasState = globalData.canvasState;
          globalTemplateColors = globalData.templateColors;
          // Store template colors globally for batch renderer
          if (globalTemplateColors) {
            window.__TEMPLATE_COLORS__ = globalTemplateColors;
          }
        }
      } catch (e) {
        console.error('Error loading global canvas state:', e);
      }
    }
    
    // Then check for global text state (shared across ALL variants) - legacy support
    const globalTextState = this.loadTextState();
    let savedTextUpdates = null;
    
    if (!globalCanvasState && globalTextState && globalTextState.textUpdates) {
      savedTextUpdates = globalTextState.textUpdates;
      this.savedTextUpdates = globalTextState.textUpdates;
    }
    
    // Then check if we have a saved customization for this specific variant
    const customizationKey = `customization_${this.options.variantId}`;
    const savedCustomization = localStorage.getItem(customizationKey);
    let loadDesignId = null;
    
    if (savedCustomization) {
      try {
        const customizationData = JSON.parse(savedCustomization);
        // Use saved design if it's less than 30 days old
        if (customizationData.timestamp && Date.now() - customizationData.timestamp < 30 * 24 * 60 * 60 * 1000) {
          loadDesignId = customizationData.designId;
          this.currentDesignId = customizationData.designId;
          if (customizationData.thumbnail) {
            this.currentPreviewUrl = customizationData.thumbnail;
          }
          // Only use variant-specific text if we don't have pattern text
          if (!savedTextUpdates && customizationData.textUpdates) {
            savedTextUpdates = customizationData.textUpdates;
            this.savedTextUpdates = customizationData.textUpdates;
          }
        }
      } catch (e) {
        console.error('Error parsing saved customization:', e);
      }
    }
    
    // Store original product image so we can restore it later
    this.storeOriginalProductImage();
    
    // If we have a saved customization with variant-specific preview, use it
    // Otherwise, we'll generate a new preview with the saved text
    if (this.currentPreviewUrl && !globalTextState) {
      // We have a variant-specific preview and no global text override
      const previewImage = document.getElementById('preview-image');
      if (previewImage) {
        previewImage.src = this.currentPreviewUrl;
        previewImage.style.display = 'block';
      }
    } else {
      // Show the product variant image first
      await this.loadVariantImage();
      // If we have global text, we'll generate a new preview after loading
    }
    
    // Update the main product image to show the saved preview or template preview
    if (this.currentPreviewUrl) {
      this.updateMainProductImage();
    }
    
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
    
    // Load design or template
    if (loadDesignId) {
      // Load the saved design
      await this.renderer.loadDesign(loadDesignId);
    } else {
      // Load template
      await this.renderer.loadTemplate(this.options.templateId);
    }
    
    // Apply global canvas state if available (from full designer)
    if (globalCanvasState) {
      console.log('[ProductCustomizer] Applying global canvas state from full designer');
      // Wait a moment for the template to fully load
      setTimeout(() => {
        // Load the full canvas state
        this.renderer.loadCanvasState(globalCanvasState);
        
        // Update the preview
        this.updatePreview();
        
        // Generate multi-variant previews with the saved state
        setTimeout(() => {
          this.currentPreviewUrl = this.renderer.getDataURL({ pixelRatio: 0.5 });
          this.updateMainProductImage();
          this.updateVariantSwatches();
          
          // Generate all variant previews
          if (window.__TEMPLATE_COLORS__ && window.__TEMPLATE_COLORS__.length > 0) {
            this.generateAllColorVariantPreviews(globalCanvasState);
          }
        }, 200);
      }, 100);
    }
    // Apply saved text updates if available (legacy support)
    else if (savedTextUpdates) {
      // Wait a moment for the template to fully load
      setTimeout(() => {
        Object.keys(savedTextUpdates).forEach(elementId => {
          this.renderer.updateText(elementId, savedTextUpdates[elementId]);
        });
        // Update the preview after applying text changes
        this.updatePreview();
        
        // If we applied global text, always generate a new preview for this variant
        if (globalTextState) {
          setTimeout(() => {
            this.currentPreviewUrl = this.renderer.getDataURL({ pixelRatio: 0.5 });
            this.updateMainProductImage();
            this.updateVariantSwatches();
            
            // Also generate multi-variant previews if we have the color data
            if (window.__TEMPLATE_COLORS__ && window.__TEMPLATE_COLORS__.length > 0) {
              const canvasState = this.renderer.getCanvasState();
              this.generateAllColorVariantPreviews(canvasState);
            }
          }, 200);
        }
      }, 100);
    }
  }
  
  storeOriginalProductImage() {
    // Check if we already have a customization preview showing
    const customizedImage = document.querySelector('[data-customization-preview="true"]');
    if (customizedImage && customizedImage.dataset.originalSrc) {
      // Use the original source that was stored before customization
      this.originalProductImages = [{
        element: customizedImage,
        originalSrc: customizedImage.dataset.originalSrc,
        originalSrcset: customizedImage.srcset
      }];
      return;
    }
    
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
    if (!this.currentPreviewUrl) {
      return;
    }
    
    // If we have original images stored, use them
    if (this.originalProductImages.length > 0) {
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
        // Store the original source for later restoration
        if (!mainImage.element.dataset.originalSrc) {
          mainImage.element.dataset.originalSrc = mainImage.originalSrc;
        }
      }
    } else {
      // No original images stored, find the main product image directly
      const mainProductImage = document.querySelector(
        '.media-gallery img:first-of-type, ' +
        '.product-media img:first-of-type, ' +
        '.product__media--featured img, ' +
        '[data-product-featured-image], ' +
        '.product-gallery img:first-of-type'
      );
      
      if (mainProductImage) {
        // Store original source if not already stored
        if (!mainProductImage.dataset.originalSrc) {
          mainProductImage.dataset.originalSrc = mainProductImage.src;
        }
        mainProductImage.src = this.currentPreviewUrl;
        mainProductImage.srcset = ''; // Clear srcset
        mainProductImage.setAttribute('data-customization-preview', 'true');
      }
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
    
    // Also restore variant swatches
    this.restoreOriginalVariantSwatches();
  }
  
  updateVariantSwatches() {
    if (!this.currentPreviewUrl) return;
    
    console.log('[ProductCustomizer] Updating variant swatches for variant:', this.options.variantId);
    
    // First, find the currently selected color input
    const selectedInput = document.querySelector('input[type="radio"]:checked[name*="Color"]');
    if (!selectedInput) {
      console.log('[ProductCustomizer] No selected color input found');
      return;
    }
    
    const selectedColor = selectedInput.value;
    console.log('[ProductCustomizer] Selected color:', selectedColor);
    
    // In Horizon themes, swatches use CSS background images on span elements
    // The structure is: input + span.swatch with style="--swatch-background: url(...)"
    const swatchSpan = selectedInput.nextElementSibling;
    
    if (swatchSpan && swatchSpan.classList.contains('swatch')) {
      console.log('[ProductCustomizer] Found swatch span element');
      
      // Store the original background if not already stored
      if (!swatchSpan.dataset.originalBackground) {
        const currentStyle = swatchSpan.getAttribute('style');
        swatchSpan.dataset.originalBackground = currentStyle;
        console.log('[ProductCustomizer] Stored original background:', currentStyle);
      }
      
      // Update the swatch background with the customization preview
      const newStyle = `--swatch-background: url(${this.currentPreviewUrl});`;
      swatchSpan.setAttribute('style', newStyle);
      swatchSpan.setAttribute('data-customization-preview', 'true');
      
      console.log('[ProductCustomizer] Updated swatch background to:', this.currentPreviewUrl);
      
      // Mark the parent as having customization
      const swatchParent = swatchSpan.parentElement;
      if (swatchParent) {
        swatchParent.setAttribute('data-has-customization', 'true');
      }
    } else {
      console.log('[ProductCustomizer] No swatch span found for color:', selectedColor);
      
      // Fallback: try to find any span.swatch for the selected color
      const colorInputs = document.querySelectorAll(`input[type="radio"][value="${selectedColor}"]`);
      for (const input of colorInputs) {
        const nextSpan = input.nextElementSibling;
        if (nextSpan && nextSpan.classList.contains('swatch')) {
          console.log('[ProductCustomizer] Found swatch via fallback method');
          
          if (!nextSpan.dataset.originalBackground) {
            const currentStyle = nextSpan.getAttribute('style');
            nextSpan.dataset.originalBackground = currentStyle;
          }
          
          const newStyle = `--swatch-background: url(${this.currentPreviewUrl});`;
          nextSpan.setAttribute('style', newStyle);
          nextSpan.setAttribute('data-customization-preview', 'true');
          
          const swatchParent = nextSpan.parentElement;
          if (swatchParent) {
            swatchParent.setAttribute('data-has-customization', 'true');
          }
          break;
        }
      }
    }
  }
  
  restoreOriginalVariantSwatches() {
    // Find all variant swatches that have been customized (both img and span elements)
    const customizedImages = document.querySelectorAll('img[data-customization-preview="true"]');
    const customizedSpans = document.querySelectorAll('span[data-customization-preview="true"]');
    const multiPreviews = document.querySelectorAll('span[data-multi-preview="true"]');
    
    // Clear saved variant previews from localStorage when restoring
    const currentVariantTitle = this.getVariantTitle();
    if (currentVariantTitle) {
      const parts = currentVariantTitle.split(' / ');
      const edgePattern = parts.length > 1 ? parts[1].trim() : null;
      if (edgePattern) {
        const variantPreviewsKey = `variant_previews_${edgePattern}`;
        localStorage.removeItem(variantPreviewsKey);
        console.log(`[ProductCustomizer] Cleared saved previews for pattern: ${edgePattern}`);
      }
    }
    
    // Restore customized img elements
    customizedImages.forEach(swatch => {
      if (swatch.dataset.originalSrc) {
        console.log('[ProductCustomizer] Restoring original image swatch:', swatch.dataset.originalSrc);
        swatch.src = swatch.dataset.originalSrc;
        if (swatch.dataset.originalSrcset) {
          swatch.srcset = swatch.dataset.originalSrcset;
        }
        swatch.removeAttribute('data-customization-preview');
        
        // Remove parent customization marker
        const swatchParent = swatch.closest('[data-has-customization]');
        if (swatchParent) {
          swatchParent.removeAttribute('data-has-customization');
        }
      }
    });
    
    // Restore customized span elements (CSS background swatches)
    customizedSpans.forEach(swatch => {
      if (swatch.dataset.originalBackground) {
        console.log('[ProductCustomizer] Restoring original CSS swatch');
        swatch.setAttribute('style', swatch.dataset.originalBackground);
        delete swatch.dataset.originalBackground;
        swatch.removeAttribute('data-customization-preview');
        
        // Remove parent customization marker
        const swatchParent = swatch.closest('[data-has-customization]');
        if (swatchParent) {
          swatchParent.removeAttribute('data-has-customization');
        }
      }
    });
    
    // Restore multi-variant previews
    multiPreviews.forEach(swatch => {
      if (swatch.dataset.originalBackground) {
        console.log('[ProductCustomizer] Restoring multi-preview swatch');
        swatch.setAttribute('style', swatch.dataset.originalBackground);
        delete swatch.dataset.originalBackground;
        swatch.removeAttribute('data-multi-preview');
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
    
    // If we don't have a product image and no saved preview, show the canvas preview
    if (!this.hasProductImage && !this.savedTextUpdates) {
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
    this.updateVariantSwatches();
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
    
    textInputsContainer.innerHTML = textElements.map((element, index) => {
      // Use saved text if available, otherwise use the element's current text
      const displayText = this.savedTextUpdates && this.savedTextUpdates[element.id] 
        ? this.savedTextUpdates[element.id] 
        : element.text;
        
      return `
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
            value="${displayText}"
            placeholder="Enter your text here"
          />
        </div>
      `;
    }).join('');
    
    // Attach input listeners
    textInputsContainer.querySelectorAll('input').forEach(input => {
      input.addEventListener('input', (e) => {
        this.renderer.updateText(e.target.dataset.elementId, e.target.value);
        this.debouncedUpdatePreview();
        
        // Auto-save text state on input change
        clearTimeout(this.textSaveTimer);
        this.textSaveTimer = setTimeout(() => {
          this.saveTextState();
        }, 1000); // Save after 1 second of no typing
      });
    });
  }

  // Remove positionModal method as we're using CSS positioning within product-details
  
  close(keepCustomization = false) {
    this.modal.classList.remove('open');
    this.isOpen = false;
    document.body.style.overflow = '';
    
    // Only restore original product images if we're not keeping a customization
    if (!keepCustomization) {
      this.restoreOriginalProductImages();
      // Clear saved text updates if not keeping customization
      this.savedTextUpdates = null;
    }
    
    // Clear any pending timers
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = null;
    }
    if (this.textSaveTimer) {
      clearTimeout(this.textSaveTimer);
      this.textSaveTimer = null;
    }
    
    // Clean up renderer
    if (this.renderer) {
      this.renderer.destroy();
      this.renderer = null;
    }
  }

  async openAdvancedEditor() {
    try {
      let designId = this.currentDesignId;
      
      // If we don't have a design ID, create a new draft
      if (!designId) {
        // Get canvas state
        const canvasState = this.renderer.getCanvasState();
        const thumbnail = this.renderer.getDataURL({ pixelRatio: 0.3 });
        
        // Get product info from page
        const productId = this.options.productId || 
          (window.ShopifyAnalytics && window.ShopifyAnalytics.meta && window.ShopifyAnalytics.meta.product && 
           `gid://shopify/Product/${window.ShopifyAnalytics.meta.product.id}`) ||
          '';
        
        // Create draft via API
        const formData = new FormData();
        formData.append('templateId', this.options.templateId);
        formData.append('variantId', this.options.variantId);
        formData.append('productId', productId);
        formData.append('canvasState', JSON.stringify(canvasState));
        formData.append('thumbnail', thumbnail);
        
        const response = await fetch(`${this.options.apiUrl}/api/designs/draft`, {
          method: 'POST',
          body: formData
        });
        
        if (!response.ok) {
          throw new Error('Failed to create draft');
        }
        
        const { design } = await response.json();
        designId = design.id;
        
        // Store reference in localStorage
        localStorage.setItem('currentDesign', JSON.stringify({
          id: design.id,
          templateId: this.options.templateId,
          variantId: this.options.variantId,
          productId: productId,
          lastModified: Date.now(),
          status: 'draft'
        }));
      }
      
      // Store return location
      localStorage.setItem('returnTo', JSON.stringify({
        type: 'product',
        url: window.location.href,
        context: {}
      }));
      
      // Store the design ID for when the modal reopens
      this.currentDesignId = designId;
      
      // Build the URL with return parameter
      const returnUrl = encodeURIComponent(window.location.href);
      const designerUrl = `${this.options.apiUrl}/full?design=${designId}&return=${returnUrl}`;
      
      // Store the opened window reference
      this.advancedEditorWindow = window.open(designerUrl, '_blank');
      
      // Don't close the modal yet - wait for the design to be saved
    } catch (error) {
      console.error('Error opening advanced editor:', error);
      alert('Failed to open advanced editor. Please try again.');
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
      fullPreview: this.renderer.getDataURL({ pixelRatio: 0.5 }), // Full preview at 50% resolution
      designId: this.currentDesignId || null // Include design ID if available
    };
    
    textElements.forEach(el => {
      customization.textUpdates[el.id] = el.text;
    });
    
    // Save to cart or handle as needed
    this.customizationData = customization;
    this.options.onSave(customization);
    
    // Update the current preview URL before closing
    this.currentPreviewUrl = customization.fullPreview;
    
    // Store the customization in localStorage for persistence
    const customizationKey = `customization_${this.options.variantId}`;
    localStorage.setItem(customizationKey, JSON.stringify({
      designId: this.currentDesignId,
      thumbnail: customization.fullPreview,
      templateId: this.options.templateId,
      textUpdates: customization.textUpdates,
      timestamp: Date.now()
    }));
    
    // Also save text state to pattern-based key for cross-variant persistence
    this.saveTextState();
    
    this.close(true); // Keep customization visible after save
  }
  
  setupMessageListener() {
    // Listen for messages from the advanced editor
    window.addEventListener('message', (event) => {
      // Validate message origin if needed
      if (event.data && event.data.type === 'design-saved') {
        console.log('Design saved message received:', event.data);
        
        // Store the design ID
        this.currentDesignId = event.data.designId;
        
        // Update the preview if we have a thumbnail
        if (event.data.thumbnail) {
          this.currentPreviewUrl = event.data.thumbnail;
          this.updateMainProductImage();
          this.updateVariantSwatches();
        }
        
        // Close the advanced editor window if it's still open
        if (this.advancedEditorWindow && !this.advancedEditorWindow.closed) {
          this.advancedEditorWindow.close();
        }
        
        // Update customization data with the saved design
        this.customizationData = {
          templateId: event.data.templateId,
          variantId: event.data.variantId,
          designId: event.data.designId,
          preview: event.data.thumbnail,
          isLocal: event.data.isLocal || false
        };
        
        // Store the design ID in localStorage for persistence
        const customizationKey = `customization_${this.options.variantId}`;
        localStorage.setItem(customizationKey, JSON.stringify({
          designId: event.data.designId,
          thumbnail: event.data.thumbnail,
          templateId: event.data.templateId,
          timestamp: Date.now()
        }));
        
        // IMPORTANT: Save the full canvas state globally so it persists across variant switches
        if (event.data.canvasState) {
          console.log('[ProductCustomizer] Saving global canvas state from full designer');
          
          // Clone the canvas state and remove the base image to keep variant-specific images
          const globalCanvasState = JSON.parse(JSON.stringify(event.data.canvasState));
          if (globalCanvasState.assets) {
            delete globalCanvasState.assets.baseImage;
          }
          
          const globalStateKey = `customization_global_state`;
          localStorage.setItem(globalStateKey, JSON.stringify({
            canvasState: globalCanvasState,
            templateColors: event.data.templateColors,
            designId: event.data.designId,
            timestamp: Date.now()
          }));
        }
        
        // Update the product page image directly
        const mainProductImage = document.querySelector(
          '.media-gallery img:first-of-type, ' +
          '.product-media img:first-of-type, ' +
          '.product__media--featured img, ' +
          '[data-product-featured-image], ' +
          '.product-gallery img:first-of-type'
        );
        
        if (mainProductImage) {
          mainProductImage.dataset.originalSrc = mainProductImage.dataset.originalSrc || mainProductImage.src;
          mainProductImage.src = event.data.thumbnail;
          mainProductImage.srcset = ''; // Clear srcset
          mainProductImage.setAttribute('data-customization-preview', 'true');
        }
        
        // Generate previews for all color variants if we have canvas state
        console.log('[ProductCustomizer] Checking if should generate multi-variant previews...');
        console.log('[ProductCustomizer] Has canvasState:', !!event.data.canvasState);
        console.log('[ProductCustomizer] Has templateColors:', !!event.data.templateColors);
        console.log('[ProductCustomizer] Template colors count:', event.data.templateColors?.length);
        
        // Store template colors globally for batch renderer
        if (event.data.templateColors) {
          window.__TEMPLATE_COLORS__ = event.data.templateColors;
        }
        
        if (event.data.canvasState && event.data.templateColors && event.data.templateColors.length > 0) {
          console.log('[ProductCustomizer] Calling generateAllColorVariantPreviews...');
          this.generateAllColorVariantPreviews(event.data.canvasState);
        } else {
          console.log('[ProductCustomizer] Skipping multi-variant preview generation');
          if (!event.data.canvasState) {
            console.log('[ProductCustomizer] Missing canvas state in message');
          }
          if (!event.data.templateColors || event.data.templateColors.length === 0) {
            console.log('[ProductCustomizer] Missing or empty template colors in message');
          }
        }
        
        // Don't automatically add to cart - just close the modal
        // The user can click "Add to Cart" on the product page when ready
        this.close(true); // Pass true to keep the customization preview
      }
    });
  }
  
  async generateAllColorVariantPreviews(canvasState) {
    console.log('[ProductCustomizer] Starting generateAllColorVariantPreviews');
    console.log('[ProductCustomizer] Canvas state:', canvasState);
    console.log('[ProductCustomizer] Template colors available:', !!window.__TEMPLATE_COLORS__);
    
    // Check if batch renderer is available
    if (typeof ProductCustomizerBatchRenderer === 'undefined') {
      console.error('[ProductCustomizer] ProductCustomizerBatchRenderer is not defined!');
      return;
    }
    
    // Get current variant info
    const currentVariantTitle = this.getVariantTitle();
    console.log('[ProductCustomizer] Current variant title:', currentVariantTitle);
    if (!currentVariantTitle) {
      console.log('[ProductCustomizer] Could not determine variant title');
      return;
    }
    
    const edgePattern = this.getEdgePattern(currentVariantTitle);
    const currentColor = this.getCurrentColor();
    
    console.log('[ProductCustomizer] Edge pattern:', edgePattern);
    console.log('[ProductCustomizer] Current color:', currentColor);
    
    if (!edgePattern || !currentColor) {
      console.log('[ProductCustomizer] Could not determine edge pattern or color');
      return;
    }
    
    console.log(`[ProductCustomizer] Current variant: ${currentColor} / ${edgePattern}`);
    
    // Get all color variants for this edge pattern
    const colorVariants = this.getColorVariantsForPattern(edgePattern);
    console.log(`[ProductCustomizer] Found ${colorVariants.length} color variants for ${edgePattern}`);
    console.log('[ProductCustomizer] Color variants:', colorVariants.map(v => v.color));
    
    // Create a batch renderer
    const batchRenderer = new ProductCustomizerBatchRenderer();
    console.log('[ProductCustomizer] Batch renderer created');
    
    // Get color mappings
    const colorMappings = window.__TEMPLATE_COLORS__ || [];
    console.log('[ProductCustomizer] Color mappings count:', colorMappings.length);
    
    // Process each variant (except current one)
    let processedCount = 0;
    const variantPreviews = {}; // Store preview URLs for localStorage
    
    for (const variant of colorVariants) {
      if (variant.color === currentColor) {
        console.log(`[ProductCustomizer] Skipping current color: ${currentColor}`);
        continue;
      }
      
      try {
        console.log(`[ProductCustomizer] Processing variant: ${variant.color}`);
        
        // Use the original canvas state without color transformation
        // Once a user customizes a design, we keep their exact colors
        const transformedState = canvasState;
        console.log(`[ProductCustomizer] Using original state for ${variant.color} (no color transformation)`);
        
        // Get base image URL for this variant
        const baseImageUrl = this.getBaseImageUrl(variant.color, edgePattern);
        console.log(`[ProductCustomizer] Base image URL for ${variant.color}:`, baseImageUrl);
        
        // Render preview
        console.log(`[ProductCustomizer] Rendering preview for ${variant.color}...`);
        const preview = await batchRenderer.renderVariantPreview(
          transformedState,
          baseImageUrl,
          { width: 128, height: 128, pixelRatio: 0.5 }
        );
        console.log(`[ProductCustomizer] Preview generated for ${variant.color}:`, preview ? 'success' : 'failed');
        
        // Store the preview URL
        if (preview) {
          variantPreviews[variant.color] = preview;
        }
        
        // Update swatch
        if (variant.element && variant.element.classList.contains('swatch')) {
          // Store original if not already stored
          if (!variant.element.dataset.originalBackground) {
            variant.element.dataset.originalBackground = variant.element.getAttribute('style');
          }
          
          variant.element.setAttribute('style', `--swatch-background: url(${preview});`);
          variant.element.setAttribute('data-multi-preview', 'true');
          
          console.log(`[ProductCustomizer] Updated swatch for ${variant.color}`);
          processedCount++;
        } else {
          console.log(`[ProductCustomizer] No swatch element found for ${variant.color}`);
        }
      } catch (error) {
        console.error(`[ProductCustomizer] Failed to generate preview for ${variant.color}:`, error);
      }
    }
    
    // Store all variant previews in localStorage for quick retrieval on page load
    if (Object.keys(variantPreviews).length > 0) {
      const variantPreviewsKey = `variant_previews_${edgePattern}`;
      localStorage.setItem(variantPreviewsKey, JSON.stringify({
        previews: variantPreviews,
        timestamp: Date.now()
      }));
      console.log(`[ProductCustomizer] Stored ${Object.keys(variantPreviews).length} variant previews for pattern: ${edgePattern}`);
    }
    
    // Cleanup
    batchRenderer.destroy();
    console.log(`[ProductCustomizer] Finished generating previews. Processed ${processedCount} variants.`);
  }
  
  getVariantTitle() {
    // Try to get from the selected option's label
    const selectedInput = document.querySelector('input[type="radio"]:checked[name*="Color"]');
    if (selectedInput) {
      const label = selectedInput.parentElement?.querySelector('.variant-option__label');
      if (label) {
        return label.textContent.trim();
      }
    }
    
    // Fallback: try to get from product data
    if (window.ShopifyAnalytics && window.ShopifyAnalytics.meta && window.ShopifyAnalytics.meta.product) {
      const product = window.ShopifyAnalytics.meta.product;
      const variant = product.variants.find(v => v.id == this.options.variantId);
      if (variant) {
        return variant.public_title || variant.title;
      }
    }
    
    return null;
  }
  
  getEdgePattern(variantTitle) {
    // Extract edge pattern from variant title (e.g., "Red / 8 Spot" -> "8 Spot")
    const parts = variantTitle.split(' / ');
    return parts.length > 1 ? parts[1].trim() : null;
  }
  
  getCurrentColor() {
    // Get from selected input
    const selectedInput = document.querySelector('input[type="radio"]:checked[name*="Color"]');
    return selectedInput ? selectedInput.value : null;
  }
  
  getColorVariantsForPattern(pattern) {
    console.log(`[ProductCustomizer] Looking for variants with pattern: "${pattern}"`);
    const variants = [];
    
    // First, try to find all color swatches
    const swatches = document.querySelectorAll('.swatch.color');
    console.log(`[ProductCustomizer] Found ${swatches.length} color swatches`);
    
    // Also check for radio inputs
    const inputs = document.querySelectorAll('input[type="radio"][name*="Color"]');
    console.log(`[ProductCustomizer] Found ${inputs.length} color radio inputs`);
    
    // Debug: Show first few inputs structure
    if (inputs.length > 0) {
      console.log('[ProductCustomizer] First input structure:', {
        name: inputs[0].name,
        value: inputs[0].value,
        parentHTML: inputs[0].parentElement?.outerHTML.substring(0, 200)
      });
    }
    
    // Try to find Pattern radio inputs to understand the structure
    const patternInputs = document.querySelectorAll('input[type="radio"][name*="Pattern"]');
    console.log(`[ProductCustomizer] Found ${patternInputs.length} pattern radio inputs`);
    
    // For now, if we have color swatches, use those directly
    // We know all variants in the same pattern group should have the same pattern
    swatches.forEach(swatch => {
      const colorName = swatch.getAttribute('data-swatch-value') || 
                        swatch.getAttribute('data-value') ||
                        swatch.querySelector('span')?.getAttribute('data-swatch-value');
      
      if (colorName) {
        variants.push({
          color: colorName,
          element: swatch,
          label: colorName
        });
        console.log(`[ProductCustomizer] Added variant from swatch: ${colorName}`);
      }
    });
    
    // If no swatches found, try inputs approach
    if (variants.length === 0) {
      inputs.forEach(input => {
        // Try different ways to get the associated swatch
        const parentLabel = input.closest('label');
        const swatch = parentLabel?.querySelector('.swatch') || 
                      input.nextElementSibling?.classList.contains('swatch') ? input.nextElementSibling : null;
        
        if (swatch) {
          variants.push({
            color: input.value,
            element: swatch,
            label: input.value
          });
          console.log(`[ProductCustomizer] Added variant from input: ${input.value}`);
        }
      });
    }
    
    console.log(`[ProductCustomizer] Total variants found: ${variants.length}`);
    return variants;
  }
  
  transformCanvasColors(canvasState, sourceColor, targetColor, colorMappings) {
    // Find color mappings
    const sourceMapping = colorMappings.find(m => m.chipColor.toLowerCase() === sourceColor.toLowerCase());
    const targetMapping = colorMappings.find(m => m.chipColor.toLowerCase() === targetColor.toLowerCase());
    
    if (!sourceMapping || !targetMapping) {
      console.warn(`[ProductCustomizer] Could not find color mappings for ${sourceColor} -> ${targetColor}`);
      return canvasState;
    }
    
    // Deep clone the canvas state
    const transformed = JSON.parse(JSON.stringify(canvasState));
    
    // Helper function to transform a single color
    const transformColor = (color) => {
      if (!color || typeof color !== 'string') return color;
      
      // Skip special colors
      if (color === 'transparent' || color === 'gold-gradient' || color.startsWith('linear-gradient')) {
        return color;
      }
      
      const normalizedColor = color.toLowerCase();
      
      // Find position in source mapping
      let position = null;
      if (normalizedColor === sourceMapping.color1.toLowerCase()) position = 1;
      else if (normalizedColor === sourceMapping.color2.toLowerCase()) position = 2;
      else if (normalizedColor === sourceMapping.color3.toLowerCase()) position = 3;
      else if (sourceMapping.color4 && normalizedColor === sourceMapping.color4.toLowerCase()) position = 4;
      else if (sourceMapping.color5 && normalizedColor === sourceMapping.color5.toLowerCase()) position = 5;
      
      if (!position) return color;
      
      // Return color at same position in target mapping
      switch (position) {
        case 1: return targetMapping.color1;
        case 2: return targetMapping.color2;
        case 3: return targetMapping.color3;
        case 4: return targetMapping.color4 || color;
        case 5: return targetMapping.color5 || color;
        default: return color;
      }
    };
    
    // Transform element colors
    if (transformed.elements) {
      ['textElements', 'curvedTextElements', 'gradientTextElements'].forEach(elementType => {
        if (transformed.elements[elementType]) {
          transformed.elements[elementType].forEach(element => {
            if (element.fill) {
              element.fill = transformColor(element.fill);
            }
            if (element.stroke) {
              element.stroke = transformColor(element.stroke);
            }
          });
        }
      });
    }
    
    // Transform background color
    if (transformed.backgroundColor) {
      transformed.backgroundColor = transformColor(transformed.backgroundColor);
    }
    
    // Transform background gradient colors
    if (transformed.backgroundGradient && transformed.backgroundGradient.colorStops) {
      const newStops = [...transformed.backgroundGradient.colorStops];
      // Color stops alternate between position and color
      for (let i = 1; i < newStops.length; i += 2) {
        newStops[i] = transformColor(newStops[i]);
      }
      transformed.backgroundGradient.colorStops = newStops;
    }
    
    return transformed;
  }
  
  getBaseImageUrl(color, pattern) {
    console.log(`[ProductCustomizer] Looking for base image URL for ${color} / ${pattern}`);
    
    // Try multiple approaches to find the swatch and its background image
    
    // Approach 1: Find by swatch element with data attribute
    const swatchByData = document.querySelector(`.swatch[data-swatch-value="${color}"]`) ||
                         document.querySelector(`.swatch[data-value="${color}"]`);
    
    if (swatchByData) {
      const bgUrl = this.extractBackgroundUrl(swatchByData);
      if (bgUrl) {
        console.log(`[ProductCustomizer] Found base image via data attribute:`, bgUrl);
        return bgUrl;
      }
    }
    
    // Approach 2: Find by input value
    const inputs = document.querySelectorAll('input[type="radio"]');
    for (const input of inputs) {
      if (input.value === color || input.value.includes(color)) {
        // Look for associated swatch in various ways
        const swatch = input.nextElementSibling?.classList.contains('swatch') ? input.nextElementSibling :
                      input.parentElement?.querySelector('.swatch') ||
                      input.closest('label')?.querySelector('.swatch');
        
        if (swatch) {
          const bgUrl = this.extractBackgroundUrl(swatch);
          if (bgUrl) {
            console.log(`[ProductCustomizer] Found base image via input:`, bgUrl);
            return bgUrl;
          }
        }
      }
    }
    
    // Approach 3: Find by text content in labels
    const labels = document.querySelectorAll('label');
    for (const label of labels) {
      if (label.textContent.includes(color)) {
        const swatch = label.querySelector('.swatch');
        if (swatch) {
          const bgUrl = this.extractBackgroundUrl(swatch);
          if (bgUrl) {
            console.log(`[ProductCustomizer] Found base image via label:`, bgUrl);
            return bgUrl;
          }
        }
      }
    }
    
    // Fallback
    console.warn(`[ProductCustomizer] Could not find base image for ${color} / ${pattern}`);
    return null;
  }
  
  extractBackgroundUrl(element) {
    if (!element) return null;
    
    // Try inline style
    const style = element.getAttribute('style');
    if (style) {
      const match = style.match(/url\(([^)]+)\)/);
      if (match && match[1]) {
        return match[1].replace(/["']/g, '');
      }
    }
    
    // Try computed style
    const computedStyle = window.getComputedStyle(element);
    const bgImage = computedStyle.backgroundImage || computedStyle.getPropertyValue('--swatch-background');
    if (bgImage && bgImage !== 'none') {
      const match = bgImage.match(/url\(([^)]+)\)/);
      if (match && match[1]) {
        return match[1].replace(/["']/g, '');
      }
    }
    
    return null;
  }
  
  getCurrentTextUpdates() {
    const textUpdates = {};
    const textElements = this.renderer ? this.renderer.getAllTextElements() : [];
    textElements.forEach(el => {
      textUpdates[el.id] = el.text;
    });
    return textUpdates;
  }
  
  saveTextState() {
    // Save only text updates - don't save full canvas state for text-only changes
    // Full canvas state should only be saved when coming from the full designer
    const textKey = `customization_global_text`;
    localStorage.setItem(textKey, JSON.stringify({
      textUpdates: this.getCurrentTextUpdates(),
      timestamp: Date.now()
    }));
  }
  
  loadTextState() {
    const textKey = `customization_global_text`;
    const savedText = localStorage.getItem(textKey);
    if (savedText) {
      try {
        const data = JSON.parse(savedText);
        // Check if data is less than 30 days old
        if (data.timestamp && Date.now() - data.timestamp < 30 * 24 * 60 * 60 * 1000) {
          return data;
        }
      } catch (e) {
        console.error('Error loading text state:', e);
      }
    }
    return null;
  }
  
  async handleVariantChange(newVariantId, newTemplateId) {
    // Update the options
    this.options.variantId = newVariantId;
    this.options.templateId = newTemplateId;
    
    // If modal is not open, just update options and return
    if (!this.isOpen || !this.renderer) {
      return;
    }
    
    // First check for global canvas state from full designer
    const globalStateKey = `customization_global_state`;
    const savedGlobalState = localStorage.getItem(globalStateKey);
    let globalCanvasState = null;
    
    if (savedGlobalState) {
      try {
        const globalData = JSON.parse(savedGlobalState);
        if (globalData.timestamp && Date.now() - globalData.timestamp < 30 * 24 * 60 * 60 * 1000) {
          console.log('[ProductCustomizer] Found global canvas state for variant change');
          globalCanvasState = globalData.canvasState;
          
          // Store template colors if available
          if (globalData.templateColors) {
            window.__TEMPLATE_COLORS__ = globalData.templateColors;
          }
        }
      } catch (e) {
        console.error('Error loading global canvas state:', e);
      }
    }
    
    // If we have global canvas state, apply it
    if (globalCanvasState) {
      console.log('[ProductCustomizer] Applying global canvas state for variant change');
      
      // Load the new template first
      await this.renderer.loadTemplate(newTemplateId);
      
      // Apply the saved canvas state
      setTimeout(() => {
        this.renderer.loadCanvasState(globalCanvasState);
        
        // Update preview
        this.updatePreview();
        
        // Generate multi-variant previews if needed
        if (window.__TEMPLATE_COLORS__ && window.__TEMPLATE_COLORS__.length > 0) {
          this.generateAllColorVariantPreviews(globalCanvasState);
        }
      }, 100);
    }
    // Otherwise check for global text to apply (legacy support)
    else {
      const globalTextState = this.loadTextState();
      if (globalTextState && globalTextState.textUpdates) {
        // We have saved text, regenerate preview with new variant
        console.log('[ProductCustomizer] Regenerating preview for variant change with saved text');
        
        // Load the new template
        await this.renderer.loadTemplate(newTemplateId);
        
        // Apply the saved text
        setTimeout(() => {
          Object.keys(globalTextState.textUpdates).forEach(elementId => {
            this.renderer.updateText(elementId, globalTextState.textUpdates[elementId]);
          });
          
          // Update preview
          this.updatePreview();
          
          // Generate multi-variant previews if needed
          if (window.__TEMPLATE_COLORS__ && window.__TEMPLATE_COLORS__.length > 0) {
            // Get canvas state for batch rendering
            const canvasState = this.renderer.getCanvasState();
            this.generateAllColorVariantPreviews(canvasState);
          }
        }, 100);
      }
    }
  }

  }

  /**
   * Batch renderer for generating multiple variant previews efficiently
   */
  class ProductCustomizerBatchRenderer {
    constructor() {
      this.renderQueue = [];
      this.isRendering = false;
      this.tempContainer = null;
      this.stage = null;
      this.loadedFonts = new Set(['Arial', 'Times New Roman', 'Georgia', 'Courier New']); // System fonts
    }

    async renderVariantPreview(canvasState, baseImageUrl, options = {}) {
      console.log('[BatchRenderer] renderVariantPreview called');
      console.log('[BatchRenderer] Canvas state dimensions:', canvasState?.dimensions);
      console.log('[BatchRenderer] Base image URL:', baseImageUrl);
      
      return new Promise((resolve) => {
        this.renderQueue.push({
          canvasState,
          baseImageUrl,
          options,
          resolve
        });
        
        console.log('[BatchRenderer] Queue length:', this.renderQueue.length);
        
        if (!this.isRendering) {
          console.log('[BatchRenderer] Starting queue processing');
          this.processQueue();
        }
      });
    }

    async processQueue() {
      if (this.renderQueue.length === 0) {
        this.isRendering = false;
        return;
      }
      
      this.isRendering = true;
      const task = this.renderQueue.shift();
      
      // Use requestAnimationFrame for smooth rendering
      requestAnimationFrame(async () => {
        try {
          const preview = await this.renderSinglePreview(task);
          task.resolve(preview);
        } catch (error) {
          console.error('Error rendering preview:', error);
          task.resolve(null);
        }
        
        // Process next item
        this.processQueue();
      });
    }

    async renderSinglePreview({ canvasState, baseImageUrl, options }) {
      const width = options.width || 128;
      const height = options.height || 128;
      const pixelRatio = options.pixelRatio || 0.5;
      
      // Create temporary container
      this.tempContainer = document.createElement('div');
      this.tempContainer.style.position = 'absolute';
      this.tempContainer.style.left = '-9999px';
      this.tempContainer.style.width = width + 'px';
      this.tempContainer.style.height = height + 'px';
      document.body.appendChild(this.tempContainer);
      
      try {
        console.log('[BatchRenderer] Creating Konva stage');
        // Create stage
        this.stage = new Konva.Stage({
          container: this.tempContainer,
          width: width,
          height: height
        });
        
        const layer = new Konva.Layer();
        this.stage.add(layer);
        
        // Load and render base image if provided
        if (baseImageUrl) {
          console.log('[BatchRenderer] Rendering base image');
          await this.renderBaseImage(layer, baseImageUrl, width, height);
        }
        
        // Calculate scale to fit design into preview
        const scaleX = width / canvasState.dimensions.width;
        const scaleY = height / canvasState.dimensions.height;
        const scale = Math.min(scaleX, scaleY);
        console.log('[BatchRenderer] Scale factor:', scale);
        
        // Create group for scaled content
        const contentGroup = new Konva.Group({
          scaleX: scale,
          scaleY: scale
        });
        layer.add(contentGroup);
        
        // If we have a designable area, create a clipping group
        if (canvasState.designableArea) {
          const { x, y, width, height, cornerRadius } = canvasState.designableArea;
          
          // Create a clipping group that matches the DesignerCanvas implementation
          const clipGroup = new Konva.Group({
            clipFunc: (ctx) => {
              // Create clipping path that exactly matches the designable area
              ctx.beginPath();
              if (cornerRadius > 0) {
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
          });
          
          contentGroup.add(clipGroup);
          
          // Render background first inside clipped area
          await this.renderBackground(clipGroup, canvasState);
          
          // Render all elements inside the clipped area
          await this.renderElements(clipGroup, canvasState.elements, canvasState.designableArea);
        } else {
          // No clipping needed, render directly to content group
          await this.renderBackground(contentGroup, canvasState);
          await this.renderElements(contentGroup, canvasState.elements, null);
        }
        
        // Draw layer after all elements are added
        layer.batchDraw();
        
        // Wait for next frame to ensure rendering is complete
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        // Force a full redraw to ensure clipping is properly applied
        // This is crucial for async-loaded images
        this.stage.clear();
        this.stage.draw();
        
        // Wait one more frame to ensure the draw is complete
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        // Generate thumbnail
        console.log('[BatchRenderer] Generating data URL');
        const dataUrl = this.stage.toDataURL({
          pixelRatio: pixelRatio,
          mimeType: 'image/png'
        });
        console.log('[BatchRenderer] Data URL generated, length:', dataUrl?.length);
        
        return dataUrl;
        
      } catch (error) {
        console.error('[BatchRenderer] Error in renderSinglePreview:', error);
        throw error;
      } finally {
        // Cleanup
        if (this.stage) {
          this.stage.destroy();
          this.stage = null;
        }
        if (this.tempContainer && this.tempContainer.parentNode) {
          document.body.removeChild(this.tempContainer);
          this.tempContainer = null;
        }
      }
    }

    async renderBaseImage(layer, imageUrl, width, height) {
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
          const konvaImage = new Konva.Image({
            image: img,
            x: 0,
            y: 0,
            width: width,
            height: height
          });
          layer.add(konvaImage);
          konvaImage.moveToBottom();
          resolve();
        };
        
        img.onerror = () => {
          console.warn('Failed to load base image:', imageUrl);
          resolve();
        };
        
        img.src = imageUrl;
      });
    }

    async renderBackground(parent, canvasState) {
      const { backgroundColor, backgroundGradient, designableArea } = canvasState;
      
      if (!designableArea || !backgroundColor || backgroundColor === 'transparent') {
        return;
      }
      
      let bgRect;
      
      if (backgroundColor === 'linear-gradient' && backgroundGradient) {
        bgRect = new Konva.Rect({
          x: designableArea.x,
          y: designableArea.y,
          width: designableArea.width,
          height: designableArea.height,
          cornerRadius: designableArea.cornerRadius || 0,
          fillLinearGradientStartPoint: { x: 0, y: 0 },
          fillLinearGradientEndPoint: { x: designableArea.width, y: 0 },
          fillLinearGradientColorStops: backgroundGradient.colorStops || [0, '#c8102e', 1, '#ffaaaa']
        });
      } else if (backgroundColor === 'radial-gradient' && backgroundGradient) {
        bgRect = new Konva.Rect({
          x: designableArea.x,
          y: designableArea.y,
          width: designableArea.width,
          height: designableArea.height,
          cornerRadius: designableArea.cornerRadius || 0,
          fillRadialGradientStartPoint: { x: designableArea.width / 2, y: designableArea.height / 2 },
          fillRadialGradientEndPoint: { x: designableArea.width / 2, y: designableArea.height / 2 },
          fillRadialGradientStartRadius: 0,
          fillRadialGradientEndRadius: Math.min(designableArea.width, designableArea.height) / 2,
          fillRadialGradientColorStops: backgroundGradient.colorStops || [0, '#c8102e', 1, '#ffaaaa']
        });
      } else {
        bgRect = new Konva.Rect({
          x: designableArea.x,
          y: designableArea.y,
          width: designableArea.width,
          height: designableArea.height,
          cornerRadius: designableArea.cornerRadius || 0,
          fill: backgroundColor
        });
      }
      
      parent.add(bgRect);
    }

    async renderElements(parent, elements, designableArea) {
      // Create a unified array of all elements with their types and z-indexes
      const unifiedElements = [];
      let currentZIndex = 0;
      const imageLoadPromises = [];
      
      // Add all element types with zIndex
      if (elements.imageElements) {
        elements.imageElements.forEach((el) => {
          unifiedElements.push({
            type: 'image',
            zIndex: el.zIndex ?? currentZIndex++,
            data: el
          });
        });
      }
      
      if (elements.textElements) {
        elements.textElements.forEach((el) => {
          unifiedElements.push({
            type: 'text',
            zIndex: el.zIndex ?? currentZIndex++,
            data: el
          });
        });
      }
      
      if (elements.gradientTextElements) {
        elements.gradientTextElements.forEach((el) => {
          unifiedElements.push({
            type: 'gradientText',
            zIndex: el.zIndex ?? currentZIndex++,
            data: el
          });
        });
      }
      
      if (elements.curvedTextElements) {
        elements.curvedTextElements.forEach((el) => {
          unifiedElements.push({
            type: 'curvedText',
            zIndex: el.zIndex ?? currentZIndex++,
            data: el
          });
        });
      }
      
      // Sort by z-index to respect layering order
      unifiedElements.sort((a, b) => a.zIndex - b.zIndex);
      
      // Render elements in z-index order
      for (const element of unifiedElements) {
        const el = element.data;
        
        switch (element.type) {
          case 'image':
            try {
              await new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                
                img.onload = () => {
                  const konvaImage = new Konva.Image({
                    image: img,
                    x: el.x + el.width / 2,
                    y: el.y + el.height / 2,
                    width: el.width,
                    height: el.height,
                    offsetX: el.width / 2,
                    offsetY: el.height / 2,
                    rotation: el.rotation || 0,
                    scaleX: el.scaleX || 1,
                    scaleY: el.scaleY || 1
                  });
                  parent.add(konvaImage);
                  
                  // Force the stage to redraw with clipping after image loads
                  // This ensures the clip is applied to the newly loaded image
                  const layer = parent.getLayer();
                  if (layer) {
                    // Clear and redraw to ensure clipping is applied
                    layer.clear();
                    layer.draw();
                  }
                  
                  resolve();
                };
                
                img.onerror = () => {
                  console.warn(`[BatchRenderer] Failed to load image: ${el.url}`);
                  resolve();
                };
                
                img.src = el.url;
              });
            } catch (error) {
              console.error('[BatchRenderer] Error loading image:', error);
            }
            break;
            
          case 'text':
            const text = new Konva.Text({
              text: el.text,
              x: el.x,
              y: el.y,
              fontSize: el.fontSize || 24,
              fontFamily: el.fontFamily || 'Arial',
              fill: el.fill === 'gold-gradient' ? '#FFD700' : (el.fill || 'black'),
              rotation: el.rotation || 0,
              scaleX: el.scaleX || 1,
              scaleY: el.scaleY || 1
            });
            parent.add(text);
            break;
            
          case 'gradientText':
            const gradientText = new Konva.Text({
              text: el.text,
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
            parent.add(gradientText);
            break;
            
          case 'curvedText':
            // Calculate center Y based on whether text is flipped
            const centerY = el.flipped 
              ? el.topY - el.radius
              : el.topY + el.radius;
            
            // Create group for curved text
            const group = new Konva.Group({
              x: el.x,
              y: centerY,
              rotation: el.rotation || 0,
              scaleX: el.scaleX || 1,
              scaleY: el.scaleY || 1
            });

            // Calculate text path
            const fontSize = el.fontSize || 20;
            const textContent = el.text;
            const textLength = textContent.length * fontSize * 0.6;
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
            
            // Create path data
            const pathData = [
              'M', startX, startY,
              'A', el.radius, el.radius, 0, largeArcFlag, sweepFlag, endX, endY
            ].join(' ');
            
            // Create path and text
            const path = new Konva.Path({
              data: pathData,
              visible: false
            });
            
            const textPath = new Konva.TextPath({
              text: textContent,
              data: pathData,
              fontSize: fontSize,
              fontFamily: el.fontFamily || 'Arial',
              fill: el.fill === 'gold-gradient' ? '#FFD700' : (el.fill || 'black'),
              textBaseline: el.flipped ? 'bottom' : 'top',
              align: 'center'
            });
            
            group.add(path);
            group.add(textPath);
            parent.add(group);
            break;
        }
      }
      
      // Wait for all images to be fully loaded and rendered
      if (imageLoadPromises.length > 0) {
        console.log('[BatchRenderer] Waiting for all images to load...');
        await Promise.all(imageLoadPromises);
        console.log('[BatchRenderer] All images loaded');
      }
    }
    destroy() {
      this.renderQueue = [];
      this.isRendering = false;
      if (this.stage) {
        this.stage.destroy();
        this.stage = null;
      }
      if (this.tempContainer && this.tempContainer.parentNode) {
        document.body.removeChild(this.tempContainer);
        this.tempContainer = null;
      }
    }
  }

  // Global function to generate variant preview with saved text
  async function generateVariantPreviewWithText(variantId, templateId, textUpdates) {
    console.log('[generateVariantPreviewWithText] Starting preview generation', { variantId, templateId, textUpdates });
    
    try {
      // Ensure required resources are loaded
      await ensureResourcesLoaded();
      
      // Check if we have the CanvasTextRenderer available
      if (typeof CanvasTextRenderer === 'undefined') {
        // Load canvas text renderer if not already loaded
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = window.Shopify.routes.root + 'cdn/shop/t/1/assets/canvas-text-renderer.js?v=' + Date.now();
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }
      
      // Create a temporary container
      const tempContainer = document.createElement('div');
      tempContainer.style.cssText = 'position: absolute; left: -9999px; width: 600px; height: 400px;';
      document.body.appendChild(tempContainer);
      
      // Initialize a temporary renderer
      const renderer = new CanvasTextRenderer(tempContainer, {
        width: 600,
        height: 400,
        apiUrl: '/apps/designer'
      });
      
      try {
        // Load the template
        await renderer.loadTemplate(templateId);
        
        // Apply text updates
        if (textUpdates) {
          Object.entries(textUpdates).forEach(([elementId, text]) => {
            renderer.updateText(elementId, text);
          });
        }
        
        // Generate preview
        const previewUrl = renderer.getDataURL({ pixelRatio: 1 });
        
        // Update the product image with loading state
        updateProductImageWithCustomization(previewUrl, true);
        
        console.log('[generateVariantPreviewWithText] Preview generated successfully');
        
      } finally {
        // Clean up
        renderer.destroy();
        document.body.removeChild(tempContainer);
      }
      
    } catch (error) {
      console.error('[generateVariantPreviewWithText] Error generating preview:', error);
      
      // Fallback: Just update the thumbnail from the template if available
      try {
        // Check if we have a cached preview for this variant
        const customizationKey = `customization_${variantId}`;
        const savedCustomization = localStorage.getItem(customizationKey);
        
        if (savedCustomization) {
          const data = JSON.parse(savedCustomization);
          if (data.thumbnail) {
            updateProductImageWithCustomization(data.thumbnail);
            return;
          }
        }
        
        // Otherwise try to get the template thumbnail from the page
        const templateThumb = document.querySelector(`[data-template-thumbnail="${templateId}"]`);
        if (templateThumb && templateThumb.src) {
          updateProductImageWithCustomization(templateThumb.src);
        }
      } catch (e) {
        console.error('[generateVariantPreviewWithText] Fallback failed:', e);
      }
    }
  }
  
  // Helper function to ensure Konva and other resources are loaded
  async function ensureResourcesLoaded() {
    // Check if Konva is already loaded
    if (typeof Konva !== 'undefined') {
      return;
    }
    
    // Load Konva if not already loaded
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/konva@9.3.3/konva.min.js';
      script.onload = () => {
        console.log('[ensureResourcesLoaded] Konva loaded successfully');
        resolve();
      };
      script.onerror = () => {
        console.error('[ensureResourcesLoaded] Failed to load Konva');
        reject(new Error('Failed to load Konva'));
      };
      document.head.appendChild(script);
    });
  }
  
  // Helper function to update product image (shared with liquid template)
  function updateProductImageWithCustomization(previewUrl, showLoading = false) {
    // Find the main product image
    const mainProductImage = document.querySelector(
      '.media-gallery img:first-of-type, ' +
      '.product-media img:first-of-type, ' +
      '.product__media--featured img, ' +
      '[data-product-featured-image]'
    );
    
    if (mainProductImage) {
      // Store original src if not already stored
      mainProductImage.dataset.originalSrc = mainProductImage.dataset.originalSrc || mainProductImage.src;
      
      if (showLoading) {
        // Add loading state
        mainProductImage.style.opacity = '0.5';
        mainProductImage.style.filter = 'grayscale(100%)';
        mainProductImage.style.transition = 'opacity 0.3s, filter 0.3s';
      }
      
      // Create a new image to preload
      const tempImg = new Image();
      tempImg.onload = () => {
        // Image loaded successfully, update the main image
        mainProductImage.src = previewUrl;
        mainProductImage.srcset = ''; // Clear srcset to prevent responsive image issues
        
        // Remove loading state
        setTimeout(() => {
          mainProductImage.style.opacity = '1';
          mainProductImage.style.filter = 'none';
        }, 50);
        
        console.log('[updateProductImage] Image updated successfully');
      };
      
      tempImg.onerror = () => {
        // Failed to load, restore original
        console.error('[updateProductImage] Failed to load preview image');
        mainProductImage.style.opacity = '1';
        mainProductImage.style.filter = 'none';
        
        // Try one more time after a short delay
        setTimeout(() => {
          mainProductImage.src = previewUrl;
        }, 500);
      };
      
      // Start loading
      tempImg.src = previewUrl;
    }
  }

  // Global function to generate variant preview with full canvas state
  async function generateVariantPreviewWithCanvasState(variantId, templateId, canvasState) {
    console.log('[generateVariantPreviewWithCanvasState] Starting preview generation', { variantId, templateId });
    
    try {
      // Ensure required resources are loaded
      await ensureResourcesLoaded();
      
      // Check if we have the CanvasTextRenderer available
      if (typeof CanvasTextRenderer === 'undefined') {
        // Load canvas text renderer if not already loaded
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = window.Shopify.routes.root + 'cdn/shop/t/1/assets/canvas-text-renderer.js?v=' + Date.now();
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }
      
      // Create a temporary container
      const tempContainer = document.createElement('div');
      tempContainer.style.cssText = 'position: absolute; left: -9999px; width: 600px; height: 400px;';
      document.body.appendChild(tempContainer);
      
      // Initialize a temporary renderer
      const renderer = new CanvasTextRenderer(tempContainer, {
        width: 600,
        height: 400,
        apiUrl: '/apps/designer'
      });
      
      try {
        // Load the template first to get the base image
        await renderer.loadTemplate(templateId);
        
        // Then apply the full canvas state (which excludes base image)
        await renderer.loadCanvasState(canvasState);
        
        // Generate preview
        const previewUrl = renderer.getDataURL({ pixelRatio: 1 });
        
        // Update the product image
        updateProductImageWithCustomization(previewUrl, true);
        
        console.log('[generateVariantPreviewWithCanvasState] Preview generated successfully');
        
      } finally {
        // Clean up
        renderer.destroy();
        document.body.removeChild(tempContainer);
      }
      
    } catch (error) {
      console.error('[generateVariantPreviewWithCanvasState] Error generating preview:', error);
      
      // Fallback: Just update the thumbnail from the template if available
      try {
        // Check if we have a cached preview for this variant
        const customizationKey = `customization_${variantId}`;
        const savedCustomization = localStorage.getItem(customizationKey);
        
        if (savedCustomization) {
          const data = JSON.parse(savedCustomization);
          if (data.thumbnail) {
            updateProductImageWithCustomization(data.thumbnail);
            return;
          }
        }
        
        // Otherwise try to get the template thumbnail from the page
        const templateThumb = document.querySelector(`[data-template-thumbnail="${templateId}"]`);
        if (templateThumb && templateThumb.src) {
          updateProductImageWithCustomization(templateThumb.src);
        }
      } catch (e) {
        console.error('[generateVariantPreviewWithCanvasState] Fallback failed:', e);
      }
    }
  }

  // Export for use in theme
  window.ProductCustomizerModal = ProductCustomizerModal;
  window.ProductCustomizerBatchRenderer = ProductCustomizerBatchRenderer;
  window.generateVariantPreviewWithText = generateVariantPreviewWithText;
  window.generateVariantPreviewWithCanvasState = generateVariantPreviewWithCanvasState;
  window.updateProductImageWithCustomization = updateProductImageWithCustomization;
}
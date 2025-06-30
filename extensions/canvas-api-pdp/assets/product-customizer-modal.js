/**
 * Product Customizer Modal
 * Provides a slide-out modal interface for simple text customization
 */

// Global swatch protection system - runs immediately
(function() {
  console.log('[SwatchProtection] Initializing global swatch protection');
  
  // Persistent storage for custom swatches - survives across variant changes and modal closes
  const customSwatchStorage = new Map();
  
  // Check if we have custom swatches saved
  const hasCustomSwatches = () => {
    return customSwatchStorage.size > 0 || document.querySelectorAll(
      '.swatch[data-server-generated="true"], ' +
      '.swatch[data-customization-preview="true"], ' +
      '[data-has-custom-swatches="true"]'
    ).length > 0;
  };
  
  // Save swatch data to persistent storage
  const saveSwatchData = (variantId, style, attributes) => {
    customSwatchStorage.set(variantId, {
      style: style,
      attributes: attributes,
      timestamp: Date.now()
    });
    console.log('[SwatchProtection] Saved swatch data for variant:', variantId);
  };
  
  // Get saved swatch data
  const getSwatchData = (variantId) => {
    return customSwatchStorage.get(variantId);
  };
  
  // Restore swatches from persistent storage
  const restoreSwatchesFromStorage = () => {
    console.log('[SwatchProtection] Restoring swatches from storage, total saved:', customSwatchStorage.size);
    
    let restoredCount = 0;
    let skippedCount = 0;
    
    customSwatchStorage.forEach((data, variantId) => {
      const input = document.querySelector(`input[data-variant-id="${variantId}"]`);
      if (input) {
        const swatch = input.nextElementSibling;
        if (swatch && swatch.classList.contains('swatch')) {
          const currentStyle = swatch.getAttribute('style');
          
          // Check if restoration is needed
          const needsRestoration = () => {
            // If styles are identical, no restoration needed
            if (currentStyle === data.style) return false;
            
            // Extract URLs from both styles
            const currentUrlMatch = currentStyle && currentStyle.match(/url\(([^)]+)\)/);
            const savedUrlMatch = data.style && data.style.match(/url\(([^)]+)\)/);
            
            const currentUrl = currentUrlMatch ? currentUrlMatch[1] : null;
            const savedUrl = savedUrlMatch ? savedUrlMatch[1] : null;
            
            // If saved has custom URL but current doesn't, needs restoration
            if (savedUrl && savedUrl.includes('base64') && !currentUrl) {
              return true;
            }
            
            // If saved has custom URL but current has different URL (not base64), needs restoration
            if (savedUrl && savedUrl.includes('base64') && currentUrl && !currentUrl.includes('base64')) {
              return true;
            }
            
            // If the saved style has data-server-generated attribute but current doesn't
            if (data.attributes['data-server-generated'] === 'true' && 
                swatch.getAttribute('data-server-generated') !== 'true') {
              return true;
            }
            
            return false;
          };
          
          if (needsRestoration()) {
            console.log(`[SwatchProtection] Restoring swatch for variant ${variantId}`, {
              from: currentStyle ? currentStyle.substring(0, 100) + '...' : 'null',
              to: data.style.substring(0, 100) + '...'
            });
            
            swatch.setAttribute('style', data.style);
            Object.entries(data.attributes).forEach(([name, value]) => {
              if (name !== 'style') {
                swatch.setAttribute(name, value);
              }
            });
            
            // Force a repaint to ensure the style is applied
            swatch.offsetHeight;
            restoredCount++;
          } else {
            skippedCount++;
          }
        }
      }
    });
    
    if (restoredCount > 0 || skippedCount > 0) {
      console.log(`[SwatchProtection] Restoration complete: ${restoredCount} restored, ${skippedCount} skipped (already correct)`);
    }
  };
  
  // Detect if we're on a Horizon theme by checking for variant-picker or swatches-variant-picker custom elements
  const isHorizonTheme = () => {
    const variantPicker = document.querySelector('variant-picker');
    const swatchesPicker = document.querySelector('swatches-variant-picker-component');
    
    // Check if either picker exists and is a custom element (not just a regular div)
    const hasVariantPicker = variantPicker && variantPicker.constructor.name !== 'HTMLElement' && variantPicker.constructor.name !== 'HTMLDivElement';
    const hasSwatchesPicker = swatchesPicker && swatchesPicker.constructor.name !== 'HTMLElement' && swatchesPicker.constructor.name !== 'HTMLDivElement';
    
    if (hasVariantPicker || hasSwatchesPicker) {
      console.log('[SwatchProtection] Horizon theme detected');
    }
    
    return hasVariantPicker || hasSwatchesPicker;
  };
  
  // Debounce mechanism to prevent multiple rapid-fire events
  let variantChangeTimeout = null;
  let lastVariantChangeTime = 0;
  
  // Listen for variant changes early - support both standard and Horizon theme events
  const handleVariantChange = function(event) {
    console.log('[SwatchProtection] Variant change:', event.type);
    
    // Debounce multiple events within 50ms
    const now = Date.now();
    if (now - lastVariantChangeTime < 50) {
      console.log('[SwatchProtection] Debouncing rapid variant change event');
      return;
    }
    lastVariantChangeTime = now;
    
    // Clear any pending restoration
    if (variantChangeTimeout) {
      clearTimeout(variantChangeTimeout);
    }
    
    // Look for swatches in both variant-picker and swatches-variant-picker-component
    const variantPicker = document.querySelector('variant-picker');
    const swatchesPicker = document.querySelector('swatches-variant-picker-component');
    
    // Find all custom swatches regardless of which picker they're in
    let customSwatchesSelector = '.swatch[data-server-generated="true"], ' +
      '.swatch[data-customization-preview="true"], ' +
      '.swatch[data-multi-preview="true"]';
    
    // Also check for swatches within the specific pickers
    if (variantPicker) {
      customSwatchesSelector += ', variant-picker .swatch[style*="url("]';
    }
    if (swatchesPicker) {
      customSwatchesSelector += ', swatches-variant-picker-component .swatch[style*="url("]';
    }
    
    const customSwatches = document.querySelectorAll(customSwatchesSelector);
    
    console.log(`[SwatchProtection] Saving ${customSwatches.length} custom swatches before variant change`);
    
    customSwatches.forEach(swatch => {
      const input = swatch.previousElementSibling;
      if (input && input.dataset.variantId) {
        const style = swatch.getAttribute('style');
        
        // Only save if it has a base64 image (custom swatch)
        if (style && style.includes('base64')) {
          saveSwatchData(
            input.dataset.variantId,
            style,
            Array.from(swatch.attributes).reduce((acc, attr) => {
              acc[attr.name] = attr.value;
              return acc;
            }, {})
          );
        }
      }
    });
    
    // For Horizon themes, implement smart restoration strategy
    if (isHorizonTheme()) {
      console.log('[SwatchProtection] Horizon theme detected, using smart restoration strategy');
      
      // Set up a single debounced restoration
      variantChangeTimeout = setTimeout(() => {
        console.log('[SwatchProtection] Starting restoration sequence');
        
        // Strategy 1: Initial restoration
        restoreSwatchesFromStorage();
        
        // Strategy 2: DOM mutation observer for dynamic changes
        const setupTemporaryObserver = () => {
          let observerTimeout;
          const tempObserver = new MutationObserver((mutations) => {
            // Check if any swatches were reset
            const needsRestoration = mutations.some(mutation => {
              if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                const element = mutation.target;
                if (element.classList.contains('swatch')) {
                  const input = element.previousElementSibling;
                  if (input && input.dataset.variantId) {
                    const savedData = getSwatchData(input.dataset.variantId);
                    if (savedData && element.getAttribute('style') !== savedData.style) {
                      return true;
                    }
                  }
                }
              }
              return false;
            });
            
            if (needsRestoration) {
              console.log('[SwatchProtection] Swatch reset detected by observer, restoring...');
              restoreSwatchesFromStorage();
            }
            
            // Auto-disconnect after 2 seconds
            clearTimeout(observerTimeout);
            observerTimeout = setTimeout(() => {
              tempObserver.disconnect();
              console.log('[SwatchProtection] Temporary observer disconnected');
            }, 2000);
          });
          
          // Observe the variant picker area
          const targetNode = variantPicker || document.querySelector('.product-form__variants');
          if (targetNode) {
            tempObserver.observe(targetNode, {
              attributes: true,
              attributeFilter: ['style'],
              subtree: true
            });
            
            // Auto-disconnect after 2 seconds
            observerTimeout = setTimeout(() => {
              tempObserver.disconnect();
              console.log('[SwatchProtection] Temporary observer disconnected');
            }, 2000);
          }
        };
        
        // Set up temporary observer after a short delay
        setTimeout(setupTemporaryObserver, 100);
        
        // Final check after DOM should be stable
        setTimeout(() => {
          console.log('[SwatchProtection] Final restoration check');
          restoreSwatchesFromStorage();
          
          // Check if we need to update product image with customizations
          const currentVariantId = new URLSearchParams(window.location.search).get('variant');
          if (currentVariantId) {
            updateProductImageIfCustomized(currentVariantId);
          }
        }, 500);
        
      }, 100); // Debounce for 100ms
      
    } else {
      // Non-Horizon themes: simpler restoration
      variantChangeTimeout = setTimeout(() => {
        restoreSwatchesFromStorage();
        
        // Check if we need to update product image with customizations
        const currentVariantId = new URLSearchParams(window.location.search).get('variant');
        if (currentVariantId) {
          updateProductImageIfCustomized(currentVariantId);
        }
      }, 100);
    }
  };
  
  // Function to update product image if customizations exist
  const updateProductImageIfCustomized = (variantId) => {
    console.log('[SwatchProtection] Checking if product image update needed for variant:', variantId);
    
    // Check if we have saved customizations
    const savedTextState = localStorage.getItem('customization_global_text');
    if (!savedTextState) {
      console.log('[SwatchProtection] No saved customizations, skipping product image update');
      return;
    }
    
    // Check if modal has been opened at least once
    if (!window.ProductCustomizerModal?.hasBeenOpened) {
      console.log('[SwatchProtection] Modal has not been opened yet, skipping product image update');
      return;
    }
    
    // Check if we have an active modal instance
    const modal = window.ProductCustomizerModal?.activeInstance;
    if (!modal) {
      console.log('[SwatchProtection] No active modal instance, skipping product image update');
      return;
    }
    
    // Get current variant title to check for pattern changes
    const currentVariantTitle = modal.getVariantTitle();
    const currentPattern = extractPatternFromTitle(currentVariantTitle);
    
    // Check if pattern has changed
    if (window.lastKnownPattern && currentPattern && window.lastKnownPattern !== currentPattern) {
      console.log('[SwatchProtection] Pattern change detected:', window.lastKnownPattern, '->', currentPattern);
      
      // Trigger swatch regeneration for pattern change
      clearTimeout(window.swatchUpdateTimer);
      window.swatchUpdateTimer = setTimeout(() => {
        console.log('[SwatchProtection] Triggering swatch update for pattern change');
        updateVariantSwatchesForPatternChange(modal.options.templateId, currentVariantTitle, modal);
      }, 300);
    }
    
    // Update the last known pattern
    window.lastKnownPattern = currentPattern;
    
    // Debounce to prevent rapid updates
    clearTimeout(window.productImageUpdateTimer);
    window.productImageUpdateTimer = setTimeout(() => {
      console.log('[SwatchProtection] Triggering product image update for variant:', variantId);
      modal.updateProductImageForVariant(variantId);
    }, 200);
  };
  
  // Helper function to extract pattern from variant title
  const extractPatternFromTitle = (title) => {
    if (!title) return null;
    // Variant titles are typically "Color / Pattern"
    const parts = title.split(' / ');
    return parts.length > 1 ? parts[1].trim() : null;
  };
  
  // Function to update variant swatches when pattern changes
  const updateVariantSwatchesForPatternChange = async (templateId, variantTitle, modal) => {
    console.log('[SwatchProtection] Starting variant swatch update for pattern change');
    
    // Check if we have saved text customizations
    const savedTextState = localStorage.getItem('customization_global_text');
    if (!savedTextState) {
      console.log('[SwatchProtection] No saved text customizations, skipping swatch update');
      return;
    }
    
    try {
      const textState = JSON.parse(savedTextState);
      const currentPattern = extractPatternFromTitle(variantTitle);
      
      if (!currentPattern) {
        console.log('[SwatchProtection] Could not extract pattern from variant title');
        return;
      }
      
      // Find all color variant inputs for the current pattern
      const colorInputs = document.querySelectorAll('input[type="radio"][name*="Color"]');
      const variants = [];
      
      colorInputs.forEach((input) => {
        const variantId = input.getAttribute('data-variant-id');
        const variantValue = input.value;
        
        // Check if this variant is for the current pattern
        // We need to check if this color variant exists for the current pattern
        if (variantId && variantValue) {
          // Extract just the color part from the value (e.g., "Red" from "Red / 8 Spot")
          const colorName = variantValue.split(' / ')[0].trim();
          variants.push({ id: variantId, color: colorName });
        }
      });
      
      if (variants.length === 0) {
        console.log('[SwatchProtection] No color variants found');
        return;
      }
      
      console.log(`[SwatchProtection] Found ${variants.length} color variants to update`);
      
      // Prepare customization data
      const customizationData = {
        textUpdates: textState,
        canvasState: null
      };
      
      // Check if we have saved canvas state from full designer
      const savedCanvasState = localStorage.getItem('customization_global_state');
      if (savedCanvasState) {
        try {
          customizationData.canvasState = JSON.parse(savedCanvasState);
        } catch (e) {
          console.error('[SwatchProtection] Failed to parse saved canvas state');
        }
      }
      
      // Call server API to generate swatches
      const apiUrl = modal.options.apiUrl || '/apps/designer';
      const response = await fetch(`${apiUrl}/api/public/variant-swatches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: templateId,
          variants: variants,
          customization: customizationData,
          options: { 
            size: 128, 
            quality: 0.8, 
            side: 'front' // Always use front for swatches
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      
      const result = await response.json();
      
      // Update swatches in DOM
      if (result.success && result.swatches) {
        console.log(`[SwatchProtection] Successfully generated ${result.generatedCount} swatches`);
        
        Object.entries(result.swatches).forEach(([variantId, dataUrl]) => {
          const input = document.querySelector(`input[data-variant-id="${variantId}"]`);
          if (input) {
            const swatchSpan = input.nextElementSibling;
            if (swatchSpan && swatchSpan.classList.contains('swatch')) {
              // Store original if not already stored
              if (!swatchSpan.dataset.originalBackground) {
                const currentStyle = swatchSpan.getAttribute('style');
                swatchSpan.dataset.originalBackground = currentStyle || '';
              }
              
              // Update with server-generated swatch
              const newStyle = `--swatch-background: url(${dataUrl});`;
              swatchSpan.style.cssText = newStyle;
              swatchSpan.setAttribute('data-customization-preview', 'true');
              swatchSpan.setAttribute('data-server-generated', 'true');
              swatchSpan.setAttribute('data-custom-timestamp', Date.now().toString());
              
              // Save to global swatch protection storage
              saveSwatchData(
                variantId,
                newStyle,
                {
                  'data-customization-preview': 'true',
                  'data-server-generated': 'true',
                  'data-custom-timestamp': Date.now().toString()
                }
              );
            }
          }
        });
        
        console.log('[SwatchProtection] Variant swatches updated successfully');
      } else {
        console.error('[SwatchProtection] Server swatch generation failed:', result.error);
      }
    } catch (error) {
      console.error('[SwatchProtection] Error updating variant swatches:', error);
    }
  };
  
  // Set up MutationObserver to watch for DOM morphing on variant pickers
  const setupVariantPickerObserver = () => {
    console.log('[SwatchProtection] Setting up variant picker observers');
    
    // Helper function to create observer for a specific picker element
    const createPickerObserver = (picker, pickerType) => {
      console.log(`[SwatchProtection] Creating observer for ${pickerType}`);
      
      let morphDetected = false;
      const observer = new MutationObserver((mutations) => {
        // Check if children were replaced (indicating morph operation)
        const childListChanged = mutations.some(m => m.type === 'childList' && (m.addedNodes.length > 0 || m.removedNodes.length > 0));
        
        if (childListChanged && !morphDetected) {
          morphDetected = true;
          console.log(`[SwatchProtection] DOM morph detected on ${pickerType}`);
          
          // Immediately save any existing custom swatches before they're lost
          const swatchesToSave = document.querySelectorAll(
            '.swatch[data-server-generated="true"], ' +
            '.swatch[data-customization-preview="true"], ' +
            '.swatch[data-multi-preview="true"], ' +
            '.swatch[style*="base64"]'
          );
          console.log(`[SwatchProtection] Saving ${swatchesToSave.length} custom swatches before morph`);
          
          swatchesToSave.forEach(swatch => {
            const input = swatch.previousElementSibling;
            if (input && input.dataset.variantId) {
              // Only save if it has custom styling (base64)
              const style = swatch.getAttribute('style');
              if (style && style.includes('base64')) {
                saveSwatchData(
                  input.dataset.variantId,
                  style,
                  Array.from(swatch.attributes).reduce((acc, attr) => {
                    acc[attr.name] = attr.value;
                    return acc;
                  }, {})
                );
              }
            }
          });
          
          // Restore swatches after a short delay to allow morph to complete
          setTimeout(() => {
            console.log('[SwatchProtection] Restoring swatches after morph');
            restoreSwatchesFromStorage();
            morphDetected = false; // Reset flag for next morph
          }, 100);
        }
      });
      
      // Observe the variant picker for child list changes
      observer.observe(picker, {
        childList: true,
        subtree: true
      });
      
      console.log(`[SwatchProtection] MutationObserver attached to ${pickerType}`);
    };
    
    // Set up observer for variant-picker (dropdowns)
    const variantPicker = document.querySelector('variant-picker');
    if (variantPicker) {
      createPickerObserver(variantPicker, 'variant-picker');
    }
    
    // Set up observer for swatches-variant-picker-component (color swatches)
    const swatchesPicker = document.querySelector('swatches-variant-picker-component');
    if (swatchesPicker) {
      createPickerObserver(swatchesPicker, 'swatches-variant-picker-component');
    }
    
    // If neither picker found, retry later
    if (!variantPicker && !swatchesPicker) {
      console.log('[SwatchProtection] No variant pickers found, retrying in 500ms...');
      setTimeout(setupVariantPickerObserver, 500);
    }
  };
  
  // Monitor URL changes for variant parameter - this is the most reliable
  const setupURLMonitoring = () => {
    console.log('[SwatchProtection] Setting up URL monitoring for variant changes');
    
    let lastVariantId = new URLSearchParams(window.location.search).get('variant');
    
    const checkForVariantChange = () => {
      const currentVariantId = new URLSearchParams(window.location.search).get('variant');
      if (currentVariantId !== lastVariantId) {
        console.log('[SwatchProtection] URL variant change detected:', lastVariantId, '->', currentVariantId);
        lastVariantId = currentVariantId;
        handleVariantChange({ type: 'url-change', variantId: currentVariantId });
      }
    };
    
    // Check for URL changes periodically
    setInterval(checkForVariantChange, 100);
  };
  
  // Initialize variant picker observer if on Horizon theme
  if (isHorizonTheme()) {
    console.log('[SwatchProtection] Horizon theme detected, setting up variant picker observer');
    setupVariantPickerObserver();
    
    // Intercept the morph() function if it exists
    if (window.morph && typeof window.morph === 'function') {
      console.log('[SwatchProtection] Intercepting morph() function');
      const originalMorph = window.morph;
      
      window.morph = function(target, source, options) {
        console.log('[SwatchProtection] morph() called', { target, source, options });
        
        // Before morph: Save all custom swatches
        const customSwatches = document.querySelectorAll(
          '.swatch[data-server-generated="true"], ' +
          '.swatch[data-customization-preview="true"], ' +
          '.swatch[style*="url("]'
        );
        
        console.log(`[SwatchProtection] Pre-morph: saving ${customSwatches.length} custom swatches`);
        
        customSwatches.forEach(swatch => {
          const input = swatch.previousElementSibling;
          if (input && input.dataset.variantId) {
            saveSwatchData(
              input.dataset.variantId,
              swatch.getAttribute('style'),
              Array.from(swatch.attributes).reduce((acc, attr) => {
                acc[attr.name] = attr.value;
                return acc;
              }, {})
            );
          }
        });
        
        // Call the original morph function
        const result = originalMorph.call(this, target, source, options);
        
        // After morph: Restore custom swatches
        console.log('[SwatchProtection] Post-morph: restoring swatches');
        
        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
          restoreSwatchesFromStorage();
          
          // Double-check after a short delay
          setTimeout(() => {
            console.log('[SwatchProtection] Post-morph: final restoration check');
            restoreSwatchesFromStorage();
          }, 100);
        });
        
        return result;
      };
      
      console.log('[SwatchProtection] morph() function successfully intercepted');
    } else {
      console.log('[SwatchProtection] morph() function not found, will rely on MutationObserver');
    }
  }
  
  // Set up immediate variant monitoring
  console.log('[SwatchProtection] Setting up variant monitoring');
  
  // Monitor URL changes - most reliable method
  setupURLMonitoring();
  
  // Single click listener for immediate feedback
  document.addEventListener('click', (event) => {
    // Only listen for color radio changes
    const radio = event.target.matches('input[type="radio"][name*="Color"]') ? event.target : 
                  event.target.closest('label')?.querySelector('input[type="radio"][name*="Color"]');
    
    if (radio) {
      console.log('[SwatchProtection] Color variant clicked:', radio.value);
      handleVariantChange({ type: 'color-click', target: radio });
    }
  }, true);
  
  // Make functions globally available
  window.SwatchProtection = {
    hasCustomSwatches,
    saveSwatchData,
    getSwatchData,
    restoreSwatchesFromStorage,
    updateVariantSwatchesForPatternChange,
    updateProductImageIfCustomized,
    clearCustomSwatches: () => {
      console.log('[SwatchProtection] Clearing all custom swatches');
      customSwatchStorage.clear();
      document.querySelectorAll('.swatch[data-server-generated="true"]').forEach(swatch => {
        swatch.removeAttribute('data-server-generated');
        swatch.removeAttribute('data-customization-preview');
        swatch.removeAttribute('data-custom-timestamp');
        swatch.removeAttribute('style');
      });
      document.querySelectorAll('[data-has-custom-swatches]').forEach(el => {
        el.removeAttribute('data-has-custom-swatches');
      });
    }
  };
  
  console.log('[SwatchProtection] Global protection ready');
})();

if (typeof ProductCustomizerModal === 'undefined') {
  console.log('[ProductCustomizer] Defining ProductCustomizerModal class');
  
  // Cache for generated previews to avoid regeneration
  class PreviewCache {
    static cache = new Map();
    static maxSize = 10;
    
    static set(variantId, preview) {
      // LRU cache implementation
      if (this.cache.size >= this.maxSize) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
      this.cache.set(variantId, preview);
    }
    
    static get(variantId) {
      const preview = this.cache.get(variantId);
      if (preview) {
        // Move to end (most recently used)
        this.cache.delete(variantId);
        this.cache.set(variantId, preview);
      }
      return preview;
    }
    
    static clear() {
      this.cache.clear();
    }
  }
  
  class ProductCustomizerModal {
  static activeInstance = null;
  static hasBeenOpened = false;
  static isUpdatingProductImage = false;
  
  constructor(options = {}) {
    console.log('[ProductCustomizer] Constructor called with options:', options);
    
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
    this.swatchUpdateTimer = null; // Timer for server-side swatch generation
    this.originalProductImages = []; // Store original images to restore later
    this.currentPreviewUrl = null; // Store current preview URL
    
    // Dual-sided support
    this.isDualSided = false;
    this.frontPreviewUrl = null;
    this.backPreviewUrl = null;
    
    // Track which side was last edited
    this.lastEditedSide = 'front';
    
    // Timer for debounced text state saving
    this.textSaveTimer = null;
    
    // Set this instance as the active one
    ProductCustomizerModal.activeInstance = this;
  }

  init() {
    console.log('[ProductCustomizer] init() called');
    
    try {
      this.createModal();
      this.attachEventListeners();
      this.setupMessageListener();
      this.interceptVariantChanges();
      
      // Make debug method globally accessible
      window._productCustomizerDebug = () => this.debugSlideshowComponent();
      
      console.log('[ProductCustomizer] init() completed successfully');
    } catch (error) {
      console.error('[ProductCustomizer] Error during initialization:', error);
    }
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
        
        .pcm-text-section {
          margin-bottom: 20px;
        }
        
        .pcm-text-section:last-child {
          margin-bottom: 0;
        }
        
        .pcm-section-title {
          font-size: 14px;
          font-weight: 600;
          color: #333;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid #e5e5e5;
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
        
        /* Product image blur transition styles */
        .product-image-transitioning {
          transition: opacity 0.3s ease, filter 0.3s ease;
          opacity: 0.3;
          filter: blur(10px);
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
    ProductCustomizerModal.hasBeenOpened = true;
    
    // Reset to front side when opening
    this.lastEditedSide = 'front';
    
    // Only prevent body scroll on mobile
    if (window.innerWidth <= 749) {
      document.body.style.overflow = 'hidden';
    }
    
    // Store original product image so we can restore it later
    this.storeOriginalProductImage();
    
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
    
    // Load template directly from API
    // The renderer will automatically handle frontCanvasData and backCanvasData
    await this.renderer.loadTemplate(this.options.templateId);
    
    // Check if this is a dual-sided template
    if (this.renderer.isDualSided) {
      this.isDualSided = true;
      console.log('[ProductCustomizer] Dual-sided template detected');
      
      // Ensure we're on the front canvas
      if (this.renderer.template !== this.renderer.frontCanvasData) {
        this.renderer.template = this.renderer.frontCanvasData;
      }
    }
    
    // Load any saved global text state
    this.savedTextUpdates = this.loadGlobalTextState();
    
    // Create text inputs based on template
    this.createTextInputs();
    
    // Apply saved text if available
    if (this.savedTextUpdates && this.renderer) {
      this.applyGlobalTextState();
    }
    
    // Generate initial preview
    this.updatePreview();
  }
  
  applyGlobalTextState() {
    if (!this.savedTextUpdates || !this.renderer) return;
    
    console.log('[ProductCustomizer] Applying global text state to renderer');
    
    if (this.isDualSided) {
      // Apply text directly to the canvas data without switching
      
      // Update front canvas data
      if (this.renderer.frontCanvasData) {
        Object.entries(this.savedTextUpdates).forEach(([key, value]) => {
          if (key.startsWith('front_')) {
            const elementId = key.replace('front_', '');
            // Find and update the text element in frontCanvasData
            const frontElements = this.renderer.frontCanvasData.elements;
            ['textElements', 'curvedTextElements', 'gradientTextElements'].forEach(elementType => {
              if (frontElements[elementType]) {
                const element = frontElements[elementType].find(el => el.id === elementId);
                if (element) {
                  element.text = value;
                }
              }
            });
          }
        });
      }
      
      // Update back canvas data
      if (this.renderer.backCanvasData) {
        Object.entries(this.savedTextUpdates).forEach(([key, value]) => {
          if (key.startsWith('back_')) {
            const elementId = key.replace('back_', '');
            // Find and update the text element in backCanvasData
            const backElements = this.renderer.backCanvasData.elements;
            ['textElements', 'curvedTextElements', 'gradientTextElements'].forEach(elementType => {
              if (backElements[elementType]) {
                const element = backElements[elementType].find(el => el.id === elementId);
                if (element) {
                  element.text = value;
                }
              }
            });
          }
        });
      }
      
      // Ensure we're displaying the front canvas
      this.renderer.template = this.renderer.frontCanvasData;
      this.renderer.render();
    } else {
      // Apply text to single-sided template
      Object.entries(this.savedTextUpdates).forEach(([elementId, value]) => {
        this.renderer.updateText(elementId, value);
      });
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
      // First try Horizon theme selectors
      mainProductImage = mainProductSection.querySelector(
        // Horizon 2025 themes
        'media-gallery img:first-of-type, ' +
        'media-gallery slideshow-component img:first-of-type, ' +
        'slideshow-component img.selected, ' +
        'slideshow-component img[aria-selected="true"]'
      );
      
      // If not found, try Dawn-based themes
      if (!mainProductImage) {
        mainProductImage = mainProductSection.querySelector(
          // Dawn themes - active/selected images
          '[data-media-type="image"][data-media-active="true"] img, ' +
          '[data-product-media].is-active img, ' +
          '.product-media.is-active img, ' +
          '.media-gallery__image.is-active img, ' +
          '.media.is-active img, ' +
          // Dawn themes - featured/main images
          '.product__media--featured img, ' +
          '.product__main-photos .slick-current img, ' +
          '.product-single__photo--main img, ' +
          '[data-media-type] img:first-of-type'
        );
      }
      
      // If still not found, try legacy themes
      if (!mainProductImage) {
        mainProductImage = mainProductSection.querySelector(
          '[data-product-featured-image], ' +
          '.media-gallery img:first-of-type, ' +  // Class-based media gallery
          '.product-media img:first-of-type, ' +
          '.media img:first-of-type, ' +
          '.product-gallery img:first-of-type, ' +
          '.product-images img:first-of-type'
        );
      }
      
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
  
  updateMainProductImage(previewUrl) {
    // Use passed URL or fall back to current preview URL
    const urlToUse = previewUrl || this.currentPreviewUrl;
    if (!urlToUse) {
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
        
        mainImage.element.src = urlToUse;
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
      const mainProductImage = this.findMainProductImage();
      
      if (mainProductImage) {
        // Store original source if not already stored
        if (!mainProductImage.dataset.originalSrc) {
          mainProductImage.dataset.originalSrc = mainProductImage.src;
        }
        mainProductImage.src = urlToUse;
        mainProductImage.srcset = ''; // Clear srcset
        mainProductImage.setAttribute('data-customization-preview', 'true');
      }
    }
    
    // Also update the slideshow thumbnails
    this.updateSlideshowThumbnails();
  }
  
  updateSpecificMainImage(previewUrl, isBack = false) {
    if (!previewUrl) {
      return;
    }
    
    // Get current variant title
    const variantTitle = this.getVariantTitle();
    if (!variantTitle) {
      console.warn('[ProductCustomizer] Could not determine variant title for specific image update');
      return;
    }
    
    console.log('[ProductCustomizer] Updating specific main image:', isBack ? 'Back' : 'Front', 'for variant:', variantTitle);
    
    // Find all main slideshow images (not thumbnails)
    const mainImages = document.querySelectorAll(
      'slideshow-slide img:not([data-role="thumb"]):not(.thumbnail), ' +
      '.product-media img:not([data-role="thumb"]):not(.thumbnail), ' +
      'media-gallery slideshow-component img:not([data-role="thumb"]):not(.thumbnail)'
    );
    
    // Find the specific image based on alt text
    let targetImage = null;
    for (const img of mainImages) {
      if (this.matchesVariant(img.alt, variantTitle, isBack)) {
        targetImage = img;
        break;
      }
    }
    
    if (!targetImage) {
      // Fallback: try fuzzy match
      for (const img of mainImages) {
        if (this.fuzzyMatchesVariant(img.alt, variantTitle, isBack)) {
          targetImage = img;
          break;
        }
      }
    }
    
    if (targetImage) {
      console.log('[ProductCustomizer] Found specific main image to update:', targetImage.alt);
      
      // Store original state if not already stored
      if (!targetImage.dataset.originalSrc) {
        targetImage.dataset.originalSrc = targetImage.src;
        targetImage.dataset.originalSrcset = targetImage.srcset || '';
      }
      
      // Update the image
      targetImage.src = previewUrl;
      targetImage.srcset = ''; // Clear srcset
      targetImage.setAttribute('data-customization-preview', 'true');
      
      console.log('[ProductCustomizer] Updated specific main image');
    } else {
      console.warn('[ProductCustomizer] Could not find specific main image for:', variantTitle, isBack ? '- Back' : '');
    }
  }
  
  getVariantTitle() {
    // Try to get variant title from multiple sources
    
    // 1. Check for selected variant option
    const variantSelector = document.querySelector('[name="id"] option:checked, input[name="id"]:checked');
    if (variantSelector && variantSelector.textContent) {
      return variantSelector.textContent.trim();
    }
    
    // 2. Check variant picker labels
    const selectedOptions = [];
    const colorInput = document.querySelector('input[type="radio"]:checked[name*="Color"], input[type="radio"]:checked[name*="color"]');
    const patternInput = document.querySelector('input[type="radio"]:checked[name*="Pattern"], input[type="radio"]:checked[name*="Edge"]');
    
    if (colorInput) {
      selectedOptions.push(colorInput.value);
    }
    if (patternInput) {
      selectedOptions.push(patternInput.value);
    }
    
    if (selectedOptions.length > 0) {
      return selectedOptions.join(' / ');
    }
    
    // 3. Try to get from product meta information
    if (window.ShopifyAnalytics && window.ShopifyAnalytics.meta && window.ShopifyAnalytics.meta.product) {
      const product = window.ShopifyAnalytics.meta.product;
      const variant = product.variants.find(v => v.id == this.options.variantId);
      if (variant) {
        return variant.title || variant.name;
      }
    }
    
    return null;
  }
  
  updateSlideshowThumbnails() {
    console.log('[ProductCustomizer] Starting alt-text based thumbnail update');
    
    // Get current variant title
    const variantTitle = this.getVariantTitle();
    if (!variantTitle) {
      console.warn('[ProductCustomizer] Could not determine variant title');
      return;
    }
    
    console.log('[ProductCustomizer] Current variant:', variantTitle);
    
    // TODO: Re-implement caching for performance optimization
    
    // Find and update thumbnails
    if (this.isDualSided) {
      // Update front thumbnail
      if (this.frontPreviewUrl) {
        const frontThumbnail = this.findThumbnailByAltText(variantTitle, false);
        if (frontThumbnail) {
          this.updateThumbnailImage(frontThumbnail, this.frontPreviewUrl);
          console.log('[ProductCustomizer] Updated front thumbnail');
        } else {
          console.warn('[ProductCustomizer] Could not find front thumbnail for:', variantTitle);
        }
      }
      
      // Update back thumbnail
      if (this.backPreviewUrl) {
        console.log('[ProductCustomizer] LOOKING FOR BACK THUMBNAIL:', {
          variantTitle: variantTitle,
          expectedAltPattern: `${variantTitle} - Back`,
          lastEditedSide: this.lastEditedSide
        });
        
        const backThumbnail = this.findThumbnailByAltText(variantTitle, true);
        if (backThumbnail) {
          console.log('[ProductCustomizer] FOUND BACK THUMBNAIL TO UPDATE:', {
            altText: backThumbnail.alt,
            currentSrc: backThumbnail.src.substring(0, 100) + '...',
            newPreviewLength: this.backPreviewUrl.length,
            element: backThumbnail
          });
          this.updateThumbnailImage(backThumbnail, this.backPreviewUrl);
          console.log('[ProductCustomizer] Updated back thumbnail');
        } else {
          console.warn('[ProductCustomizer] Could not find back thumbnail for:', variantTitle);
          // Debug: show what thumbnails we did find
          const allThumbnails = document.querySelectorAll('slideshow-controls button.slideshow-controls__thumbnail img');
          console.log('[ProductCustomizer] Available thumbnails in controls:', allThumbnails.length);
          const backThumbnails = Array.from(allThumbnails).filter(img => img.alt && img.alt.includes('- Back'));
          console.log('[ProductCustomizer] Back thumbnails found:', backThumbnails.map(img => img.alt));
        }
      }
    } else {
      // For single-sided templates, only update the front image
      if (this.currentPreviewUrl) {
        const frontThumbnail = this.findThumbnailByAltText(variantTitle, false);
        if (frontThumbnail) {
          this.updateThumbnailImage(frontThumbnail, this.currentPreviewUrl);
          console.log('[ProductCustomizer] Updated single-sided thumbnail');
        } else {
          console.warn('[ProductCustomizer] Could not find thumbnail for:', variantTitle);
        }
      }
    }
  }
  
  findThumbnailByAltText(variantTitle, isBack = false) {
    // TODO: Re-implement caching for performance optimization
    
    // Query for thumbnail images more specifically
    // Focus on the slideshow controls thumbnails, not the main slides
    const thumbnails = document.querySelectorAll(
      'slideshow-controls button.slideshow-controls__thumbnail img, ' +  // Thumbnail controls
      'button.slideshow-control img'  // Fallback
    );
    
    if (isBack) {
      console.log('[ProductCustomizer] SEARCHING FOR BACK THUMBNAIL:', {
        lookingFor: `${variantTitle} - Back`,
        totalThumbnailsFound: thumbnails.length
      });
    }
    
    // First pass: exact match
    for (const img of thumbnails) {
      if (isBack && img.alt) {
        console.log('[ProductCustomizer] Checking alt text:', img.alt);
      }
      
      if (this.matchesVariant(img.alt, variantTitle, isBack)) {
        if (isBack) {
          console.log('[ProductCustomizer] EXACT MATCH FOUND:', img.alt);
        }
        return img;
      }
    }
    
    // Second pass: fuzzy match (for edge cases)
    for (const img of thumbnails) {
      if (this.fuzzyMatchesVariant(img.alt, variantTitle, isBack)) {
        console.log('[ProductCustomizer] Using fuzzy match for:', img.alt);
        return img;
      }
    }
    
    if (isBack) {
      console.log('[ProductCustomizer] NO BACK THUMBNAIL FOUND');
    }
    
    return null;
  }
  
  matchesVariant(altText, variantTitle, isBack) {
    if (!altText) return false;
    
    // Normalize text for comparison
    const normalizedAlt = altText.toLowerCase().trim();
    const normalizedVariant = variantTitle.toLowerCase().trim();
    
    // Check if alt text contains the variant title
    if (!normalizedAlt.includes(normalizedVariant)) {
      return false;
    }
    
    // Check if it's the correct side (front/back)
    const isBackImage = normalizedAlt.endsWith('- back');
    return isBackImage === isBack;
  }
  
  fuzzyMatchesVariant(altText, variantTitle, isBack) {
    if (!altText) return false;
    
    const normalizedAlt = altText.toLowerCase().trim();
    const isBackImage = normalizedAlt.endsWith('- back');
    
    // Check if side matches
    if (isBackImage !== isBack) {
      return false;
    }
    
    // Extract color and pattern from variant title
    const parts = variantTitle.split(' / ');
    if (parts.length >= 2) {
      const color = parts[0].toLowerCase().trim();
      const pattern = parts[1].toLowerCase().trim();
      
      // Check if alt text contains both color and pattern
      return normalizedAlt.includes(color) && normalizedAlt.includes(pattern);
    }
    
    // Fallback: partial match
    const variantWords = variantTitle.toLowerCase().split(/\s+/);
    const matchedWords = variantWords.filter(word => normalizedAlt.includes(word));
    return matchedWords.length >= variantWords.length * 0.7; // 70% match threshold
  }
  
  updateThumbnailImage(img, previewUrl) {
    // Store original state if not already stored
    if (!img.dataset.originalSrc) {
      img.dataset.originalSrc = img.src;
      img.dataset.originalSrcset = img.srcset || '';
      img.dataset.originalSizes = img.getAttribute('sizes') || '';
    }
    
    // Clone the current src to detect if it's already base64
    const isAlreadyBase64 = img.src.startsWith('data:');
    
    // If already base64, we need to force a visual update
    if (isAlreadyBase64) {
      console.log('[ProductCustomizer] Image already has base64, forcing cache bust');
      // Temporarily set to a different image to force re-render
      img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; // 1x1 transparent gif
    }
    
    // Update the image with a small delay if it was already base64
    setTimeout(() => {
      img.src = previewUrl;
      img.srcset = '';
      img.removeAttribute('sizes');
      img.removeAttribute('loading'); // Remove lazy loading
      img.setAttribute('data-customization-preview', 'true');
      
      // Force the image to be considered "loaded" by the browser
      if (img.complete) {
        img.dispatchEvent(new Event('load', { bubbles: true }));
      }
    }, isAlreadyBase64 ? 50 : 0);
    
    // Find the media gallery component
    const mediaGallery = img.closest('media-gallery');
    if (mediaGallery && mediaGallery.slideshow) {
      // The media-gallery has a slideshow property with methods
      console.log('[ProductCustomizer] Found media-gallery with slideshow component');
      
      // Get current slide index
      const slides = mediaGallery.querySelectorAll('slideshow-slide');
      let currentIndex = -1;
      slides.forEach((slide, idx) => {
        if (slide.getAttribute('aria-hidden') === 'false') {
          currentIndex = idx;
        }
      });
      
      // Instead of switching slides, try to trigger a visual update
      if (typeof mediaGallery.slideshow.pause === 'function' && typeof mediaGallery.slideshow.resume === 'function') {
        console.log('[ProductCustomizer] Pausing and resuming slideshow to force refresh');
        mediaGallery.slideshow.pause();
        setTimeout(() => {
          mediaGallery.slideshow.resume();
        }, 10);
      }
    } else {
      // Fallback to generic slideshow search
      const slideshow = img.closest('slideshow-component, media-gallery');
      if (slideshow) {
        console.log('[ProductCustomizer] Dispatching slideshow-update event');
        slideshow.dispatchEvent(new CustomEvent('slideshow-update', { 
          detail: { thumbnailUpdated: true },
          bubbles: true 
        }));
      }
    }
    
    // Also try the controls component
    const controls = img.closest('slideshow-controls');
    if (controls && controls !== mediaGallery) {
      if (typeof controls.update === 'function') {
        console.log('[ProductCustomizer] Calling controls.update()');
        controls.update();
      } else if (typeof controls.refresh === 'function') {
        console.log('[ProductCustomizer] Calling controls.refresh()');
        controls.refresh();
      }
    }
    
    // Try updating the parent slide element
    const slide = img.closest('slideshow-slide');
    if (slide) {
      // Force a re-render by toggling visibility
      const display = slide.style.display;
      slide.style.display = 'none';
      slide.offsetHeight; // Force reflow
      slide.style.display = display || '';
      console.log('[ProductCustomizer] Forced slide re-render');
    }
    
    // If no component methods worked, try MutationObserver as fallback
    if (!mediaGallery || !mediaGallery.slideshow) {
      console.log('[ProductCustomizer] No slideshow API found, using MutationObserver fallback');
      
      // Set up observer to prevent reversion
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
            if (img.src !== previewUrl && !img.src.startsWith('data:')) {
              console.log('[ProductCustomizer] Slideshow tried to restore image, re-applying custom preview');
              img.src = previewUrl;
            }
          }
        });
      });
      
      observer.observe(img, { attributes: true, attributeFilter: ['src'] });
      
      // Store observer to disconnect later
      if (img._customizationObserver) {
        img._customizationObserver.disconnect();
      }
      img._customizationObserver = observer;
    }
    
    console.log('[ProductCustomizer] Thumbnail image updated');
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
    
    // Restore slideshow thumbnails
    const customizedThumbnails = document.querySelectorAll(
      'slideshow-slide img[data-customization-preview="true"], ' +  // Horizon theme
      'button.slideshow-control img[data-customization-preview="true"], ' +
      'button.slideshow-controls__thumbnail img[data-customization-preview="true"], ' +
      '.slideshow-nav__button img[data-customization-preview="true"], ' +
      '.product__thumb img[data-customization-preview="true"]'
    );
    
    customizedThumbnails.forEach(thumbnail => {
      if (thumbnail.dataset.originalSrc) {
        thumbnail.src = thumbnail.dataset.originalSrc;
        if (thumbnail.dataset.originalSrcset) {
          thumbnail.srcset = thumbnail.dataset.originalSrcset;
        }
        if (thumbnail.dataset.originalSizes) {
          thumbnail.setAttribute('sizes', thumbnail.dataset.originalSizes);
        }
        thumbnail.removeAttribute('data-customization-preview');
        delete thumbnail.dataset.originalSrc;
        delete thumbnail.dataset.originalSrcset;
        delete thumbnail.dataset.originalSizes;
        
        // Disconnect any mutation observer
        if (thumbnail._customizationObserver) {
          thumbnail._customizationObserver.disconnect();
          delete thumbnail._customizationObserver;
        }
      }
    });
    
    // Also restore variant swatches
    this.restoreOriginalVariantSwatches();
  }
  
  updateVariantSwatches() {
    // For dual-sided templates, always use front preview for swatches
    // For single-sided templates, use current preview
    const previewUrlToUse = this.isDualSided ? this.frontPreviewUrl : this.currentPreviewUrl;
    
    if (!previewUrlToUse) {
      console.log('[ProductCustomizer] No preview URL available for swatch update');
      return;
    }
    
    console.log('[ProductCustomizer] Updating variant swatches for variant:', this.options.variantId);
    console.log('[ProductCustomizer] Using preview URL:', this.isDualSided ? 'front preview' : 'current preview');
    
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
      const newStyle = `--swatch-background: url(${previewUrlToUse});`;
      swatchSpan.setAttribute('style', newStyle);
      swatchSpan.setAttribute('data-customization-preview', 'true');
      
      // Truncate the data URL for logging
      const truncatedUrl = previewUrlToUse.substring(0, 50) + '...';
      console.log('[ProductCustomizer] Updated swatch background to:', truncatedUrl);
      
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
          
          const newStyle = `--swatch-background: url(${previewUrlToUse});`;
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
  
  async generateServerSideSwatches() {
    console.log('[ProductCustomizer] Generating server-side swatches...');
    
    // Find all color variant radio inputs
    const colorInputs = document.querySelectorAll('input[type="radio"][name*="Color"]');
    const variants = [];
    
    // Collect variant IDs and colors (max 20 for safety)
    colorInputs.forEach((input, index) => {
      if (index < 20) { // Limit to 20 variants
        const variantId = input.getAttribute('data-variant-id');
        const color = input.value;
        if (variantId) {
          variants.push({ id: variantId, color });
        }
      }
    });
    
    if (variants.length === 0) {
      console.log('[ProductCustomizer] No color variants found');
      return;
    }
    
    console.log(`[ProductCustomizer] Found ${variants.length} color variants to generate swatches for`);
    
    // Prepare customization data
    const customizationData = {
      textUpdates: {},
      canvasState: null
    };
    
    // Check if we have saved canvas state from full designer
    const savedState = localStorage.getItem('customization_global_state');
    if (savedState) {
      try {
        customizationData.canvasState = JSON.parse(savedState);
      } catch (e) {
        console.error('[ProductCustomizer] Failed to parse saved canvas state');
      }
    }
    
    // Get current text updates
    if (this.renderer) {
      if (this.isDualSided) {
        // For dual-sided templates, get text from front side only
        if (this.renderer.frontCanvasData) {
          const originalTemplate = this.renderer.template;
          this.renderer.template = this.renderer.frontCanvasData;
          const textElements = this.renderer.getAllTextElements();
          textElements.forEach(el => {
            customizationData.textUpdates[el.id] = el.text;
          });
          this.renderer.template = originalTemplate;
        }
      } else {
        // Single-sided template
        const textElements = this.renderer.getAllTextElements();
        textElements.forEach(el => {
          customizationData.textUpdates[el.id] = el.text;
        });
      }
    }
    
    try {
      // Call server API
      const response = await fetch(`${this.options.apiUrl}/api/public/variant-swatches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: this.options.templateId,
          variants: variants,
          customization: customizationData,
          options: { 
            size: 128, 
            quality: 0.8, 
            side: 'front' // Always use front for swatches
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      
      const result = await response.json();
      
      // Update radio button swatches
      if (result.success && result.swatches) {
        console.log(`[ProductCustomizer] Successfully generated ${result.generatedCount} of ${result.requestedCount} swatches`);
        
        Object.entries(result.swatches).forEach(([variantId, dataUrl]) => {
          const input = document.querySelector(`input[data-variant-id="${variantId}"]`);
          if (input) {
            const swatchSpan = input.nextElementSibling;
            if (swatchSpan && swatchSpan.classList.contains('swatch')) {
              // Store original if not already stored
              if (!swatchSpan.dataset.originalBackground) {
                const currentStyle = swatchSpan.getAttribute('style');
                swatchSpan.dataset.originalBackground = currentStyle || '';
              }
              
              // Update with server-generated swatch
              const newStyle = `--swatch-background: url(${dataUrl});`;
              swatchSpan.style.cssText = newStyle;
              swatchSpan.setAttribute('data-customization-preview', 'true');
              swatchSpan.setAttribute('data-server-generated', 'true');
              swatchSpan.setAttribute('data-custom-timestamp', Date.now().toString());
              
              // Save to global swatch protection storage
              window.SwatchProtection.saveSwatchData(
                variantId,
                newStyle,
                {
                  'data-customization-preview': 'true',
                  'data-server-generated': 'true',
                  'data-custom-timestamp': Date.now().toString()
                }
              );
              
              // Mark parent as having customization
              const swatchParent = swatchSpan.parentElement;
              if (swatchParent) {
                swatchParent.setAttribute('data-has-customization', 'true');
              }
              
              // Also mark the container to help with detection
              const container = swatchSpan.closest('.variant-option--swatches, [data-color-swatches]');
              if (container) {
                container.setAttribute('data-has-custom-swatches', 'true');
              }
            }
          }
        });
        
        if (result.errors && result.errors.length > 0) {
          console.warn('[ProductCustomizer] Some swatches failed:', result.errors);
        }
      } else {
        console.error('[ProductCustomizer] Server swatch generation failed:', result.error);
      }
    } catch (error) {
      console.error('[ProductCustomizer] Error generating server-side swatches:', error);
      // Fall back to client-side generation if needed
    }
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
    // Don't create text inputs here - we need to wait until after dual-sided check
    
    // If we don't have a product image and no saved preview, show the canvas preview
    if (!this.hasProductImage && !this.savedTextUpdates) {
      this.updatePreview();
    }
  }
  
  updatePreview() {
    const previewImage = document.getElementById('preview-image');
    if (!this.renderer || !previewImage) return;
    
    if (this.isDualSided) {
      // For dual-sided templates, handle based on which side was edited
      if (this.lastEditedSide === 'back') {
        console.log('[ProductCustomizer] UPDATE PREVIEW - BACK SIDE EDITED');
        
        // Ensure we're on the back canvas
        if (this.renderer.template !== this.renderer.backCanvasData) {
          this.renderer.template = this.renderer.backCanvasData;
        }
        
        // Generate back preview with high quality for slideshow thumbnails
        const backDataUrl = this.renderer.getDataURL({ pixelRatio: 1 });
        this.backPreviewUrl = backDataUrl;
        
        console.log('[ProductCustomizer] Generated back preview data URL, length:', backDataUrl.length);
        previewImage.src = backDataUrl;
        previewImage.style.display = 'block';
        
        // For back edits, keep the current preview as back
        this.currentPreviewUrl = backDataUrl;
        
        // Also ensure we have a front preview
        if (!this.frontPreviewUrl) {
          this.renderer.template = this.renderer.frontCanvasData;
          this.frontPreviewUrl = this.renderer.getDataURL({ pixelRatio: 1 });
          this.renderer.template = this.renderer.backCanvasData; // Switch back
        }
        
        console.log('[ProductCustomizer] Generated back preview for back edit');
        
        // Update thumbnails for back edits
        this.updateSlideshowThumbnails();
        
        // Update the specific back main image (not the active one)
        this.updateSpecificMainImage(backDataUrl, true);
      } else {
        // Front side was edited
        // Ensure we're on the front canvas
        if (this.renderer.template !== this.renderer.frontCanvasData) {
          this.renderer.template = this.renderer.frontCanvasData;
        }
        
        // Generate front preview with high quality for slideshow thumbnails
        const frontDataUrl = this.renderer.getDataURL({ pixelRatio: 1 });
        this.frontPreviewUrl = frontDataUrl;
        previewImage.src = frontDataUrl;
        previewImage.style.display = 'block';
        
        // Update the current preview URL and main product image
        this.currentPreviewUrl = frontDataUrl;
        this.updateMainProductImage(frontDataUrl);
        
        // Also ensure we have a back preview
        if (this.renderer.backCanvasData && !this.backPreviewUrl) {
          this.renderer.template = this.renderer.backCanvasData;
          this.backPreviewUrl = this.renderer.getDataURL({ pixelRatio: 1 });
          this.renderer.template = this.renderer.frontCanvasData; // Switch back
        }
        
        console.log('[ProductCustomizer] Generated front preview for front edit');
      }
    } else {
      // Single-sided template with high quality for slideshow thumbnails
      const dataUrl = this.renderer.getDataURL({ pixelRatio: 1 });
      previewImage.src = dataUrl;
      previewImage.style.display = 'block';
      
      this.currentPreviewUrl = dataUrl;
      this.updateMainProductImage(dataUrl);
    }
    
    // Use server-side swatch generation instead of client-side
    this.debouncedGenerateServerSwatches();
  }
  
  debouncedGenerateServerSwatches() {
    // Clear existing timer
    if (this.swatchUpdateTimer) {
      clearTimeout(this.swatchUpdateTimer);
    }
    
    // Set new timer for server-side swatch generation
    this.swatchUpdateTimer = setTimeout(() => {
      this.generateServerSideSwatches();
    }, 1000); // 1 second delay to avoid too many server calls
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

  saveTextState() {
    // Collect current text state from all elements
    const textState = {};
    
    if (this.isDualSided) {
      // For dual-sided templates, get text from both sides
      const bothSidesText = this.renderer.getAllTextElementsFromBothSides();
      
      // Save front side text
      bothSidesText.front.forEach(el => {
        textState[`front_${el.id}`] = el.text;
      });
      
      // Save back side text
      bothSidesText.back.forEach(el => {
        textState[`back_${el.id}`] = el.text;
      });
    } else {
      // For single-sided templates
      const textElements = this.renderer.getAllTextElements();
      textElements.forEach(el => {
        textState[el.id] = el.text;
      });
    }
    
    // Save to localStorage with a global key (not variant-specific)
    localStorage.setItem('customization_global_text', JSON.stringify(textState));
    console.log('[ProductCustomizer] Saved global text state:', textState);
    
    // Clear preview cache since customizations have changed
    PreviewCache.clear();
    console.log('[ProductCustomizer] Cleared preview cache due to text changes');
  }
  
  debouncedSaveTextState() {
    // Clear existing timer
    if (this.textSaveTimer) {
      clearTimeout(this.textSaveTimer);
    }
    
    // Set new timer to save after 1 second of no typing
    this.textSaveTimer = setTimeout(() => {
      this.saveTextState();
    }, 1000);
  }
  
  loadGlobalTextState() {
    try {
      const savedState = localStorage.getItem('customization_global_text');
      if (savedState) {
        const textState = JSON.parse(savedState);
        console.log('[ProductCustomizer] Loaded global text state:', textState);
        return textState;
      }
    } catch (error) {
      console.error('[ProductCustomizer] Error loading global text state:', error);
    }
    return null;
  }

  createTextInputs() {
    const textInputsContainer = this.modal.querySelector('.pcm-text-inputs');
    textInputsContainer.innerHTML = '';
    
    console.log('[ProductCustomizer] createTextInputs called, isDualSided:', this.isDualSided);
    
    if (this.isDualSided) {
      // For dual-sided templates, get text from both sides
      const bothSidesText = this.renderer.getAllTextElementsFromBothSides();
      console.log('[ProductCustomizer] Got text from both sides:', bothSidesText);
      
      let html = '';
      
      // Add front side text inputs
      if (bothSidesText.front.length > 0) {
        html += '<div class="pcm-side-section"><h4 style="margin: 0 0 10px 0; font-weight: 600;">Front Side</h4>';
        html += bothSidesText.front.map((element, index) => {
          // Check for saved text with front_ prefix
          let displayText = element.text;
          if (this.savedTextUpdates) {
            displayText = this.savedTextUpdates[`front_${element.id}`] || this.savedTextUpdates[element.id] || element.text;
          }
          
          return `
            <div class="pcm-text-field">
              <label for="text-front-${element.id}">
                ${element.type === 'curved' ? 'Curved Text' : 
                  element.type === 'gradient' ? 'Gradient Text' : 
                  `Text ${index + 1}`}
              </label>
              <input 
                type="text" 
                id="text-front-${element.id}" 
                data-element-id="${element.id}"
                data-side="front"
                value="${displayText}"
                placeholder="Enter your text here"
              />
            </div>
          `;
        }).join('');
        html += '</div>';
      }
      
      // Add back side text inputs
      if (bothSidesText.back.length > 0) {
        html += '<div class="pcm-side-section" style="margin-top: 20px;"><h4 style="margin: 0 0 10px 0; font-weight: 600;">Back Side</h4>';
        html += bothSidesText.back.map((element, index) => {
          // Check for saved text with back_ prefix
          let displayText = element.text;
          if (this.savedTextUpdates) {
            displayText = this.savedTextUpdates[`back_${element.id}`] || element.text;
          }
          
          return `
            <div class="pcm-text-field">
              <label for="text-back-${element.id}">
                ${element.type === 'curved' ? 'Curved Text' : 
                  element.type === 'gradient' ? 'Gradient Text' : 
                  `Text ${index + 1}`}
              </label>
              <input 
                type="text" 
                id="text-back-${element.id}" 
                data-element-id="${element.id}"
                data-side="back"
                value="${displayText}"
                placeholder="Enter your text here"
              />
            </div>
          `;
        }).join('');
        html += '</div>';
      }
      
      textInputsContainer.innerHTML = html;
    } else {
      // For single-sided templates, use the existing logic
      const textElements = this.renderer.getAllTextElements();
      
      textInputsContainer.innerHTML = textElements.map((element, index) => {
        let displayText = element.text;
        if (this.savedTextUpdates) {
          displayText = this.savedTextUpdates[element.id] || element.text;
        }
          
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
    }
    
    // Attach input listeners
    textInputsContainer.querySelectorAll('input').forEach(input => {
      input.addEventListener('input', (e) => {
        const elementId = e.target.dataset.elementId;
        const side = e.target.dataset.side;
        
        if (this.isDualSided && side) {
          // For dual-sided templates, we need to switch to the correct side before updating
          this.lastEditedSide = side; // Track which side was edited
          
          if (side === 'back') {
            // Log back side text change
            const label = e.target.previousElementSibling?.textContent || 'Unknown';
            console.log('[ProductCustomizer] BACK SIDE TEXT CHANGED:', {
              label: label,
              elementId: elementId,
              newValue: e.target.value,
              inputId: e.target.id
            });
            
            // Switch to back canvas temporarily
            this.renderer.template = this.renderer.backCanvasData;
            this.renderer.updateText(elementId, e.target.value);
            // Keep on back canvas - updatePreview will handle switching
          } else {
            // Update front side
            if (this.renderer.template !== this.renderer.frontCanvasData) {
              this.renderer.template = this.renderer.frontCanvasData;
            }
            this.renderer.updateText(elementId, e.target.value);
          }
        } else {
          // Single-sided template
          this.lastEditedSide = 'front';
          this.renderer.updateText(elementId, e.target.value);
        }
        
        this.debouncedUpdatePreview();
        
        // Save text state globally with debouncing
        this.debouncedSaveTextState();
      });
    });
  }

  // Remove positionModal method as we're using CSS positioning within product-details
  
  close(keepCustomization = false) {
    this.modal.classList.remove('open');
    this.isOpen = false;
    document.body.style.overflow = '';
    
    // Keep the instance reference but mark as closed
    // This allows variant change detection to still work after modal is closed
    
    // Only restore original product images if we're not keeping a customization
    if (!keepCustomization) {
      this.restoreOriginalProductImages();
      // Clear saved text updates if not keeping customization
      this.savedTextUpdates = null;
      
      // Clear custom swatches if not keeping customization
      if (this.clearCustomSwatches) {
        this.clearCustomSwatches();
      }
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
    if (this.swatchUpdateTimer) {
      clearTimeout(this.swatchUpdateTimer);
      this.swatchUpdateTimer = null;
    }
    
    // Clean up renderer
    if (this.renderer) {
      this.renderer.destroy();
      this.renderer = null;
    }
    
    // Reset dual-sided state
    this.isDualSided = false;
    this.frontRenderer = null;
    this.frontPreviewUrl = null;
    this.backPreviewUrl = null;
  }

  async openAdvancedEditor() {
    try {
      // Get canvas state - handle dual-sided templates
      const stateData = this.renderer.getDualSidedCanvasState();
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
      
      // Add canvas data based on template type
      if (stateData.isDualSided) {
        formData.append('frontCanvasData', stateData.frontCanvasData);
        formData.append('backCanvasData', stateData.backCanvasData);
        formData.append('isDualSided', 'true');
      } else {
        formData.append('canvasState', JSON.stringify(stateData.canvasData));
      }
      
      formData.append('thumbnail', thumbnail);
      
      const response = await fetch(`${this.options.apiUrl}/api/designs/draft`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Failed to create draft');
      }
      
      const { design } = await response.json();
      const designId = design.id;
      
      // Store reference in localStorage
      localStorage.setItem('currentDesign', JSON.stringify({
        id: design.id,
        templateId: this.options.templateId,
        variantId: this.options.variantId,
        productId: productId,
        lastModified: Date.now(),
        status: 'draft'
      }));
      
      // Store return location
      localStorage.setItem('returnTo', JSON.stringify({
        type: 'product',
        url: window.location.href,
        context: {}
      }));
      
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
    const customization = {
      templateId: this.options.templateId,
      variantId: this.options.variantId,
      textUpdates: {},
      isDualSided: this.isDualSided
    };
    
    // Get text updates from current renderer
    if (this.isDualSided) {
      // For dual-sided templates, get text from both sides
      const bothSidesText = this.renderer.getAllTextElementsFromBothSides();
      
      // Save front side text
      bothSidesText.front.forEach(el => {
        customization.textUpdates[`front_${el.id}`] = el.text;
      });
      
      // Save back side text
      bothSidesText.back.forEach(el => {
        customization.textUpdates[`back_${el.id}`] = el.text;
      });
    } else {
      // For single-sided templates
      const textElements = this.renderer.getAllTextElements();
      textElements.forEach(el => {
        customization.textUpdates[el.id] = el.text;
      });
    }
    
    // Generate high quality previews for slideshow thumbnails
    console.log('[ProductCustomizer] Generating save() preview with PNG format');
    customization.preview = this.renderer.getDesignAreaPreview(1);
    customization.fullPreview = this.renderer.getDataURL({ pixelRatio: 1 });
    console.log('[ProductCustomizer] Save preview generated:', {
      mimeType: 'PNG (default)',
      dataUrlLength: customization.fullPreview?.length,
      dataUrlPrefix: customization.fullPreview?.substring(0, 50)
    });
    
    if (this.isDualSided) {
      // Store which canvas is currently active
      const currentTemplate = this.renderer.template;
      
      // Generate front preview (always switch to front first)
      if (this.renderer.frontCanvasData) {
        this.renderer.template = this.renderer.frontCanvasData;
        this.renderer.render();
        
        console.log('[ProductCustomizer] Generating front preview with PNG format');
        const frontDataUrl = this.renderer.getDataURL({ pixelRatio: 1 });
        console.log('[ProductCustomizer] Front preview:', {
          mimeType: 'PNG (default)',
          dataUrlLength: frontDataUrl?.length,
          dataUrlPrefix: frontDataUrl?.substring(0, 50)
        });
        this.frontPreviewUrl = frontDataUrl;
        customization.frontPreview = frontDataUrl;
        
        // Update fullPreview to be the front preview
        customization.fullPreview = frontDataUrl;
      }
      
      // Generate back preview
      if (this.renderer.backCanvasData) {
        this.renderer.template = this.renderer.backCanvasData;
        this.renderer.render();
        
        console.log('[ProductCustomizer] Generating back preview with PNG format');
        const backDataUrl = this.renderer.getDataURL({ pixelRatio: 1 });
        console.log('[ProductCustomizer] Back preview:', {
          mimeType: 'PNG (default)',
          dataUrlLength: backDataUrl?.length,
          dataUrlPrefix: backDataUrl?.substring(0, 50)
        });
        this.backPreviewUrl = backDataUrl;
        customization.backPreview = backDataUrl;
      }
      
      // Restore the original template view
      this.renderer.template = currentTemplate;
      this.renderer.render();
    }
    
    // Update the current preview URL
    this.currentPreviewUrl = customization.fullPreview;
    
    // Save to cart or handle as needed
    this.customizationData = customization;
    this.options.onSave(customization);
    
    // Update main product image
    this.updateMainProductImage();
    
    this.close(true); // Keep customization visible after save
  }
  
  debugSlideshowComponent() {
    console.log('[ProductCustomizer] === SLIDESHOW DEBUG INFO ===');
    
    // Look for slideshow component
    const slideshow = document.querySelector('slideshow-component, media-gallery');
    if (slideshow) {
      console.log('[ProductCustomizer] Slideshow element found:', slideshow);
      console.log('[ProductCustomizer] Tag name:', slideshow.tagName);
      
      try {
        // Get all methods and properties safely
        const proto = Object.getPrototypeOf(slideshow);
        const methods = [];
        for (let prop in proto) {
          try {
            if (typeof proto[prop] === 'function' && prop !== 'constructor') {
              methods.push(prop);
            }
          } catch (e) {
            // Skip properties that throw errors
          }
        }
        console.log('[ProductCustomizer] Available methods:', methods);
        
        // Check for specific update-related methods
        const updateMethods = methods.filter(name => 
          name.includes('update') || name.includes('refresh') || name.includes('render') || 
          name.includes('load') || name.includes('sync') || name.includes('redraw')
        );
        console.log('[ProductCustomizer] Update-related methods:', updateMethods);
        
        // Check direct properties
        const directProps = Object.getOwnPropertyNames(slideshow);
        console.log('[ProductCustomizer] Direct properties:', directProps);
        
        // Check for slideshow reference
        if (slideshow.slideshow) {
          console.log('[ProductCustomizer] Has slideshow property:', slideshow.slideshow);
          const slideshowMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(slideshow.slideshow))
            .filter(name => typeof slideshow.slideshow[name] === 'function');
          console.log('[ProductCustomizer] Slideshow sub-component methods:', slideshowMethods);
        }
      } catch (e) {
        console.error('[ProductCustomizer] Error examining component:', e);
      }
    } else {
      console.log('[ProductCustomizer] No slideshow component found');
    }
    
    // Look for slideshow controls
    const controls = document.querySelector('slideshow-controls');
    if (controls) {
      console.log('[ProductCustomizer] Slideshow controls found:', controls);
      try {
        const proto = Object.getPrototypeOf(controls);
        const methods = [];
        for (let prop in proto) {
          try {
            if (typeof proto[prop] === 'function' && prop !== 'constructor') {
              methods.push(prop);
            }
          } catch (e) {
            // Skip properties that throw errors
          }
        }
        console.log('[ProductCustomizer] Control methods:', methods);
      } catch (e) {
        console.error('[ProductCustomizer] Error examining controls:', e);
      }
    }
    
    // Debug specific thumbnail that was updated
    const backThumbnails = document.querySelectorAll('slideshow-controls img[alt*="- Back"]');
    console.log('[ProductCustomizer] Found back thumbnails in controls:', backThumbnails.length);
    backThumbnails.forEach((thumb, idx) => {
      if (thumb.src.startsWith('data:')) {
        console.log(`[ProductCustomizer] Control thumbnail ${idx} has base64 src, visible:`, 
          thumb.offsetWidth > 0 && thumb.offsetHeight > 0,
          'dimensions:', thumb.offsetWidth, 'x', thumb.offsetHeight,
          'alt:', thumb.alt);
      }
    });
    
    // Also check main slideshow images
    const mainBackImages = document.querySelectorAll('slideshow-slide img[alt*="- Back"]');
    console.log('[ProductCustomizer] Found back images in main slideshow:', mainBackImages.length);
    
    console.log('[ProductCustomizer] === END DEBUG INFO ===');
  }
  
  setupMessageListener() {
    // Listen for messages from the advanced editor
    window.addEventListener('message', (event) => {
      // Validate message origin if needed
      if (event.data && event.data.type === 'design-saved') {
        console.log('Design saved message received:', event.data);
        
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
        
        
        // Don't automatically add to cart - just close the modal
        // The user can click "Add to Cart" on the product page when ready
        this.close(true); // Pass true to keep the customization preview
      }
    });
  }
  
  interceptVariantChanges() {
    console.log('[ProductCustomizer] Setting up variant change interception');
    
    // Use the global SwatchProtection system
    this.clearCustomSwatches = window.SwatchProtection.clearCustomSwatches;
    
    // The global system already handles variant changes for both standard and Horizon themes
    // We just need to ensure swatches are saved when they're generated
    console.log('[ProductCustomizer] Using global swatch protection system');
  }
  
  
  async handleVariantChange(newVariantId, newTemplateId) {
    // Update the options
    this.options.variantId = newVariantId;
    this.options.templateId = newTemplateId;
    
    // If modal is not open, just update options and return
    if (!this.isOpen || !this.renderer) {
      return;
    }
    
    // Load the new template
    await this.renderer.loadTemplate(newTemplateId);
    
    // Check if this is a dual-sided template
    if (this.renderer.isDualSided) {
      this.isDualSided = true;
      console.log('[ProductCustomizer] Dual-sided template detected for new variant');
      
      // Ensure we're on the front canvas
      if (this.renderer.template !== this.renderer.frontCanvasData) {
        this.renderer.template = this.renderer.frontCanvasData;
      }
    } else {
      this.isDualSided = false;
    }
    
    // Recreate text inputs for the new template
    this.createTextInputs();
    
    // Update preview
    this.updatePreview();
  }
  
  async updateProductImageForVariant(variantId) {
    console.log('[ProductCustomizer] Updating product image for variant:', variantId);
    
    // Prevent multiple simultaneous updates
    if (ProductCustomizerModal.isUpdatingProductImage) {
      console.log('[ProductCustomizer] Already updating product image, skipping');
      return;
    }
    
    // Immediately blur the current image
    const mainImage = this.findMainProductImage();
    if (mainImage) {
      mainImage.classList.add('product-image-transitioning');
    }
    
    // Check cache first
    const cachedPreview = PreviewCache.get(variantId);
    if (cachedPreview) {
      console.log('[ProductCustomizer] Using cached preview for variant:', variantId);
      this.transitionToNewImage(mainImage, cachedPreview);
      return;
    }
    
    ProductCustomizerModal.isUpdatingProductImage = true;
    
    // Get the template for this variant
    const templateId = this.getTemplateIdForVariant(variantId);
    if (!templateId) {
      console.log('[ProductCustomizer] No template found for variant:', variantId);
      ProductCustomizerModal.isUpdatingProductImage = false;
      return;
    }
    
    // Create a smaller temporary container for faster rendering
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.width = '300px';  // Smaller size for faster generation
    tempContainer.style.height = '300px';
    document.body.appendChild(tempContainer);
    
    // Create a temporary renderer to generate preview
    const tempRenderer = new CanvasTextRenderer();
    tempRenderer.container = tempContainer;
    
    try {
      await tempRenderer.loadTemplate(templateId);
      
      // Apply saved text customizations
      const savedTextState = this.loadGlobalTextState();
      if (savedTextState && tempRenderer.isDualSided) {
        // For dual-sided templates, we need to apply text to both front and back canvas data
        if (tempRenderer.frontCanvasData) {
          Object.entries(savedTextState).forEach(([key, value]) => {
            if (key.startsWith('front_')) {
              const elementId = key.replace('front_', '');
              // Find and update the text element in frontCanvasData
              const frontElements = tempRenderer.frontCanvasData.elements;
              ['textElements', 'curvedTextElements', 'gradientTextElements'].forEach(elementType => {
                if (frontElements[elementType]) {
                  const element = frontElements[elementType].find(el => el.id === elementId);
                  if (element) {
                    element.text = value;
                  }
                }
              });
            }
          });
        }
        
        if (tempRenderer.backCanvasData) {
          Object.entries(savedTextState).forEach(([key, value]) => {
            if (key.startsWith('back_')) {
              const elementId = key.replace('back_', '');
              // Find and update the text element in backCanvasData
              const backElements = tempRenderer.backCanvasData.elements;
              ['textElements', 'curvedTextElements', 'gradientTextElements'].forEach(elementType => {
                if (backElements[elementType]) {
                  const element = backElements[elementType].find(el => el.id === elementId);
                  if (element) {
                    element.text = value;
                  }
                }
              });
            }
          });
        }
        
        // Start with front canvas
        tempRenderer.template = tempRenderer.frontCanvasData;
      } else if (savedTextState) {
        // Single-sided template - apply text normally
        Object.entries(savedTextState).forEach(([elementId, text]) => {
          tempRenderer.updateText(elementId, text);
        });
      }
      
      // Render the canvas with updates
      tempRenderer.render();
      
      // Generate preview using stage.toDataURL
      const preview = await new Promise((resolve) => {
        // Wait a frame for render to complete
        requestAnimationFrame(() => {
          if (tempRenderer.stage) {
            console.log('[ProductCustomizer] Generating PNG preview for variant change');
            const dataUrl = tempRenderer.stage.toDataURL({
              pixelRatio: 1  // Lower pixel ratio for faster generation
            });
            console.log('[ProductCustomizer] Generated preview:', {
              mimeType: 'PNG (default)',
              pixelRatio: 1,
              dataUrlLength: dataUrl?.length,
              dataUrlPrefix: dataUrl?.substring(0, 50)
            });
            resolve(dataUrl);
          } else {
            resolve(null);
          }
        });
      });
      
      // Update main product image and cache
      if (preview) {
        PreviewCache.set(variantId, preview);
        this.transitionToNewImage(mainImage, preview);
        
        // Check if template is dual-sided and generate both front/back previews
        if (tempRenderer.isDualSided) {
          console.log('[ProductCustomizer] Dual-sided template detected, generating front and back previews');
          
          // Store front preview
          this.frontPreviewUrl = preview;
          
          // Generate back preview
          tempRenderer.template = tempRenderer.backCanvasData;
          tempRenderer.render();
          
          const backPreview = await new Promise((resolve) => {
            requestAnimationFrame(() => {
              if (tempRenderer.stage) {
                const dataUrl = tempRenderer.stage.toDataURL({ pixelRatio: 1 });
                resolve(dataUrl);
              } else {
                resolve(null);
              }
            });
          });
          
          if (backPreview) {
            this.backPreviewUrl = backPreview;
            console.log('[ProductCustomizer] Generated back preview for variant');
          }
          
          this.isDualSided = true;
        } else {
          // Single-sided template
          this.currentPreviewUrl = preview;
          this.isDualSided = false;
        }
        
        // Update slideshow thumbnails for this variant
        console.log('[ProductCustomizer] Updating slideshow thumbnails after variant change');
        this.updateSlideshowThumbnails();
      }
    } catch (error) {
      console.error('[ProductCustomizer] Error updating product image for variant:', error);
      // Remove blur on error
      if (mainImage) {
        mainImage.classList.remove('product-image-transitioning');
      }
    } finally {
      // Cleanup
      ProductCustomizerModal.isUpdatingProductImage = false;
      if (tempRenderer.stage) {
        tempRenderer.stage.destroy();
      }
      if (tempContainer && tempContainer.parentNode) {
        tempContainer.parentNode.removeChild(tempContainer);
      }
    }
  }
  
  getTemplateIdForVariant(variantId) {
    // Try multiple methods to find template ID
    
    // Method 1: Check current window.productData
    if (window.productData?.variants) {
      const variant = window.productData.variants.find(v => v.id == variantId);
      if (variant?.metafields?.custom_designer?.template_id) {
        return variant.metafields.custom_designer.template_id;
      }
    }
    
    // Method 2: Query DOM for variant input with template data
    const variantInputs = document.querySelectorAll(`input[data-variant-id="${variantId}"]`);
    for (const input of variantInputs) {
      // Check if there's a template ID stored in a parent element
      const templateContainer = input.closest('[data-template-id]');
      if (templateContainer?.dataset.templateId) {
        return templateContainer.dataset.templateId;
      }
    }
    
    // Method 3: Check the customize button's data attributes
    const customizeBtn = document.getElementById('customize-product-btn');
    if (customizeBtn && customizeBtn.dataset.variantId == variantId) {
      return customizeBtn.dataset.templateId;
    }
    
    // Method 4: Try to find from variant radio inputs
    const colorInputs = document.querySelectorAll('input[type="radio"][name*="Color"], input[type="radio"][name*="color"]');
    for (const input of colorInputs) {
      if (input.dataset.variantId == variantId) {
        // Check for template ID in various places
        const form = input.closest('form');
        if (form) {
          const hiddenInput = form.querySelector(`input[type="hidden"][name="id"][value="${variantId}"]`);
          if (hiddenInput && hiddenInput.dataset.templateId) {
            return hiddenInput.dataset.templateId;
          }
        }
      }
    }
    
    console.log('[ProductCustomizer] Could not find template ID for variant:', variantId);
    return null;
  }
  
  updateMainProductImageDirectly(previewUrl) {
    console.log('[ProductCustomizer] Directly updating main product image');
    
    // Find the main product image without relying on stored references
    const mainProductImage = this.findMainProductImage();
    if (!mainProductImage) {
      console.warn('[ProductCustomizer] Could not find main product image');
      return;
    }
    
    // Store original if not already stored
    if (!mainProductImage.dataset.originalSrc) {
      mainProductImage.dataset.originalSrc = mainProductImage.src;
      mainProductImage.dataset.originalSrcset = mainProductImage.srcset || '';
    }
    
    // Update the image
    mainProductImage.src = previewUrl;
    mainProductImage.srcset = ''; // Clear srcset to prevent browser from using original
    mainProductImage.setAttribute('data-customization-preview', 'true');
    
    // Remove any blur transition class if present
    mainProductImage.classList.remove('product-image-transitioning');
    
    console.log('[ProductCustomizer] Main product image updated');
  }
  
  transitionToNewImage(imageElement, newSrc) {
    if (!imageElement) {
      console.warn('[ProductCustomizer] No image element provided for transition');
      return;
    }
    
    // Store original if not already stored
    if (!imageElement.dataset.originalSrc) {
      imageElement.dataset.originalSrc = imageElement.src;
      imageElement.dataset.originalSrcset = imageElement.srcset || '';
    }
    
    // Preload the new image
    const tempImg = new Image();
    tempImg.onload = () => {
      imageElement.src = newSrc;
      imageElement.srcset = ''; // Clear srcset to prevent browser from using original
      imageElement.setAttribute('data-customization-preview', 'true');
      
      // Remove blur after image loads
      setTimeout(() => {
        imageElement.classList.remove('product-image-transitioning');
      }, 50);
    };
    tempImg.onerror = () => {
      console.error('[ProductCustomizer] Failed to load preview image');
      // Remove blur on error
      imageElement.classList.remove('product-image-transitioning');
    };
    tempImg.src = newSrc;
  }
  
  findMainProductImage() {
    // Horizon 2025 themes (Tinker, etc.)
    // These themes use custom elements like <media-gallery> and <slideshow-component>
    const horizonImage = document.querySelector(
      'media-gallery img:first-of-type, ' +
      'media-gallery slideshow-component img:first-of-type, ' +
      'slideshow-component img.selected, ' +
      'slideshow-component img[aria-selected="true"]'
    );
    if (horizonImage) return horizonImage;
    
    // Dawn-based themes (Dawn, Craft, Sense, etc.)
    // These themes typically use data attributes and BEM-style classes
    const dawnImage = document.querySelector(
      '.product__media img[data-media-type="image"]:not(.zoom-image), ' +
      '.product__main-photos img.main-product-image, ' +
      '.product__image img.product__img, ' +
      'slideshow-wrapper img.slideshow__slide-image--active'
    );
    if (dawnImage) return dawnImage;
    
    // Legacy/generic themes
    // Older themes and custom implementations
    const legacyImage = document.querySelector(
      '.media-gallery img:first-of-type, ' +  // Class-based media gallery
      '.product-media img:first-of-type, ' +
      '.product__media--featured img, ' +
      '[data-product-featured-image], ' +
      '.product-gallery img:first-of-type'
    );
    if (legacyImage) return legacyImage;
    
    // Final fallback - any large product image
    return this.findAnyLargeProductImage();
  }
  
  findAnyLargeProductImage() {
    // Look for any product image that's not a thumbnail
    const productImages = document.querySelectorAll('.product img[src*="/products/"], .product-single img[src*="/products/"]');
    
    for (const img of productImages) {
      // Skip thumbnails and zoom images
      if (img.classList.contains('product__thumb') || 
          img.classList.contains('thumbnail') || 
          img.classList.contains('zoom-image') ||
          img.width < 200) {
        continue;
      }
      
      // Skip recommendation images
      if (img.closest('.product-recommendations, .related-products, [data-section-type="related-products"]')) {
        continue;
      }
      
      return img;
    }
    
    return null;
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
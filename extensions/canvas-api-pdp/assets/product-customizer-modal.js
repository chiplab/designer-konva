/**
 * Product Customizer Modal
 * Provides a slide-out modal interface for simple text customization
 */

class ProductCustomizerModal {
  constructor(options = {}) {
    this.options = {
      variantId: options.variantId,
      templateId: options.templateId,
      apiUrl: options.apiUrl || '/apps/designer',
      onSave: options.onSave || (() => {}),
      ...options
    };
    
    this.modal = null;
    this.renderer = null;
    this.isOpen = false;
    this.customizationData = null;
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
          <div class="pcm-header">
            <h2>Customize Your Product</h2>
            <button class="pcm-close" aria-label="Close customizer">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2"/>
              </svg>
            </button>
          </div>
          
          <div class="pcm-content">
            <div class="pcm-preview">
              <div id="customizer-canvas"></div>
              <div class="pcm-loading">Loading preview...</div>
            </div>
            
            <div class="pcm-controls">
              <div class="pcm-text-inputs">
                <!-- Text inputs will be dynamically inserted here -->
              </div>
              
              <div class="pcm-actions">
                <button class="pcm-btn pcm-btn-secondary" id="customizeMore">
                  Customize More
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M6 12l4-4-4-4" stroke="currentColor" stroke-width="2"/>
                  </svg>
                </button>
                <button class="pcm-btn pcm-btn-primary" id="saveCustomization">
                  Save Customization
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
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 999999;
        }

        .product-customizer-modal.open {
          display: block;
        }

        .pcm-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          animation: fadeIn 0.3s ease-out;
        }

        .pcm-panel {
          position: absolute;
          right: 0;
          top: 0;
          width: 90%;
          max-width: 600px;
          height: 100%;
          background: white;
          box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
          transform: translateX(100%);
          transition: transform 0.3s ease-out;
          overflow-y: auto;
        }

        .product-customizer-modal.open .pcm-panel {
          transform: translateX(0);
        }

        .pcm-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid #e5e5e5;
        }

        .pcm-header h2 {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
        }

        .pcm-close {
          background: none;
          border: none;
          cursor: pointer;
          padding: 8px;
          color: #666;
          transition: color 0.2s;
        }

        .pcm-close:hover {
          color: #000;
        }

        .pcm-content {
          padding: 20px;
        }

        .pcm-preview {
          position: relative;
          background: #f5f5f5;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
          text-align: center;
        }

        #customizer-canvas {
          max-width: 100%;
          height: auto;
          display: block;
          margin: 0 auto;
          background: white;
          border-radius: 4px;
        }
        
        #customizer-canvas canvas {
          max-width: 100% !important;
          height: auto !important;
          display: block;
        }

        .pcm-loading {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: #666;
          display: none;
        }

        .pcm-preview.loading .pcm-loading {
          display: block;
        }

        .pcm-preview.loading #customizer-canvas {
          opacity: 0.3;
        }

        .pcm-text-inputs {
          margin-bottom: 20px;
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

        @media (max-width: 768px) {
          .pcm-panel {
            width: 100%;
            max-width: none;
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
  }

  async open() {
    this.modal.classList.add('open');
    this.isOpen = true;
    document.body.style.overflow = 'hidden';
    
    // Show loading state
    this.modal.querySelector('.pcm-preview').classList.add('loading');
    
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
    // Hide loading state
    this.modal.querySelector('.pcm-preview').classList.remove('loading');
    
    // Create text input fields
    this.createTextInputs();
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
      });
    });
  }

  close() {
    this.modal.classList.remove('open');
    this.isOpen = false;
    document.body.style.overflow = '';
    
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
      preview: this.renderer.getDataURL()
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
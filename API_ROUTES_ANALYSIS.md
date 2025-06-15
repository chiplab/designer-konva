# API Routes Analysis

## Overview
This document provides a comprehensive analysis of all API routes in the codebase and their usage patterns.

## Active API Routes

### 1. `/api/assets/upload` 
**File**: `app/routes/api.assets.upload.tsx`
**Used by**:
- `app/components/DesignerCanvas.tsx` - For uploading base images and user images
- `app/routes/hydrate.tsx` - For standalone canvas image uploads
**Purpose**: Handles file uploads to AWS S3 for images, SVGs, and fonts

### 2. `/api/templates/save`
**File**: `app/routes/api.templates.save.tsx`
**Used by**:
- `app/components/DesignerCanvas.tsx` - Save button in designer
- `app/routes/app.designer.tsx` - Save from embedded designer
- `app/routes/hydrate.tsx` - Save from standalone canvas
**Purpose**: Creates or updates templates with automatic thumbnail sync to Shopify variants

### 3. `/api/templates/:id`
**File**: `app/routes/api.templates.$id.tsx`
**Used by**:
- `app/components/DesignerCanvas.tsx` - Loading specific templates
- `app/routes/hydrate.tsx` - Loading templates in standalone mode
**Purpose**: Retrieves a specific template by ID

### 4. `/api/templates`
**File**: `app/routes/api.templates.tsx`
**Used by**:
- `app/components/DesignerCanvas.tsx` - Template selector dropdown
- `app/routes/hydrate.tsx` - Template list in standalone mode
**Purpose**: Lists all templates for a shop

### 5. `/api/templates/generate-variants`
**File**: `app/routes/api.templates.generate-variants.tsx`
**Used by**:
- `app/routes/app.templates.tsx` - "Generate color variants" button
**Purpose**: Creates color variants of a master template using job queue

### 6. `/api/jobs/:jobId`
**File**: `app/routes/api.jobs.$jobId.tsx`
**Used by**:
- `app/routes/app.templates.tsx` - Polling job status for variant generation
**Purpose**: Returns status of background jobs

### 7. `/api/test-template-render`
**File**: `app/routes/api.test-template-render.tsx`
**Used by**:
- `app/routes/app.templates.tsx` - Re-sync preview images action
**Purpose**: Server-side template rendering for thumbnail generation

### 8. `/app/api/products`
**File**: `app/routes/app.api.products.tsx`
**Used by**:
- `app/routes/app.templates.tsx` - Product selector for template assignment
- `app/routes/app.designer.tsx` - Product list for template creation
**Purpose**: Returns Shopify products with variants for template binding

### 9. `/api/customizer/*`
**File**: `app/routes/api.customizer.$.tsx`
**Used by**: None directly (was intended for app proxy but not actively used)
**Purpose**: Resource route that returns raw HTML for full customizer (deprecated)

## Potentially Unused Routes

### 1. `/api/assets`
**File**: `app/routes/api.assets.tsx`
**Purpose**: List assets - not referenced in codebase

### 2. `/api/assets/*`
**File**: `app/routes/api.assets.$.tsx`
**Purpose**: Serve individual assets - not referenced in codebase

### 3. `/api/canvas/render`
**File**: `app/routes/api.canvas.render.tsx`
**Purpose**: Canvas rendering endpoint - not referenced in codebase

### 4. `/api/products`
**File**: `app/routes/api.products.tsx`
**Purpose**: Product listing - superseded by `/app/api/products`

### 5. `/api/template-products`
**File**: `app/routes/api.template-products.tsx`
**Purpose**: Template-product associations - not referenced in codebase

### 6. `/app/api/template/:templateId`
**File**: `app/routes/app.api.template.$templateId.tsx`
**Purpose**: Individual template endpoint - not referenced in codebase

## App Proxy and Extension Integration

The theme extension (`extensions/canvas-api-pdp/`) uses:
- `/apps/designer/template/:templateId` - Referenced in `canvas-text-renderer.js`
  - This appears to be an app proxy URL that should route through Shopify
  - However, no matching route exists in the current codebase
  - The extension may be expecting a different routing setup

## Recommendations

1. **Remove Unused Routes**: Consider removing the following unused API routes:
   - `api.assets.tsx`
   - `api.assets.$.tsx`
   - `api.canvas.render.tsx`
   - `api.products.tsx`
   - `api.template-products.tsx`
   - `app.api.template.$templateId.tsx`
   - `api.customizer.$.tsx` (if app proxy is not being used)

2. **Fix Extension Integration**: The canvas-text-renderer.js expects `/apps/designer/template/:templateId` which doesn't exist. Either:
   - Add the missing route
   - Update the extension to use existing `/api/templates/:id` endpoint
   - Implement proper app proxy routing

3. **Consolidate Product Endpoints**: Consider consolidating `/api/products` and `/app/api/products` into a single endpoint

4. **Document API Structure**: Add API documentation for active endpoints including request/response formats
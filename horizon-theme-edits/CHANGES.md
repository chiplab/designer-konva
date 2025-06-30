# Horizon Theme Media Gallery Changes

## Overview
This file documents the changes made to theme files to filter media gallery images to show only the currently selected variant's images.

## Files Modified

### 1. `_product-media.gallery.liquid`
- Original: `horizon-theme-examples/blocks/_product-media.gallery.liquid`
- Modified: `horizon-theme-edits/blocks/_product-media.gallery.liquid`

### 2. `slideshow-controls.liquid` (NEW)
- Original: `horizon-theme-examples/snippets/slideshow-controls.liquid`
- Modified: `horizon-theme-edits/snippets/slideshow-controls.liquid`

## Changes Made

### 1. Added Current Variant Title Assignment (Lines 102-104)
```liquid
# Get current variant title for filtering
assign current_variant = selected_product.selected_or_first_available_variant
assign current_variant_title = current_variant.title
```

### 2. Filtered Slideshow Slides (Lines 143-152)
Added filtering logic to only show media that matches the current variant:
```liquid
{%- liquid
  # Check if this media belongs to current variant
  assign show_media = true
  if current_variant_title and media.alt
    unless media.alt contains current_variant_title
      assign show_media = false
    endunless
  endif
-%}

{% if show_media %}
  <!-- render slide -->
{% endif %}
```

### 3. Filtered Grid View (Lines 230-239)
Applied the same filtering logic to the grid view presentation.

### 4. Filtered Zoom Dialog Thumbnails (Lines 297-306)
Applied filtering to the zoom dialog thumbnail buttons.

### 5. Filtered Zoom Gallery List (Lines 345-354)
Applied filtering to the zoomed gallery media list.

### 6. Updated slideshow-controls Render Calls
Added `current_variant_title` parameter when rendering slideshow-controls snippet (Lines 213 and 224).

## Changes to slideshow-controls.liquid

### 1. Added current_variant_title Parameter
Added documentation for the new parameter that receives the current variant title for filtering.

### 2. Thumbnail Filtering Logic (Lines 106-118)
Added filtering logic in the thumbnails loop to:
- Check if current_variant_title is provided
- Compare media alt text with variant title (case-insensitive)
- Only render thumbnails that match the current variant

## How It Works
- The filtering uses case-insensitive matching (converts both alt text and variant title to lowercase)
- Checks if the media's alt text contains the current variant title
- Identifies back images by checking if alt text ends with "- back"
- Shows both front and back images for the current variant only
- Filters the main slideshow slides on initial page load
- Relies on JavaScript's `filterSlideshowToActiveVariant()` method for thumbnail filtering
- This approach ensures compatibility with dynamic slideshow components

## To Apply These Changes
1. Go to Shopify Admin > Online Store > Themes > Edit code
2. Find and update these files:
   - `blocks/_product-media.gallery.liquid` - Replace with contents from `horizon-theme-edits/blocks/_product-media.gallery.liquid`
   - `snippets/slideshow-controls.liquid` - Replace with contents from `horizon-theme-edits/snippets/slideshow-controls.liquid`
3. Save all changes

## Benefits
- Shows only relevant images on initial page load
- No flash of all 49 images before JavaScript filtering
- Works seamlessly with the JavaScript filtering for dynamic variant changes
- Clean, server-side solution that reduces visual clutter
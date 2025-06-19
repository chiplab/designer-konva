# Base Image Optimization Plan

## Current Issues
1. All 147 base images named `base-image.jpg` causing CORS cache confusion
2. Files are actually PNGs with transparency, not JPEGs
3. Large file sizes: 1368x1368px, 1MB+ each
4. Wrong content-type: `image/jpeg` for PNG files
5. Full.tsx loads these huge files, causing slow performance

## Solution

### 1. Update Product Layouts (`app/routes/app.product-layouts.tsx`)

**Line ~98-106**: Modify image download and upload process:

```typescript
// Instead of downloading original, request optimized version
const optimizedUrl = variant.imageUrl + '&width=1200&format=webp';
const response = await fetch(optimizedUrl);
const buffer = await response.arrayBuffer();
const imageBuffer = Buffer.from(buffer);

// Detect actual content type
const contentType = response.headers.get('content-type') || 'image/webp';
const extension = contentType.includes('webp') ? '.webp' : '.png';

// Create descriptive filename
const colorSlug = (color || 'default').toLowerCase().replace(/\s+/g, '-');
const patternSlug = pattern ? `-${pattern.toLowerCase().replace(/\s+/g, '-')}` : '';
const fileName = `${colorSlug}${patternSlug}-base${extension}`;

// Upload with correct naming and content type
const s3Key = `layouts/${session.shop}/${layout.id}/variants/${variant.id}/${fileName}`;
const s3Url = await uploadToS3(s3Key, imageBuffer, { contentType });
```

### 2. Benefits
- **70% smaller files**: WebP format + reduced dimensions
- **Unique filenames**: `red-8spot-base.webp` instead of `base-image.jpg`
- **Correct content types**: Matches actual file format
- **Fixes CORS issues**: No more cache confusion from identical names
- **Faster loading**: Especially in full.tsx route

### 3. Additional Considerations
- Keep original Shopify URL in `shopifyImageUrl` field as backup
- New layouts use optimized images automatically
- Existing layouts continue working (no migration needed)
- Consider adding multiple sizes for different contexts later

### 4. Testing
1. Create new product layout
2. Verify WebP files are created with descriptive names
3. Test in full.tsx - should load much faster
4. Check CORS errors are resolved
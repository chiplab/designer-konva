import type { Stage } from "konva/lib/Stage";
import type { Layer } from "konva/lib/Layer";
import { loadImage } from "canvas";

// Only set up mock window when actually generating preview
function setupServerSideKonva() {
  if (!(global as any).window) {
    (global as any).window = {
      devicePixelRatio: 1,
      matchMedia: () => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      })
    };
  }
}

/**
 * Generates a preview image from template data using server-side Konva
 * Returns a base64 encoded PNG
 */
export async function generatePreviewImage(canvasData: any): Promise<string> {
  try {
    // Set up server-side environment before importing Konva
    setupServerSideKonva();
    
    // Dynamic import to ensure window is set up first
    const Konva = (await import("konva")).default;
    
    const { dimensions, backgroundColor, designableArea, elements, assets } = canvasData;
    
    // Validate required data
    if (!dimensions || !dimensions.width || !dimensions.height) {
      throw new Error('Invalid canvas dimensions');
    }
    
    console.log('Creating stage with dimensions:', dimensions);
    
    // Create Konva stage without container (as in the working Konva preview)
    const stage = new Konva.Stage({
      width: dimensions.width,
      height: dimensions.height,
    });
    
    console.log('Stage created successfully');
    
    // Create layers
    const backgroundLayer = new Konva.Layer();
    const designLayer = new Konva.Layer();
    stage.add(backgroundLayer);
    stage.add(designLayer);
    
    // Load and draw base image if exists
    if (assets?.baseImage) {
      try {
        let imageUrl = assets.baseImage;
        if (imageUrl.startsWith('/')) {
          // Local path - load from public directory
          const path = await import('path');
          imageUrl = path.join(process.cwd(), 'public', imageUrl);
          console.log('Loading base image from:', imageUrl);
          const img = await loadImage(imageUrl);
          const baseImage = new Konva.Image({
            image: img as any,
            x: 0,
            y: 0,
            width: dimensions.width,
            height: dimensions.height,
          });
          backgroundLayer.add(baseImage);
        } else {
          // S3 URLs and other external URLs can be loaded
          console.log('Loading base image from:', imageUrl);
          const img = await loadImage(imageUrl);
          const baseImage = new Konva.Image({
            image: img as any,
            x: 0,
            y: 0,
            width: dimensions.width,
            height: dimensions.height,
          });
          backgroundLayer.add(baseImage);
        }
      } catch (error) {
        console.warn('Failed to load base image:', error);
        // Continue without base image
      }
    }
    
    // Create clipping group for design area (matching DesignerCanvas exactly)
    const clipGroup = new Konva.Group({
      clipFunc: (ctx) => {
        // Create clipping path that exactly matches the dotted line overlay
        const x = designableArea.x;
        const y = designableArea.y;
        const width = designableArea.width;
        const height = designableArea.height;
        const radius = designableArea.cornerRadius;
        
        // Use same logic as Konva Rect with cornerRadius
        ctx.beginPath();
        if (radius > 0) {
          ctx.moveTo(x + radius, y);
          ctx.arcTo(x + width, y, x + width, y + height, radius);
          ctx.arcTo(x + width, y + height, x, y + height, radius);
          ctx.arcTo(x, y + height, x, y, radius);
          ctx.arcTo(x, y, x + width, y, radius);
        } else {
          ctx.rect(x, y, width, height);
        }
        ctx.closePath();
      }
    });
    
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
          fillLinearGradientColorStops: [0, '#c8102e', 1, '#ffaaaa'],
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
          fillRadialGradientColorStops: [0, '#c8102e', 1, '#ffaaaa'],
        });
      } else {
        bgRect = new Konva.Rect({
          x: designableArea.x,
          y: designableArea.y,
          width: designableArea.width,
          height: designableArea.height,
          cornerRadius: designableArea.cornerRadius,
          fill: backgroundColor,
        });
      }
      
      clipGroup.add(bgRect);
    }
    
    // Render images
    if (elements?.imageElements) {
      for (const el of elements.imageElements) {
        try {
          let imageUrl = el.url;
          if (imageUrl.startsWith('/media/')) {
            console.log('Skipping local image element in server context:', imageUrl);
            continue; // Skip local images for now
          }
          
          const imageSource = await loadImage(imageUrl);
          console.log(`Loaded image: ${imageUrl} (intrinsic: ${imageSource.width}x${imageSource.height}, target: ${el.width}x${el.height})`);
          
          // Match the ImageElement component's centering behavior
          const image = new Konva.Image({
            image: imageSource as any,
            x: el.x + el.width / 2,
            y: el.y + el.height / 2,
            width: el.width,
            height: el.height,
            offsetX: el.width / 2,
            offsetY: el.height / 2,
            rotation: el.rotation || 0,
            scaleX: el.scaleX || 1,
            scaleY: el.scaleY || 1,
          });
          clipGroup.add(image);
        } catch (error) {
          console.warn(`Failed to load image ${el.id}:`, error);
        }
      }
    }
    
    // Render regular text elements
    if (elements?.textElements) {
      elements.textElements.forEach((el: any) => {
        // Use placeholder text if empty
        const displayText = el.text?.trim() || 'Your Text Here';
        const isPlaceholder = !el.text?.trim();
        
        const text = new Konva.Text({
          text: displayText,
          x: el.x,
          y: el.y,
          fontSize: el.fontSize || 24,
          fontFamily: el.fontFamily || 'Arial',
          fill: isPlaceholder ? '#999999' : (el.fill || 'black'),
          rotation: el.rotation || 0,
          scaleX: el.scaleX || 1,
          scaleY: el.scaleY || 1,
        });
        
        if (el.stroke && el.stroke !== 'transparent' && !isPlaceholder) {
          text.stroke(el.stroke);
          text.strokeWidth(el.strokeWidth || 2);
        }
        
        clipGroup.add(text);
      });
    }
    
    // Render gradient text elements
    if (elements?.gradientTextElements) {
      elements.gradientTextElements.forEach((el: any) => {
        const displayText = el.text?.trim() || 'Your Text Here';
        const isPlaceholder = !el.text?.trim();
        
        const text = new Konva.Text({
          text: displayText,
          x: el.x,
          y: el.y,
          fontSize: el.fontSize || 24,
          fontFamily: el.fontFamily || 'Arial',
          rotation: el.rotation || 0,
          scaleX: el.scaleX || 1,
          scaleY: el.scaleY || 1,
        });
        
        if (isPlaceholder) {
          text.fill('#999999');
        } else {
          text.fillLinearGradientStartPoint({ x: 0, y: 0 });
          text.fillLinearGradientEndPoint({ x: 0, y: el.fontSize || 24 });
          text.fillLinearGradientColorStops([0, '#FFD700', 0.5, '#FFA500', 1, '#B8860B']);
        }
        
        clipGroup.add(text);
      });
    }
    
    // Render curved text elements
    // Server-side TextPath is complex, so we'll approximate with regular text
    if (elements?.curvedTextElements) {
      console.log('Processing curved text elements:', elements.curvedTextElements.length);
      elements.curvedTextElements.forEach((el: any) => {
        const displayText = el.text?.trim() || 'Your Curved Text';
        const isPlaceholder = !el.text?.trim();
        
        console.log('Creating curved text:', displayText);
        // For server-side rendering, we'll render as slightly curved text
        // by adjusting the position and adding a subtle arc indicator
        const text = new Konva.Text({
          text: displayText,
          x: el.x,
          y: el.topY,
          fontSize: el.fontSize || 20,
          fontFamily: el.fontFamily || 'Arial',
          fill: isPlaceholder ? '#999999' : (el.fill || 'black'),
          rotation: el.rotation || 0,
          scaleX: el.scaleX || 1,
          scaleY: el.scaleY || 1,
          align: 'center',
        });
        
        console.log('Text created, getting width...');
        // Center the text horizontally
        try {
          const width = text.width();
          console.log('Text width:', width);
          if (width && !isNaN(width)) {
            text.offsetX(width / 2);
          }
        } catch (e) {
          console.log('Could not get text width:', e);
        }
        
        clipGroup.add(text);
      });
    }
    
    // Add clip group to design layer
    designLayer.add(clipGroup);
    
    // Add a subtle "Customizable" badge in the corner
    const badgeGroup = new Konva.Group({
      x: dimensions.width - 120,
      y: dimensions.height - 40,
    });
    
    const badge = new Konva.Rect({
      width: 100,
      height: 30,
      fill: '#000000',
      opacity: 0.7,
      cornerRadius: 15,
    });
    
    const badgeText = new Konva.Text({
      text: 'Customizable',
      fontSize: 12,
      fontFamily: 'Arial',
      fill: '#ffffff',
      width: 100,
      height: 30,
      align: 'center',
      verticalAlign: 'middle',
    });
    
    badgeGroup.add(badge);
    badgeGroup.add(badgeText);
    designLayer.add(badgeGroup);
    
    // Draw layers
    console.log('Drawing layers...');
    backgroundLayer.draw();
    designLayer.draw();
    console.log('Layers drawn');
    
    // For server-side rendering, use toDataURL like in the working Konva preview
    try {
      console.log('Starting export...');
      
      // Use toDataURL with higher pixel ratio for better quality
      // This is especially important for SVGs to maintain sharpness
      const dataUrl = stage.toDataURL({ pixelRatio: 2 });
      console.log('Export complete, data URL length:', dataUrl.length);
      return dataUrl;
    } catch (exportError) {
      console.error('Error during export:', exportError);
      throw exportError;
    }
  } catch (error) {
    console.error('Error in generatePreviewImage:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    throw error; // Throw the original error to see the real issue
  }
}

/**
 * Uploads an image to Shopify and returns the image info
 */
export async function uploadImageToShopify(
  admin: any,
  imageData: string,
  filename: string
) {
  // Convert base64 to buffer
  const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");
  
  // Create staged upload
  const stagedUploadResponse = await admin.graphql(
    `#graphql
    mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets {
          url
          resourceUrl
          parameters {
            name
            value
          }
        }
      }
    }`,
    {
      variables: {
        input: [
          {
            resource: "IMAGE",
            filename: filename,
            mimeType: "image/png",
            fileSize: buffer.length.toString(),
          },
        ],
      },
    }
  );
  
  const stagedResponseData = await stagedUploadResponse.json();
  console.log('Staged upload response:', JSON.stringify(stagedResponseData, null, 2));
  
  const { data } = stagedResponseData;
  if (!data?.stagedUploadsCreate?.stagedTargets?.[0]) {
    throw new Error('Failed to create staged upload: ' + JSON.stringify(stagedResponseData));
  }
  
  const target = data.stagedUploadsCreate.stagedTargets[0];
  console.log('Staged upload target:', target);
  
  // Upload to staged URL
  // For Google Cloud Storage, we need to check if this is GCS or another service
  console.log('Uploading file to staged URL...');
  console.log('Target URL:', target.url);
  console.log('Parameters:', target.parameters);
  
  // Check if this is a Google Cloud Storage URL
  const isGoogleCloudStorage = target.url.includes('storage.googleapis.com');
  
  if (isGoogleCloudStorage) {
    // For Google Cloud Storage, try a direct PUT request first
    console.log('Detected Google Cloud Storage, using PUT request...');
    
    const uploadResponse = await fetch(target.url, {
      method: "PUT",
      body: buffer,
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': buffer.length.toString(),
      },
    });
    
    console.log('GCS PUT response status:', uploadResponse.status);
    
    if (!uploadResponse.ok) {
      // If PUT fails, try multipart form data
      console.log('PUT failed, trying multipart POST...');
      
      // Import node-fetch-native which handles form-data better
      const FormData = await import('form-data').then(m => m.default);
      const formData = new FormData();
      
      // Add parameters first (if any)
      if (target.parameters && Array.isArray(target.parameters)) {
        for (const param of target.parameters) {
          console.log(`Adding parameter: ${param.name} = ${param.value}`);
          formData.append(param.name, param.value);
        }
      }
      
      // Add the file last
      formData.append('file', buffer, {
        filename: filename,
        contentType: 'image/png',
      });
      
      const postResponse = await fetch(target.url, {
        method: "POST",
        body: formData as any,
        headers: formData.getHeaders(),
      });
      
      console.log('GCS POST response status:', postResponse.status);
      
      if (!postResponse.ok) {
        const responseText = await postResponse.text();
        console.error('Both PUT and POST failed. Status:', postResponse.status);
        console.error('Response:', responseText);
        throw new Error(`Failed to upload image to Google Cloud Storage. Status: ${postResponse.status}, Response: ${responseText}`);
      }
    }
  } else {
    // For other services, use standard multipart form data
    const FormData = await import('form-data').then(m => m.default);
    const formData = new FormData();
    
    // Add parameters first (if any)
    if (target.parameters && Array.isArray(target.parameters)) {
      for (const param of target.parameters) {
        console.log(`Adding parameter: ${param.name} = ${param.value}`);
        formData.append(param.name, param.value);
      }
    }
    
    // Add the file last
    formData.append('file', buffer, {
      filename: filename,
      contentType: 'image/png',
    });
    
    console.log('Uploading with multipart form data...');
    console.log('Form data boundary:', formData.getBoundary());
    
    const uploadResponse = await fetch(target.url, {
      method: "POST",
      body: formData as any,
      headers: formData.getHeaders(),
    });
  
    console.log('Upload response status:', uploadResponse.status);
    
    if (!uploadResponse.ok) {
      const responseText = await uploadResponse.text();
      console.error('Upload failed. Status:', uploadResponse.status);
      console.error('Response:', responseText);
      throw new Error(`Failed to upload image to Shopify. Status: ${uploadResponse.status}, Response: ${responseText}`);
    }
  }
  
  // Successfully uploaded, return the resource URL
  console.log('Upload successful! Resource URL:', target.resourceUrl);
  
  return {
    url: target.resourceUrl,
    filename: filename,
  };
}

/**
 * Updates a product variant's image
 */
export async function updateVariantImage(
  admin: any,
  variantId: string,
  imageUrl: string
) {
  // First get the product ID from the variant
  const variantQuery = `#graphql
    query getVariant($id: ID!) {
      productVariant(id: $id) {
        id
        product {
          id
        }
      }
    }
  `;
  
  const variantResponse = await admin.graphql(variantQuery, {
    variables: { id: variantId }
  });
  
  const { data: variantData } = await variantResponse.json();
  const productId = variantData.productVariant.product.id;
  
  // Check if variant already has media and remove it
  const checkExistingMediaQuery = `#graphql
    query checkVariantMedia($id: ID!) {
      productVariant(id: $id) {
        id
        media(first: 10) {
          edges {
            node {
              ... on MediaImage {
                id
              }
            }
          }
        }
      }
    }
  `;
  
  const existingMediaResponse = await admin.graphql(checkExistingMediaQuery, {
    variables: { id: variantId }
  });
  
  const { data: existingMediaData } = await existingMediaResponse.json();
  const existingMedia = existingMediaData?.productVariant?.media?.edges || [];
  
  if (existingMedia.length > 0) {
    console.log(`Variant has ${existingMedia.length} existing media items. Removing them first...`);
    
    // Detach existing media from variant
    const detachMediaMutation = `#graphql
      mutation productVariantDetachMedia($productId: ID!, $variantMedia: [ProductVariantDetachMediaInput!]!) {
        productVariantDetachMedia(productId: $productId, variantMedia: $variantMedia) {
          product {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `;
    
    const mediaToDetach = existingMedia.map((edge: any) => ({
      variantId: variantId,
      mediaIds: [edge.node.id]
    }));
    
    const detachResponse = await admin.graphql(detachMediaMutation, {
      variables: {
        productId: productId,
        variantMedia: mediaToDetach
      }
    });
    
    const { data: detachData } = await detachResponse.json();
    
    if (detachData?.productVariantDetachMedia?.userErrors?.length > 0) {
      console.warn('Warning: Failed to detach some existing media:', detachData.productVariantDetachMedia.userErrors);
    } else {
      console.log('Successfully detached existing media from variant');
    }
  }
  
  // Create the image on the product first
  const createImageMutation = `#graphql
    mutation productCreateMedia($media: [CreateMediaInput!]!, $productId: ID!) {
      productCreateMedia(media: $media, productId: $productId) {
        media {
          ... on MediaImage {
            id
            image {
              url
            }
          }
        }
        mediaUserErrors {
          field
          message
        }
      }
    }
  `;
  
  const createImageResponse = await admin.graphql(createImageMutation, {
    variables: {
      productId: productId,
      media: [{
        originalSource: imageUrl,
        mediaContentType: "IMAGE"
      }]
    }
  });
  
  const { data: imageData } = await createImageResponse.json();
  
  if (imageData.productCreateMedia.mediaUserErrors.length > 0) {
    throw new Error(
      `Failed to create product image: ${imageData.productCreateMedia.mediaUserErrors[0].message}`
    );
  }
  
  const mediaId = imageData.productCreateMedia.media[0].id;
  
  // Wait for media to be ready (Shopify needs time to process the image)
  console.log('Waiting for media to be ready...');
  let mediaReady = false;
  let attempts = 0;
  const maxAttempts = 30; // 30 seconds max wait
  
  while (!mediaReady && attempts < maxAttempts) {
    // Query to check media status
    const mediaStatusQuery = `#graphql
      query checkMediaStatus($mediaId: ID!) {
        node(id: $mediaId) {
          ... on MediaImage {
            id
            status
          }
        }
      }
    `;
    
    const statusResponse = await admin.graphql(mediaStatusQuery, {
      variables: { mediaId: mediaId }
    });
    
    const { data: statusData } = await statusResponse.json();
    const mediaStatus = statusData?.node?.status;
    
    console.log(`Media status check ${attempts + 1}/${maxAttempts}: ${mediaStatus}`);
    
    if (mediaStatus === 'READY') {
      mediaReady = true;
    } else if (mediaStatus === 'FAILED') {
      throw new Error('Media processing failed in Shopify');
    } else {
      // Wait 1 second before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
  }
  
  if (!mediaReady) {
    throw new Error('Media processing timed out after 30 seconds');
  }
  
  console.log('Media is ready! Proceeding to append to variant...');
  
  // Now append the media to the variant using the 2025-01 API mutation
  const appendMediaMutation = `#graphql
    mutation productVariantAppendMedia($productId: ID!, $variantMedia: [ProductVariantAppendMediaInput!]!) {
      productVariantAppendMedia(productId: $productId, variantMedia: $variantMedia) {
        product {
          id
          variants(first: 100) {
            edges {
              node {
                id
                media(first: 10) {
                  edges {
                    node {
                      ... on MediaImage {
                        id
                        image {
                          url
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
  
  const appendResponse = await admin.graphql(appendMediaMutation, {
    variables: {
      productId: productId,
      variantMedia: [{
        variantId: variantId,
        mediaIds: [mediaId]
      }]
    }
  });
  
  const { data: appendData } = await appendResponse.json();
  
  if (appendData.productVariantAppendMedia.userErrors && appendData.productVariantAppendMedia.userErrors.length > 0) {
    throw new Error(
      `Failed to append media to variant: ${appendData.productVariantAppendMedia.userErrors[0].message}`
    );
  }
  
  // Find and return the updated variant
  const updatedVariant = appendData.productVariantAppendMedia.product.variants.edges.find(
    (edge: any) => edge.node.id === variantId
  );
  
  return updatedVariant ? updatedVariant.node : { id: variantId, media: { edges: [] } };
}
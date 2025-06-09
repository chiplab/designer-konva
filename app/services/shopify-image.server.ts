/**
 * Shopify image upload and variant image management utilities
 */

/**
 * Uploads an image to Shopify and returns the image info
 */
export async function uploadImageToShopify(
  admin: any,
  imageData: string,
  filename: string
) {
  // Check if imageData is already a URL (S3 or other)
  if (imageData.startsWith('https://') || imageData.startsWith('http://')) {
    console.log('Image is already a URL, using it directly:', imageData);
    return {
      url: imageData,
      filename: filename,
    };
  }
  
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
  
  console.log('Creating media with URL:', imageUrl);
  
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
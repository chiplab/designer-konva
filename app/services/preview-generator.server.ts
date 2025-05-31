import { createCanvas, loadImage } from "canvas";
import type { Stage } from "konva/lib/Stage";
import type { Layer } from "konva/lib/Layer";

// We'll use the canvas package for server-side rendering
// This requires installing: npm install canvas konva

/**
 * Generates a preview image from template data
 * Returns a base64 encoded PNG
 */
export async function generatePreviewImage(canvasData: any): Promise<string> {
  // For now, we'll create a simple placeholder
  // In production, we'd use konva-node to render the full template
  
  const { dimensions } = canvasData;
  const canvas = createCanvas(dimensions.width, dimensions.height);
  const ctx = canvas.getContext("2d");
  
  // Fill background
  ctx.fillStyle = canvasData.backgroundColor || "#ffffff";
  ctx.fillRect(0, 0, dimensions.width, dimensions.height);
  
  // Add placeholder text in center
  ctx.fillStyle = "#666666";
  ctx.font = "24px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Customizable Product", dimensions.width / 2, dimensions.height / 2);
  
  // Add subtle badge
  ctx.fillStyle = "#007bff";
  ctx.fillRect(dimensions.width - 100, 10, 90, 30);
  ctx.fillStyle = "#ffffff";
  ctx.font = "12px Arial";
  ctx.fillText("Customize", dimensions.width - 55, 25);
  
  // Convert to base64
  return canvas.toDataURL();
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
  
  const { data } = await stagedUploadResponse.json();
  const target = data.stagedUploadsCreate.stagedTargets[0];
  
  // Upload to staged URL
  const formData = new FormData();
  target.parameters.forEach((param: any) => {
    formData.append(param.name, param.value);
  });
  formData.append("file", new Blob([buffer], { type: "image/png" }), filename);
  
  const uploadResponse = await fetch(target.url, {
    method: "POST",
    body: formData,
  });
  
  if (!uploadResponse.ok) {
    throw new Error("Failed to upload image to Shopify");
  }
  
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
  const mutation = `#graphql
    mutation productVariantUpdate($input: ProductVariantInput!) {
      productVariantUpdate(input: $input) {
        productVariant {
          id
          image {
            url
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
  
  const response = await admin.graphql(mutation, {
    variables: {
      input: {
        id: variantId,
        imageSrc: imageUrl,
      },
    },
  });
  
  const { data } = await response.json();
  
  if (data.productVariantUpdate.userErrors.length > 0) {
    throw new Error(
      `Failed to update variant image: ${data.productVariantUpdate.userErrors[0].message}`
    );
  }
  
  return data.productVariantUpdate.productVariant;
}
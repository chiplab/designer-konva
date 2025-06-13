import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

const prisma = new PrismaClient();

async function checkVariantImages() {
  try {
    // Get shop and access token from session
    const sessions = await prisma.session.findMany({
      where: { shop: { contains: 'printlabs-app-dev' } },
      orderBy: { expires: 'desc' },
      take: 1
    });

    if (!sessions.length) {
      console.error('No session found for shop');
      return;
    }

    const session = sessions[0];
    const shop = session.shop;
    const accessToken = session.accessToken;

    // Get all templates with variant IDs
    const templates = await prisma.template.findMany({
      where: {
        shopifyVariantId: { not: null },
        shop: shop
      },
      orderBy: [
        { colorVariant: 'asc' },
        { name: 'asc' }
      ]
    });

    console.log(`\nChecking ${templates.length} variants in Shopify...\n`);
    console.log(`Shop: ${shop}`);
    console.log(`Access Token: ${accessToken ? 'Found' : 'Not found'}\n`);

    if (!accessToken) {
      console.error('No access token found. Please ensure the app is properly installed.');
      return;
    }

    // Check variants in smaller batches
    const batchSize = 5;
    let variantsWithImages = 0;
    let variantsWithoutImages = 0;
    const missingImages = [];

    for (let i = 0; i < templates.length; i += batchSize) {
      const batch = templates.slice(i, i + batchSize);
      const variantIds = batch.map(t => t.shopifyVariantId);
      
      const query = `
        query GetVariants($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on ProductVariant {
              id
              title
              displayName
              image {
                id
                url
                altText
              }
              product {
                title
              }
            }
          }
        }
      `;

      const response = await fetch(`https://${shop}/admin/api/2025-01/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({
          query,
          variables: { ids: variantIds }
        })
      });

      const data = await response.json();
      
      if (data.errors) {
        console.error('GraphQL errors:', data.errors);
        continue;
      }

      data.data.nodes.forEach((variant, index) => {
        const template = batch[index];
        if (variant?.image) {
          variantsWithImages++;
        } else {
          variantsWithoutImages++;
          missingImages.push({
            product: variant?.product?.title || 'Unknown Product',
            variant: variant?.displayName || variant?.title || 'Unknown Variant',
            template: template.name,
            templateThumbnail: template.thumbnail
          });
        }
      });
    }

    // Display results
    console.log('=== SUMMARY ===');
    console.log(`Total variants checked: ${templates.length}`);
    console.log(`Variants with images: ${variantsWithImages}`);
    console.log(`Variants without images: ${variantsWithoutImages}`);
    
    if (missingImages.length > 0) {
      console.log('\n=== VARIANTS MISSING IMAGES ===');
      missingImages.forEach(item => {
        console.log(`\n${item.product} - ${item.variant}`);
        console.log(`  Template: ${item.template}`);
        console.log(`  Template has thumbnail: ${item.templateThumbnail ? 'Yes' : 'No'}`);
      });
      
      console.log('\n=== ACTION REQUIRED ===');
      console.log('To sync the template thumbnails to these variants:');
      console.log('1. Run "npm run dev"');
      console.log('2. Navigate to the Templates page (/app/templates)');
      console.log('3. Click "Re-sync preview images" for each template');
      console.log('\nThis will upload the template thumbnails as variant images in Shopify.');
    } else {
      console.log('\n✅ All variants have images!');
    }

  } catch (error) {
    console.error('Error checking variant images:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkVariantImages();
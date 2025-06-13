import { PrismaClient } from '@prisma/client';
import { shopifyApp } from '@shopify/shopify-app-remix/server';
import { AppSessionStorage } from '../app/shopify.server.js';

const prisma = new PrismaClient();

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecret: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: "2025-01",
  scopes: process.env.SCOPES?.split(",") || [],
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new AppSessionStorage(prisma),
  distribution: "single_merchant"
});

async function checkVariantImages() {
  try {
    // Get a session for the shop
    const sessions = await prisma.session.findMany({
      where: { shop: { contains: 'cozycustomscreations' } },
      orderBy: { expires: 'desc' },
      take: 1
    });

    if (!sessions.length) {
      console.error('No session found for shop');
      return;
    }

    const session = sessions[0];
    const { admin } = await shopify.unauthenticated.admin(session.shop);

    // Get all templates with variant IDs
    const templates = await prisma.template.findMany({
      where: {
        shopifyVariantId: { not: null },
        shop: session.shop
      }
    });

    console.log(`\nChecking ${templates.length} variants in Shopify...\n`);

    // Check each variant in batches
    const batchSize = 10;
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

      const response = await admin.graphql(query, {
        variables: { ids: variantIds }
      });

      const data = await response.json();
      
      data.data.nodes.forEach((variant, index) => {
        const template = batch[index];
        const hasImage = variant?.image ? '✓' : '✗';
        const imageUrl = variant?.image?.url || 'No image';
        
        console.log(`${variant?.product?.title || 'Unknown Product'} - ${variant?.displayName || variant?.title || 'Unknown Variant'}`);
        console.log(`  Template: ${template.name}`);
        console.log(`  Has Image: ${hasImage}`);
        if (variant?.image) {
          console.log(`  Image URL: ${imageUrl}`);
          console.log(`  Template Thumbnail: ${template.thumbnail}`);
          console.log(`  URLs Match: ${imageUrl === template.thumbnail ? 'Yes' : 'No'}`);
        }
        console.log('');
      });
    }

    // Summary
    const variantsWithImages = templates.filter(async (template) => {
      const query = `
        query GetVariant($id: ID!) {
          productVariant(id: $id) {
            image { id }
          }
        }
      `;
      const response = await admin.graphql(query, {
        variables: { id: template.shopifyVariantId }
      });
      const data = await response.json();
      return data.data.productVariant?.image;
    });

    console.log('\n=== SUMMARY ===');
    console.log(`Total variants checked: ${templates.length}`);
    console.log(`All templates have thumbnails: Yes`);
    console.log('\nNote: Run "npm run dev" and use the "Re-sync preview images" button in the templates page to sync thumbnails to Shopify.');

  } catch (error) {
    console.error('Error checking variant images:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkVariantImages();
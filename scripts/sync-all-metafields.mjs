#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';
import { shopifyApp } from "@shopify/shopify-app-remix/server";
import { ApiVersion, AppDistribution } from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

// Initialize Shopify app
const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.January25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    unstable_newEmbeddedAuthStrategy: true,
  },
});

const METAFIELD_SET_MUTATION = `#graphql
  mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        id
        namespace
        key
        value
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

async function syncAllMetafields() {
  try {
    console.log('🔍 Starting full metafield sync...\n');

    // Get the session for the shop
    const shop = 'printlabs-app-dev.myshopify.com';
    const { admin } = await shopify.unauthenticated.admin(shop);

    // Get ALL templates that need metafield sync
    const templates = await prisma.template.findMany({
      where: {
        shopifyVariantId: { not: null },
        thumbnail: { not: null },
        shop
      },
      select: {
        id: true,
        name: true,
        shopifyVariantId: true,
        colorVariant: true
      }
    });

    console.log(`Found ${templates.length} templates to sync metafields for.\n`);

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // Process in batches of 10
    const BATCH_SIZE = 10;
    
    for (let i = 0; i < templates.length; i += BATCH_SIZE) {
      const batch = templates.slice(i, i + BATCH_SIZE);
      console.log(`\nProcessing batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(templates.length/BATCH_SIZE)}...`);
      
      await Promise.all(batch.map(async (template) => {
        try {
          const response = await admin.graphql(METAFIELD_SET_MUTATION, {
            variables: {
              metafields: [{
                ownerId: template.shopifyVariantId,
                namespace: "custom_designer",
                key: "template_id",
                value: template.id,
                type: "single_line_text_field"
              }]
            }
          });

          const result = await response.json();

          if (result.data?.metafieldsSet?.userErrors?.length > 0) {
            errorCount++;
            errors.push(`${template.name}: ${result.data.metafieldsSet.userErrors[0].message}`);
            console.error(`  ❌ ${template.name}`);
          } else if (result.data?.metafieldsSet?.metafields?.length > 0) {
            successCount++;
            console.log(`  ✅ ${template.name}`);
          }
        } catch (error) {
          errorCount++;
          errors.push(`${template.name}: ${error.message}`);
          console.error(`  ❌ ${template.name}: ${error.message}`);
        }
      }));
      
      // Small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < templates.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('\n═'.repeat(50));
    console.log('📊 SYNC SUMMARY');
    console.log('═'.repeat(50));
    console.log(`Total templates: ${templates.length}`);
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    
    if (errors.length > 0) {
      console.log('\nErrors:');
      errors.slice(0, 5).forEach(e => console.log(`  - ${e}`));
      if (errors.length > 5) {
        console.log(`  ... and ${errors.length - 5} more errors`);
      }
    }

    console.log('\n✅ Full sync complete!');

  } catch (error) {
    console.error('Error in full sync:', error);
  } finally {
    await prisma.$disconnect();
  }
}

syncAllMetafields();
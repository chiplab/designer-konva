#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';
import { shopifyApp } from "@shopify/shopify-app-remix/server";
import { ApiVersion, AppDistribution } from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";

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

async function syncMetafieldsManually() {
  try {
    console.log('🔍 Starting manual metafield sync...\n');

    // Get the session for the shop
    const shop = 'printlabs-app-dev.myshopify.com';
    const session = await prisma.session.findFirst({
      where: { shop }
    });

    if (!session) {
      console.error('No session found for shop:', shop);
      return;
    }

    const { admin } = await shopify.unauthenticated.admin(shop);

    // Get templates that need metafield sync
    const templates = await prisma.template.findMany({
      where: {
        shopifyVariantId: { not: null },
        thumbnail: { not: null },
        isColorVariant: true,
        shop
      },
      select: {
        id: true,
        name: true,
        shopifyVariantId: true,
        colorVariant: true
      },
      take: 5 // Start with just 5 to test
    });

    console.log(`Found ${templates.length} templates to sync metafields for:\n`);

    for (const template of templates) {
      console.log(`\nSyncing template: ${template.name}`);
      console.log(`  Template ID: ${template.id}`);
      console.log(`  Variant ID: ${template.shopifyVariantId}`);

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
          console.error(`  ❌ Failed:`, result.data.metafieldsSet.userErrors);
        } else if (result.data?.metafieldsSet?.metafields?.length > 0) {
          console.log(`  ✅ Success! Metafield set:`, result.data.metafieldsSet.metafields[0].id);
        } else {
          console.log(`  ❓ Unknown result:`, result);
        }
      } catch (error) {
        console.error(`  ❌ Error:`, error.message);
      }
    }

    console.log('\n✅ Manual sync complete!');

  } catch (error) {
    console.error('Error in manual sync:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Load env vars
import dotenv from 'dotenv';
dotenv.config();

syncMetafieldsManually();
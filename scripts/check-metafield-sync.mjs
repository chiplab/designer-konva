#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkMetafieldSync() {
  try {
    console.log('🔍 Checking template metafield sync status...\n');

    // Get templates that should have metafields set
    const templatesWithVariants = await prisma.template.findMany({
      where: {
        shopifyVariantId: { not: null },
        isColorVariant: true
      },
      select: {
        id: true,
        name: true,
        shopifyVariantId: true,
        colorVariant: true,
        thumbnail: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 10 // Show last 10 created
    });

    console.log(`Found ${templatesWithVariants.length} recent templates with shopifyVariantId:\n`);

    templatesWithVariants.forEach((template, i) => {
      console.log(`${i + 1}. Template: ${template.name}`);
      console.log(`   ID: ${template.id}`);
      console.log(`   Color: ${template.colorVariant}`);
      console.log(`   Variant ID: ${template.shopifyVariantId}`);
      console.log(`   Has thumbnail: ${!!template.thumbnail}`);
      console.log(`   Created: ${template.createdAt.toISOString()}`);
      console.log(`   Updated: ${template.updatedAt.toISOString()}`);
      console.log('');
    });

    // Check how many templates have both variantId AND thumbnail
    const allTemplatesWithVariants = await prisma.template.findMany({
      where: {
        shopifyVariantId: { not: null },
        isColorVariant: true
      }
    });

    const withThumbnails = allTemplatesWithVariants.filter(t => t.thumbnail);
    const withoutThumbnails = allTemplatesWithVariants.filter(t => !t.thumbnail);

    console.log('═'.repeat(50));
    console.log('📊 METAFIELD SYNC REQUIREMENTS');
    console.log('═'.repeat(50));
    console.log(`Total templates with shopifyVariantId: ${allTemplatesWithVariants.length}`);
    console.log(`✅ With thumbnail (can sync metafield): ${withThumbnails.length}`);
    console.log(`❌ Without thumbnail (cannot sync metafield): ${withoutThumbnails.length}`);
    console.log('\nNOTE: Metafields are only set when BOTH shopifyVariantId AND thumbnail exist!');

    // Show specific examples from the product page debug
    const exampleVariantIds = [
      '50098549260583', // Black / 8 Spot
      '50098549227815', // Black / Solid
      '50098548867367', // Red / 8 Spot
    ];

    console.log('\n═'.repeat(50));
    console.log('🔍 CHECKING SPECIFIC VARIANTS FROM DEBUG');
    console.log('═'.repeat(50));

    for (const variantId of exampleVariantIds) {
      const template = await prisma.template.findFirst({
        where: {
          shopifyVariantId: `gid://shopify/ProductVariant/${variantId}`
        }
      });

      if (template) {
        console.log(`\nVariant ${variantId}:`);
        console.log(`  ✅ Has template: ${template.id}`);
        console.log(`  Template name: ${template.name}`);
        console.log(`  Has thumbnail: ${!!template.thumbnail}`);
        console.log(`  Should have metafield: ${!!template.thumbnail ? 'YES' : 'NO (missing thumbnail)'}`);
      } else {
        console.log(`\nVariant ${variantId}: ❌ No template found in database`);
      }
    }

  } catch (error) {
    console.error('Error checking metafield sync:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMetafieldSync();
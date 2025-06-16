import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugTemplates() {
  console.log('=== TEMPLATE DEBUG SCRIPT ===\n');

  try {
    // 1. Count total templates
    const totalTemplates = await prisma.template.count();
    console.log(`Total templates in database: ${totalTemplates}\n`);

    // 2. List all templates with key fields
    console.log('=== ALL TEMPLATES ===');
    const allTemplates = await prisma.template.findMany({
      select: {
        id: true,
        name: true,
        shop: true,
        shopifyProductId: true,
        shopifyVariantId: true,
        masterTemplateId: true,
        isColorVariant: true,
        colorVariant: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    allTemplates.forEach((template, index) => {
      console.log(`\n${index + 1}. Template: ${template.name}`);
      console.log(`   ID: ${template.id}`);
      console.log(`   Shop: ${template.shop}`);
      console.log(`   Shopify Product ID: ${template.shopifyProductId || 'null'}`);
      console.log(`   Shopify Variant ID: ${template.shopifyVariantId || 'null'}`);
      console.log(`   Is Color Variant: ${template.isColorVariant}`);
      console.log(`   Color Variant: ${template.colorVariant || 'null'}`);
      console.log(`   Master Template ID: ${template.masterTemplateId || 'null'}`);
      console.log(`   Created: ${template.createdAt.toISOString()}`);
    });

    // 3. Group by shop
    console.log('\n\n=== TEMPLATES BY SHOP ===');
    const templatesByShop = await prisma.template.groupBy({
      by: ['shop'],
      _count: {
        id: true
      }
    });

    templatesByShop.forEach(group => {
      console.log(`\nShop: ${group.shop}`);
      console.log(`Template count: ${group._count.id}`);
    });

    // 4. Check for specific "unknown" template IDs
    console.log('\n\n=== CHECKING SPECIFIC TEMPLATE IDS ===');
    const unknownIds = [
      'cmbxr1fut000grnyhkl891hsi',
      'cmbxr1fv0000hrnyhahg8eweb',
      'cmbxr1fv1000irnyhzxvbj9xg',
      'cmbxr1fv2000jrnyh8o9dgu6n',
      'cmbxr1fv3000krnyhi4pj97m8',
      'cmbxr1fv4000lrnyhu3o0k96s',
      'cmbxr1fv5000mrnyh04y7tnlw',
      'cmbxr1fv6000nrnyhtdkjhxo7',
      'cmbxr1fv7000ornyh0fvjkftu',
      'cmbxr1fv8000prnyh0ovhvvus',
      'cmbxr1fv9000qrnyhtpimr2c0',
      'cmbxr1fva000rrnyhcq82dgg5',
      // Add more IDs here as needed from your product bindings page
    ];

    for (const id of unknownIds) {
      const template = await prisma.template.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          shop: true,
          shopifyVariantId: true,
        }
      });

      if (template) {
        console.log(`\nFound template ${id}:`);
        console.log(`  Name: ${template.name}`);
        console.log(`  Shop: ${template.shop}`);
        console.log(`  Variant ID: ${template.shopifyVariantId || 'null'}`);
      } else {
        console.log(`\nTemplate ${id} NOT FOUND in database!`);
      }
    }

    // 5. Check for color variants
    console.log('\n\n=== COLOR VARIANTS ===');
    const colorVariants = await prisma.template.findMany({
      where: {
        isColorVariant: true
      },
      select: {
        id: true,
        name: true,
        colorVariant: true,
        masterTemplateId: true,
        shopifyVariantId: true,
      }
    });

    console.log(`Total color variants: ${colorVariants.length}`);
    colorVariants.forEach(variant => {
      console.log(`\n- ${variant.name} (${variant.colorVariant})`);
      console.log(`  ID: ${variant.id}`);
      console.log(`  Master Template: ${variant.masterTemplateId}`);
      console.log(`  Variant ID: ${variant.shopifyVariantId || 'null'}`);
    });

    // 6. Check for templates with shopifyVariantId
    console.log('\n\n=== TEMPLATES WITH SHOPIFY VARIANT IDS ===');
    const templatesWithVariants = await prisma.template.findMany({
      where: {
        shopifyVariantId: {
          not: null
        }
      },
      select: {
        id: true,
        name: true,
        shopifyVariantId: true,
        isColorVariant: true,
      }
    });

    console.log(`Total templates with variant IDs: ${templatesWithVariants.length}`);
    templatesWithVariants.forEach(template => {
      console.log(`\n- ${template.name}`);
      console.log(`  Template ID: ${template.id}`);
      console.log(`  Variant ID: ${template.shopifyVariantId}`);
      console.log(`  Is Color Variant: ${template.isColorVariant}`);
    });

    // 7. Check for orphaned master template references
    console.log('\n\n=== ORPHANED COLOR VARIANTS ===');
    const orphanedVariants = await prisma.template.findMany({
      where: {
        AND: [
          { masterTemplateId: { not: null } },
          { isColorVariant: true }
        ]
      },
      select: {
        id: true,
        name: true,
        masterTemplateId: true,
      }
    });

    for (const variant of orphanedVariants) {
      const master = await prisma.template.findUnique({
        where: { id: variant.masterTemplateId }
      });

      if (!master) {
        console.log(`\nOrphaned variant: ${variant.name}`);
        console.log(`  ID: ${variant.id}`);
        console.log(`  Missing master: ${variant.masterTemplateId}`);
      }
    }

    // 8. Look for recently created templates
    console.log('\n\n=== RECENT TEMPLATES (Last 24 hours) ===');
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const recentTemplates = await prisma.template.findMany({
      where: {
        createdAt: {
          gte: oneDayAgo
        }
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        isColorVariant: true,
        colorVariant: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`Templates created in last 24 hours: ${recentTemplates.length}`);
    recentTemplates.forEach(template => {
      console.log(`\n- ${template.name}`);
      console.log(`  ID: ${template.id}`);
      console.log(`  Created: ${template.createdAt.toISOString()}`);
      if (template.isColorVariant) {
        console.log(`  Color Variant: ${template.colorVariant}`);
      }
    });

  } catch (error) {
    console.error('Error running debug script:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the debug script
debugTemplates().catch(console.error);
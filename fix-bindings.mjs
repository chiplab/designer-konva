#!/usr/bin/env node

/**
 * Script to manually fix template bindings
 * Maps variants to their correct template IDs based on color and pattern
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixBindings() {
  console.log('=== FIXING TEMPLATE BINDINGS ===\n');
  
  try {
    // Get all templates with variant IDs
    const templates = await prisma.template.findMany({
      where: {
        shop: 'printlabs-app-dev.myshopify.com',
        shopifyVariantId: { not: null },
      },
      orderBy: [
        { name: 'asc' }
      ]
    });
    
    console.log(`Found ${templates.length} templates with variant IDs\n`);
    
    // Create a mapping of variant ID to template ID
    const variantToTemplate = {};
    templates.forEach(template => {
      variantToTemplate[template.shopifyVariantId] = template.id;
      console.log(`${template.name}: ${template.shopifyVariantId} -> ${template.id}`);
    });
    
    console.log('\n✅ Mapping created successfully!');
    console.log('\nTo fix the bindings:');
    console.log('1. Go to the Templates page in your Shopify admin');
    console.log('2. Click "Generate color variants" on the master template');
    console.log('3. The new code will delete old variants and create fresh ones with correct bindings');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
fixBindings();
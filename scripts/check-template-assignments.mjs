#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTemplateAssignments() {
  try {
    console.log('🔍 Checking template variant assignments...\n');

    // Get all color variants grouped by master template
    const colorVariants = await prisma.template.findMany({
      where: { isColorVariant: true },
      select: {
        id: true,
        name: true,
        masterTemplateId: true,
        shopifyVariantId: true,
        colorVariant: true,
      },
      orderBy: [
        { masterTemplateId: 'asc' },
        { colorVariant: 'asc' }
      ]
    });

    // Get master templates
    const masterTemplateIds = [...new Set(colorVariants.map(v => v.masterTemplateId).filter(Boolean))];
    const masterTemplates = await prisma.template.findMany({
      where: { id: { in: masterTemplateIds } },
      select: { id: true, name: true }
    });

    const masterTemplateMap = new Map(masterTemplates.map(t => [t.id, t.name]));

    // Group variants by master template
    const variantsByMaster = new Map();
    for (const variant of colorVariants) {
      if (!variant.masterTemplateId) continue;
      
      if (!variantsByMaster.has(variant.masterTemplateId)) {
        variantsByMaster.set(variant.masterTemplateId, []);
      }
      variantsByMaster.get(variant.masterTemplateId).push(variant);
    }

    // Display results
    console.log(`Found ${colorVariants.length} color variants across ${variantsByMaster.size} master templates\n`);

    let totalAssigned = 0;
    let totalUnassigned = 0;

    for (const [masterId, variants] of variantsByMaster) {
      const masterName = masterTemplateMap.get(masterId) || 'Unknown';
      const assigned = variants.filter(v => v.shopifyVariantId).length;
      const unassigned = variants.filter(v => !v.shopifyVariantId).length;
      
      totalAssigned += assigned;
      totalUnassigned += unassigned;

      console.log(`📋 Master: ${masterName}`);
      console.log(`   Total variants: ${variants.length}`);
      console.log(`   ✅ Assigned: ${assigned}`);
      console.log(`   ❌ Unassigned: ${unassigned}`);
      
      if (unassigned > 0) {
        const unassignedColors = variants
          .filter(v => !v.shopifyVariantId)
          .map(v => v.colorVariant)
          .join(', ');
        console.log(`   Missing colors: ${unassignedColors}`);
      }
      console.log('');
    }

    // Summary
    console.log('═'.repeat(50));
    console.log('📊 SUMMARY');
    console.log('═'.repeat(50));
    console.log(`Total color variants: ${colorVariants.length}`);
    console.log(`✅ With shopifyVariantId: ${totalAssigned} (${Math.round(totalAssigned/colorVariants.length*100)}%)`);
    console.log(`❌ Without shopifyVariantId: ${totalUnassigned} (${Math.round(totalUnassigned/colorVariants.length*100)}%)`);

  } catch (error) {
    console.error('Error checking template assignments:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTemplateAssignments();
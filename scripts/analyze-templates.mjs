import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analyzeTemplates() {
  try {
    // Get all templates with shopifyVariantId
    const templatesWithVariantId = await prisma.template.findMany({
      where: {
        shopifyVariantId: {
          not: null
        }
      },
      orderBy: [
        { colorVariant: 'asc' },
        { name: 'asc' }
      ]
    });

    // Get all templates without shopifyVariantId
    const templatesWithoutVariantId = await prisma.template.findMany({
      where: {
        shopifyVariantId: null
      },
      orderBy: [
        { colorVariant: 'asc' },
        { name: 'asc' }
      ]
    });

    console.log('\n=== TEMPLATES WITH SHOPIFY VARIANT ID ===');
    console.log(`Total: ${templatesWithVariantId.length}`);
    
    // Group by color
    const byColor = {};
    templatesWithVariantId.forEach(template => {
      const color = template.colorVariant || 'No color specified';
      if (!byColor[color]) {
        byColor[color] = [];
      }
      byColor[color].push(template);
    });

    // Display grouped results
    Object.entries(byColor).forEach(([color, templates]) => {
      console.log(`\n${color.toUpperCase()} (${templates.length} templates):`);
      templates.forEach(template => {
        const hasThumbnail = template.thumbnail ? '✓' : '✗';
        const thumbnailInfo = template.thumbnail ? 
          (template.thumbnail.startsWith('http') ? 'S3' : 'Local') : 
          'None';
        
        console.log(`  - ${template.name}`);
        console.log(`    ID: ${template.id}`);
        console.log(`    Variant ID: ${template.shopifyVariantId}`);
        console.log(`    Thumbnail: ${hasThumbnail} (${thumbnailInfo})`);
        console.log(`    Master Template: ${template.masterTemplateId || 'N/A'}`);
        console.log(`    Is Color Variant: ${template.isColorVariant}`);
      });
    });

    console.log('\n=== TEMPLATES WITHOUT SHOPIFY VARIANT ID ===');
    console.log(`Total: ${templatesWithoutVariantId.length}`);
    
    if (templatesWithoutVariantId.length > 0) {
      const withoutByColor = {};
      templatesWithoutVariantId.forEach(template => {
        const color = template.colorVariant || 'No color specified';
        if (!withoutByColor[color]) {
          withoutByColor[color] = [];
        }
        withoutByColor[color].push(template);
      });

      Object.entries(withoutByColor).forEach(([color, templates]) => {
        console.log(`\n${color.toUpperCase()} (${templates.length} templates):`);
        templates.forEach(template => {
          const hasThumbnail = template.thumbnail ? '✓' : '✗';
          console.log(`  - ${template.name} [${hasThumbnail}] (ID: ${template.id})`);
        });
      });
    }

    // Summary statistics
    console.log('\n=== SUMMARY ===');
    console.log(`Total templates: ${templatesWithVariantId.length + templatesWithoutVariantId.length}`);
    console.log(`Templates with variant ID: ${templatesWithVariantId.length}`);
    console.log(`Templates without variant ID: ${templatesWithoutVariantId.length}`);
    
    const withThumbnails = templatesWithVariantId.filter(t => t.thumbnail).length;
    console.log(`Templates with variant ID and thumbnail: ${withThumbnails}`);
    console.log(`Templates with variant ID but no thumbnail: ${templatesWithVariantId.length - withThumbnails}`);

    // Check for duplicate variant IDs
    const variantIdCount = {};
    templatesWithVariantId.forEach(template => {
      const vid = template.shopifyVariantId;
      variantIdCount[vid] = (variantIdCount[vid] || 0) + 1;
    });

    const duplicates = Object.entries(variantIdCount).filter(([_, count]) => count > 1);
    if (duplicates.length > 0) {
      console.log('\n=== WARNING: DUPLICATE VARIANT IDS ===');
      duplicates.forEach(([vid, count]) => {
        console.log(`Variant ID ${vid} is used by ${count} templates`);
      });
    }

  } catch (error) {
    console.error('Error analyzing templates:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeTemplates();
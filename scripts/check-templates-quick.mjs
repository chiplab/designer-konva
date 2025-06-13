import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTemplates() {
  try {
    // Get all templates with shopifyVariantId
    const templatesWithVariantId = await prisma.template.findMany({
      where: {
        shop: 'printlabs-app-dev.myshopify.com',
        shopifyVariantId: { not: null },
        thumbnail: { not: null }
      },
      orderBy: [
        { name: 'asc' }
      ]
    });

    console.log(`\nTotal templates with shopifyVariantId and thumbnail: ${templatesWithVariantId.length}\n`);

    // Group by color
    const byColor = {};
    templatesWithVariantId.forEach(t => {
      const colorMatch = t.name.match(/^(\w+(?:\s+\w+)?)\s+\//);
      const color = colorMatch ? colorMatch[1] : 'Unknown';
      if (!byColor[color]) byColor[color] = [];
      byColor[color].push(t);
    });

    // Show colors in order
    const colorOrder = ['Black', 'Blue', 'Brown', 'Gray', 'Green', 'Ivory', 'Light Blue', 'Orange', 'Pink', 'Purple', 'Red', 'White', 'Yellow'];
    
    colorOrder.forEach(color => {
      if (byColor[color]) {
        console.log(`${color}: ${byColor[color].length} templates`);
        byColor[color].forEach(t => {
          console.log(`  - ${t.name.padEnd(35)} ID: ${t.id} Variant: ${t.shopifyVariantId}`);
        });
      }
    });

    // Check for other templates
    Object.keys(byColor).forEach(color => {
      if (!colorOrder.includes(color)) {
        console.log(`\n${color}: ${byColor[color].length} templates`);
        byColor[color].forEach(t => {
          console.log(`  - ${t.name.padEnd(35)} ID: ${t.id}`);
        });
      }
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTemplates();
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testUniqueIds(templateId) {
  try {
    const template = await prisma.template.findUnique({
      where: { id: templateId },
      select: {
        id: true,
        name: true,
        frontCanvasData: true,
        backCanvasData: true
      }
    });

    if (!template) {
      console.log('Template not found');
      return;
    }

    console.log(`\nTemplate: ${template.name} (${template.id})`);
    console.log('=' .repeat(60));
    
    // Extract all IDs from front and back
    const frontIds = new Set();
    const backIds = new Set();
    
    if (template.frontCanvasData) {
      const frontData = JSON.parse(template.frontCanvasData);
      
      // Extract IDs from all element types
      ['textElements', 'curvedTextElements', 'gradientTextElements', 'imageElements', 'shapeElements'].forEach(elementType => {
        if (frontData.elements && frontData.elements[elementType]) {
          frontData.elements[elementType].forEach(el => {
            frontIds.add(el.id);
          });
        }
      });
    }
    
    if (template.backCanvasData) {
      const backData = JSON.parse(template.backCanvasData);
      
      // Extract IDs from all element types
      ['textElements', 'curvedTextElements', 'gradientTextElements', 'imageElements', 'shapeElements'].forEach(elementType => {
        if (backData.elements && backData.elements[elementType]) {
          backData.elements[elementType].forEach(el => {
            backIds.add(el.id);
          });
        }
      });
    }
    
    // Check for duplicate IDs
    const duplicateIds = [...frontIds].filter(id => backIds.has(id));
    
    console.log(`\nFront Canvas Element IDs (${frontIds.size} total):`);
    [...frontIds].sort().forEach(id => console.log(`  - ${id}`));
    
    console.log(`\nBack Canvas Element IDs (${backIds.size} total):`);
    [...backIds].sort().forEach(id => console.log(`  - ${id}`));
    
    console.log('\n' + '=' .repeat(60));
    if (duplicateIds.length > 0) {
      console.log('❌ DUPLICATE IDs FOUND:');
      duplicateIds.forEach(id => console.log(`  - ${id}`));
    } else {
      console.log('✅ No duplicate IDs found - All element IDs are unique!');
    }
    
    // Check if "sameDesignBothSides" flag is set
    if (template.frontCanvasData) {
      const frontData = JSON.parse(template.frontCanvasData);
      if (frontData.sameDesignBothSides !== undefined) {
        console.log(`\n"Same artwork on both sides" toggle: ${frontData.sameDesignBothSides ? 'ENABLED' : 'DISABLED'}`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get template ID from command line argument
const templateId = process.argv[2];

if (!templateId) {
  console.log('Usage: node test-unique-ids.js <template-id>');
  console.log('Example: node test-unique-ids.js cmcme9ggp000177sieni0oejl');
  process.exit(1);
}

testUniqueIds(templateId);
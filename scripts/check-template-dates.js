import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkTemplateDates(templateId) {
  try {
    const template = await prisma.template.findUnique({
      where: { id: templateId },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        frontCanvasData: true,
        backCanvasData: true
      }
    });

    if (!template) {
      console.log('Template not found');
      return;
    }

    console.log(`\nTemplate: ${template.name} (${template.id})`);
    console.log(`Created: ${template.createdAt}`);
    console.log(`Updated: ${template.updatedAt}`);
    
    // Check if sameDesignBothSides flag is present
    let hasSameDesignFlag = false;
    if (template.frontCanvasData) {
      const frontData = JSON.parse(template.frontCanvasData);
      if (frontData.sameDesignBothSides !== undefined) {
        hasSameDesignFlag = true;
        console.log(`\n"Same artwork on both sides" flag: ${frontData.sameDesignBothSides}`);
      }
    }
    
    if (!hasSameDesignFlag) {
      console.log('\n⚠️  This template does not have the "sameDesignBothSides" flag.');
      console.log('It was likely created before the feature was added.');
    }
    
    // Check if front and back are identical (might indicate it was created with the toggle)
    if (template.frontCanvasData && template.backCanvasData) {
      const frontData = JSON.parse(template.frontCanvasData);
      const backData = JSON.parse(template.backCanvasData);
      
      // Compare element counts
      const frontElementCount = (frontData.elements?.textElements?.length || 0) +
                               (frontData.elements?.curvedTextElements?.length || 0) +
                               (frontData.elements?.imageElements?.length || 0) +
                               (frontData.elements?.shapeElements?.length || 0);
                               
      const backElementCount = (backData.elements?.textElements?.length || 0) +
                              (backData.elements?.curvedTextElements?.length || 0) +
                              (backData.elements?.imageElements?.length || 0) +
                              (backData.elements?.shapeElements?.length || 0);
      
      console.log(`\nFront elements: ${frontElementCount}`);
      console.log(`Back elements: ${backElementCount}`);
      
      if (frontElementCount === backElementCount && frontElementCount > 0) {
        console.log('\n📋 Front and back have the same number of elements.');
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
  console.log('Usage: node check-template-dates.js <template-id>');
  process.exit(1);
}

checkTemplateDates(templateId);
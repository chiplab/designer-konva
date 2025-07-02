import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function queryTemplate() {
  try {
    const template = await prisma.template.findUnique({
      where: { id: 'cmcme9ggp000177sieni0oejl' },
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

    console.log('Template found:', template.name);
    console.log('\n=== FRONT CANVAS DATA ===');
    
    if (template.frontCanvasData) {
      const frontData = JSON.parse(template.frontCanvasData);
      console.log('Front Curved Text Elements:');
      if (frontData.elements && frontData.elements.curvedTextElements) {
        frontData.elements.curvedTextElements.forEach(element => {
          console.log(`- ID: ${element.id}, Text: "${element.text}"`);
        });
      }
    }

    console.log('\n=== BACK CANVAS DATA ===');
    
    if (template.backCanvasData) {
      const backData = JSON.parse(template.backCanvasData);
      console.log('Back Curved Text Elements:');
      if (backData.elements && backData.elements.curvedTextElements) {
        backData.elements.curvedTextElements.forEach(element => {
          console.log(`- ID: ${element.id}, Text: "${element.text}"`);
        });
      }
    }

    // Compare IDs
    if (template.frontCanvasData && template.backCanvasData) {
      const frontData = JSON.parse(template.frontCanvasData);
      const backData = JSON.parse(template.backCanvasData);
      
      const frontCurvedIds = frontData.elements?.curvedTextElements?.map(e => e.id) || [];
      const backCurvedIds = backData.elements?.curvedTextElements?.map(e => e.id) || [];
      
      console.log('\n=== ID COMPARISON ===');
      console.log('Front Curved Text IDs:', frontCurvedIds);
      console.log('Back Curved Text IDs:', backCurvedIds);
      
      const duplicateIds = frontCurvedIds.filter(id => backCurvedIds.includes(id));
      if (duplicateIds.length > 0) {
        console.log('\n⚠️  DUPLICATE IDs FOUND:', duplicateIds);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

queryTemplate();
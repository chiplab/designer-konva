const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrateCanvasData() {
  try {
    console.log('Starting canvas data migration...');
    
    // Get all templates that don't have frontCanvasData set
    const templates = await prisma.template.findMany({
      where: {
        frontCanvasData: null,
        canvasData: {
          not: null
        }
      }
    });
    
    console.log(`Found ${templates.length} templates to migrate`);
    
    // Update each template
    for (const template of templates) {
      await prisma.template.update({
        where: { id: template.id },
        data: {
          frontCanvasData: template.canvasData
        }
      });
      console.log(`Migrated template ${template.id} - ${template.name}`);
    }
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrateCanvasData();
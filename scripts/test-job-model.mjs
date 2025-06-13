import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testJobModel() {
  try {
    // Test if we can query the job model
    const jobCount = await prisma.job.count();
    console.log(`Found ${jobCount} jobs in database`);
    
    // Get recent jobs
    const recentJobs = await prisma.job.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' }
    });
    
    console.log('\nRecent jobs:');
    recentJobs.forEach(job => {
      console.log(`- ${job.id}: ${job.type} (${job.status}) - ${job.createdAt.toLocaleString()}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testJobModel();
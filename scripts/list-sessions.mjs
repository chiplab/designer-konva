import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listSessions() {
  try {
    const sessions = await prisma.session.findMany({
      select: {
        id: true,
        shop: true,
        isOnline: true,
        expires: true,
        accessToken: true
      },
      orderBy: { expires: 'desc' }
    });

    console.log(`\nFound ${sessions.length} sessions:\n`);
    
    sessions.forEach(session => {
      console.log(`Shop: ${session.shop}`);
      console.log(`  ID: ${session.id}`);
      console.log(`  Online: ${session.isOnline}`);
      console.log(`  Expires: ${session.expires}`);
      console.log(`  Has Access Token: ${session.accessToken ? 'Yes' : 'No'}`);
      console.log('');
    });

  } catch (error) {
    console.error('Error listing sessions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listSessions();
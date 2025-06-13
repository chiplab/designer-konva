import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const templateColors = [
  { chipColor: 'white', color1: '#ffffff', color2: '#cccccc', color3: '#424242', color4: null, color5: null },
  { chipColor: 'red', color1: '#c8102e', color2: '#ffaaaa', color3: '#6b0615', color4: '#60a8dc', color5: '#ff6d74' },
  { chipColor: 'blue', color1: '#0057b8', color2: '#7fa8db', color3: '#1a4786', color4: '#ebe70e', color5: '#1982ea' },
  { chipColor: 'green', color1: '#009639', color2: '#e0eed5', color3: '#006325', color4: '#841d80', color5: '#60bc82' },
  { chipColor: 'black', color1: '#000000', color2: '#cccccc', color3: '#424242', color4: '#ffffff', color5: '#5b5959' },
  { chipColor: 'purple', color1: '#5f259f', color2: '#aaaaff', color3: '#3f186b', color4: '#45b757', color5: '#8e63bf' },
  { chipColor: 'yellow', color1: '#fff110', color2: '#febd11', color3: '#7c6800', color4: '#215baa', color5: '#cb9f2c' },
  { chipColor: 'grey', color1: '#a2aaad', color2: '#97872a', color3: '#424242', color4: '#983351', color5: '#cccccc' },
  { chipColor: 'orange', color1: '#ff8200', color2: '#ffcfa3', color3: '#87451e', color4: '#d2007d', color5: '#fcb36a' },
  { chipColor: 'ivory', color1: '#f1e6b2', color2: '#f7f4e8', color3: '#b5ac85', color4: '#7c9fcd', color5: '#fff2c1' },
  { chipColor: 'light-blue', color1: '#71c5e8', color2: '#b8d6e0', color3: '#5ca0bd', color4: '#cb4a3b', color5: '#96e1ff' },
  { chipColor: 'pink', color1: '#f8a3bc', color2: '#ffd6e1', color3: '#d38a9f', color4: '#33ba9f', color5: '#ffc4d4' },
  { chipColor: 'brown', color1: '#9e652e', color2: '#c49a73', color3: '#734921', color4: '#000000', color5: '#e8a86d' },
];

async function main() {
  console.log('Seeding TemplateColor data...');
  
  for (const color of templateColors) {
    try {
      await prisma.templateColor.upsert({
        where: { chipColor: color.chipColor },
        update: color,
        create: color,
      });
      console.log(`✓ Created/updated color: ${color.chipColor}`);
    } catch (error) {
      console.error(`✗ Error creating color ${color.chipColor}:`, error);
    }
  }
  
  console.log('\nTemplateColor seeding complete!');
  
  // Display all colors
  const allColors = await prisma.templateColor.findMany({
    orderBy: { chipColor: 'asc' },
  });
  
  console.log('\nAll template colors:');
  console.table(allColors.map(({ chipColor, color1, color2, color3, color4, color5 }) => ({
    chipColor,
    color1,
    color2,
    color3,
    color4: color4 || '-',
    color5: color5 || '-',
  })));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
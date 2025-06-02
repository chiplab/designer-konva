#!/usr/bin/env node

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key.trim()] = value.trim();
    }
  });
}

// S3 Configuration
const s3Client = new S3Client({
  region: 'us-west-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Import font list from constants
const FONT_LIST = [
  // Sans Serif
  { id: 'arial', family: 'Arial', displayName: 'Arial', isSystem: true },
  { id: 'roboto', family: 'Roboto', displayName: 'Roboto' },
  { id: 'open-sans', family: 'Open Sans', displayName: 'Open Sans' },
  { id: 'lato', family: 'Lato', displayName: 'Lato' },
  { id: 'montserrat', family: 'Montserrat', displayName: 'Montserrat' },
  { id: 'raleway', family: 'Raleway', displayName: 'Raleway' },
  { id: 'poppins', family: 'Poppins', displayName: 'Poppins' },
  { id: 'archivo', family: 'Archivo', displayName: 'Archivo' },
  { id: 'archivo-narrow', family: 'Archivo Narrow', displayName: 'Archivo Narrow' },
  { id: 'barlow-semi-condensed', family: 'Barlow Semi Condensed', displayName: 'Barlow Semi Condensed' },
  { id: 'alumni-sans', family: 'Alumni Sans', displayName: 'Alumni Sans' },
  { id: 'arimo', family: 'Arimo', displayName: 'Arimo' },
  // Serif
  { id: 'times-new-roman', family: 'Times New Roman', displayName: 'Times New Roman', isSystem: true },
  { id: 'georgia', family: 'Georgia', displayName: 'Georgia', isSystem: true },
  { id: 'playfair-display', family: 'Playfair Display', displayName: 'Playfair Display' },
  { id: 'merriweather', family: 'Merriweather', displayName: 'Merriweather' },
  { id: 'lora', family: 'Lora', displayName: 'Lora' },
  { id: 'abril-fatface', family: 'Abril Fatface', displayName: 'Abril Fatface' },
  { id: 'antic-slab', family: 'Antic Slab', displayName: 'Antic Slab' },
  { id: 'bellota', family: 'Bellota', displayName: 'Bellota' },
  // Display
  { id: 'bebas-neue', family: 'Bebas Neue', displayName: 'Bebas Neue' },
  { id: 'oswald', family: 'Oswald', displayName: 'Oswald' },
  { id: 'anton', family: 'Anton', displayName: 'Anton' },
  { id: 'righteous', family: 'Righteous', displayName: 'Righteous' },
  { id: 'bowlby-one', family: 'Bowlby One', displayName: 'Bowlby One' },
  { id: 'boogaloo', family: 'Boogaloo', displayName: 'Boogaloo' },
  { id: 'fredoka-one', family: 'Fredoka One', displayName: 'Fredoka One' },
  { id: 'pacifico', family: 'Pacifico', displayName: 'Pacifico' },
  { id: 'lobster', family: 'Lobster', displayName: 'Lobster' },
  { id: 'amaranth', family: 'Amaranth', displayName: 'Amaranth' },
  { id: 'bevan', family: 'Bevan', displayName: 'Bevan' },
  // Script
  { id: 'alex-brush', family: 'Alex Brush', displayName: 'Alex Brush' },
  { id: 'allison', family: 'Allison', displayName: 'Allison' },
  { id: 'dancing-script', family: 'Dancing Script', displayName: 'Dancing Script' },
  { id: 'great-vibes', family: 'Great Vibes', displayName: 'Great Vibes' },
  { id: 'parisienne', family: 'Parisienne', displayName: 'Parisienne' },
  { id: 'sacramento', family: 'Sacramento', displayName: 'Sacramento' },
  { id: 'caveat', family: 'Caveat', displayName: 'Caveat' },
  { id: 'kalam', family: 'Kalam', displayName: 'Kalam' },
  { id: 'satisfy', family: 'Satisfy', displayName: 'Satisfy' },
  { id: 'amatic-sc', family: 'Amatic SC', displayName: 'Amatic SC' },
  // Monospace
  { id: 'courier-new', family: 'Courier New', displayName: 'Courier New', isSystem: true },
  { id: 'roboto-mono', family: 'Roboto Mono', displayName: 'Roboto Mono' },
  { id: 'source-code-pro', family: 'Source Code Pro', displayName: 'Source Code Pro' },
  { id: 'ibm-plex-mono', family: 'IBM Plex Mono', displayName: 'IBM Plex Mono' },
  { id: 'jetbrains-mono', family: 'JetBrains Mono', displayName: 'JetBrains Mono' }
];

async function generatePreviewsWithBrowser() {
  console.log('Launching browser to generate font previews...\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 300, height: 60 });
  
  const results = {
    success: [],
    failed: []
  };
  
  for (const fontDef of FONT_LIST) {
    try {
      console.log(`Generating preview for ${fontDef.displayName}...`);
      
      // Create HTML with the font
      const fontFaceRule = !fontDef.isSystem ? `
        @font-face {
          font-family: '${fontDef.family}';
          src: url('https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/${fontDef.id}/${fontDef.id}-regular.woff2') format('woff2');
          font-weight: normal;
          font-style: normal;
          font-display: block;
        }
      ` : '';
      
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            ${fontFaceRule}
            body {
              margin: 0;
              padding: 0;
              width: 300px;
              height: 60px;
              display: flex;
              align-items: center;
              justify-content: center;
              background: white;
              font-family: '${fontDef.family}', sans-serif;
              font-size: 24px;
              color: black;
            }
          </style>
        </head>
        <body>
          ${fontDef.displayName}
        </body>
        </html>
      `;
      
      await page.setContent(html);
      
      // Wait for font to load (if not system font)
      if (!fontDef.isSystem) {
        await page.evaluateHandle(() => document.fonts.ready);
        // Additional wait to ensure font is rendered
        await page.waitForTimeout(500);
      }
      
      // Take screenshot
      const screenshot = await page.screenshot({ 
        type: 'png',
        fullPage: true 
      });
      
      // Upload to S3
      const key = `fonts/${fontDef.id}/preview.png`;
      const command = new PutObjectCommand({
        Bucket: 'shopify-designs',
        Key: key,
        Body: screenshot,
        ContentType: 'image/png',
        CacheControl: 'public, max-age=31536000',
      });
      
      await s3Client.send(command);
      console.log(`✓ Uploaded preview for ${fontDef.displayName}`);
      results.success.push(fontDef.displayName);
      
    } catch (error) {
      console.error(`✗ Failed to generate preview for ${fontDef.displayName}:`, error.message);
      results.failed.push(fontDef.displayName);
    }
  }
  
  await browser.close();
  
  // Summary
  console.log('\n=== Preview Generation Complete ===');
  console.log(`✓ Success: ${results.success.length} previews`);
  console.log(`✗ Failed: ${results.failed.length} previews`);
  
  if (results.failed.length > 0) {
    console.log('\nFailed fonts:', results.failed.join(', '));
  }
}

generatePreviewsWithBrowser().catch(console.error);
#!/usr/bin/env node

import { createCanvas } from 'canvas';
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

// We'll define fonts with their visual characteristics
const FONT_LIST = [
  // Display - Bold, impactful
  { id: 'bebas-neue', family: 'Bebas Neue', displayName: 'BEBAS NEUE', style: 'display', weight: 'bold', uppercase: true },
  { id: 'oswald', family: 'Oswald', displayName: 'Oswald', style: 'display', weight: 'normal' },
  { id: 'anton', family: 'Anton', displayName: 'ANTON', style: 'display', weight: 'bold', uppercase: true },
  // Add more fonts as needed for testing
];

function getStyleForFont(fontDef) {
  let fontFamily = 'Arial, sans-serif';
  let fontSize = 24;
  let fontWeight = 'normal';
  let fontStyle = 'normal';
  let letterSpacing = 0;
  
  switch (fontDef.style) {
    case 'serif':
      fontFamily = 'Georgia, serif';
      break;
    case 'script':
      fontFamily = 'cursive';
      fontStyle = 'italic';
      fontSize = 26;
      break;
    case 'display':
      fontFamily = 'Arial Black, sans-serif';
      fontWeight = '900';  // Even bolder
      fontSize = 28;       // Bigger
      letterSpacing = 2;   // More spacing
      break;
    case 'mono':
      fontFamily = 'monospace';
      fontSize = 20;
      break;
    case 'condensed':
      fontFamily = 'Arial Narrow, sans-serif';
      letterSpacing = -0.5;
      break;
  }
  
  if (fontDef.weight === 'bold') {
    fontWeight = '900';  // Extra bold
  } else if (fontDef.weight === 'lighter') {
    fontWeight = '300';
  }
  
  return { fontFamily, fontSize, fontWeight, fontStyle, letterSpacing };
}

async function generateFontPreview(fontDef) {
  console.log(`Generating preview for ${fontDef.displayName}...`);
  
  try {
    // Create canvas
    const width = 300;
    const height = 60;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    // Get style for this font
    const style = getStyleForFont(fontDef);
    
    // Set up text style
    ctx.fillStyle = '#000000';
    ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Apply letter spacing manually since canvas doesn't support it directly
    const text = fontDef.uppercase ? fontDef.displayName.toUpperCase() : fontDef.displayName;
    
    if (style.letterSpacing > 0) {
      // Draw each letter separately with spacing
      const letters = text.split('');
      const metrics = ctx.measureText(text);
      let totalWidth = metrics.width + (letters.length - 1) * style.letterSpacing;
      let x = (width - totalWidth) / 2;
      
      letters.forEach((letter, i) => {
        ctx.fillText(letter, x + ctx.measureText(letter).width / 2, height / 2);
        x += ctx.measureText(letter).width + style.letterSpacing;
      });
    } else {
      ctx.fillText(text, width / 2, height / 2);
    }
    
    // Add a timestamp to force cache refresh
    const timestamp = Date.now();
    
    // Convert to buffer
    const buffer = canvas.toBuffer('image/png');
    
    // Upload to S3 with new filename
    const key = `fonts/${fontDef.id}/preview-v2.png`;
    const command = new PutObjectCommand({
      Bucket: 'shopify-designs',
      Key: key,
      Body: buffer,
      ContentType: 'image/png',
      CacheControl: 'no-cache, no-store, must-revalidate',  // Prevent caching
      Metadata: {
        'generated': timestamp.toString()
      }
    });
    
    await s3Client.send(command);
    console.log(`✓ Uploaded preview for ${fontDef.displayName} with timestamp ${timestamp}`);
    
    return `https://shopify-designs.s3.us-west-1.amazonaws.com/${key}?t=${timestamp}`;
  } catch (error) {
    console.error(`✗ Failed to generate preview for ${fontDef.displayName}:`, error.message);
    return null;
  }
}

async function generateAllPreviews() {
  console.log('Generating styled font preview images V2...\n');
  
  const results = {
    success: [],
    failed: []
  };
  
  // Process each font
  for (const fontDef of FONT_LIST) {
    const previewUrl = await generateFontPreview(fontDef);
    if (previewUrl) {
      results.success.push(fontDef.displayName);
      console.log(`Preview URL: ${previewUrl}`);
    } else {
      results.failed.push(fontDef.displayName);
    }
  }
  
  // Summary
  console.log('\n=== Preview Generation Complete ===');
  console.log(`✓ Success: ${results.success.length} previews`);
  console.log(`✗ Failed: ${results.failed.length} previews`);
  
  if (results.failed.length > 0) {
    console.log('\nFailed fonts:', results.failed.join(', '));
  }
  
  console.log('\nNOTE: Update your font constants to use preview-v2.png instead of preview.png');
}

generateAllPreviews().catch(console.error);
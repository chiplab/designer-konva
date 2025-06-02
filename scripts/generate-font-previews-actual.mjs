#!/usr/bin/env node

import { createCanvas, registerFont } from 'canvas';
import fs from 'fs';
import path from 'path';
import https from 'https';
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

// We'll define fonts inline since importing TS from MJS is complex
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

// Create temp directory for fonts
const tempDir = path.join(__dirname, '../temp-fonts');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

async function downloadFontFromS3(fontId) {
  const s3Url = `https://shopify-designs.s3.us-west-1.amazonaws.com/fonts/${fontId}/${fontId}-regular.woff2`;
  return new Promise((resolve, reject) => {
    const filePath = path.join(tempDir, `${fontId}.woff2`);
    
    // Check if already downloaded
    if (fs.existsSync(filePath)) {
      resolve(filePath);
      return;
    }
    
    const file = fs.createWriteStream(filePath);
    https.get(s3Url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(filePath);
      });
    }).on('error', (err) => {
      fs.unlink(filePath, () => {});
      reject(err);
    });
  });
}

// Convert WOFF2 to TTF using a different approach
async function convertWoff2ToTtf(woff2Path) {
  // For now, we'll use the WOFF2 file directly with canvas
  // node-canvas should support WOFF2 files
  return woff2Path;
}

async function generateFontPreview(fontDef) {
  console.log(`Generating preview for ${fontDef.displayName}...`);
  
  try {
    const width = 300;
    const height = 60;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    // Try to use the actual font
    let fontRegistered = false;
    
    if (!fontDef.isSystem) {
      try {
        // Download font from S3
        const fontPath = await downloadFontFromS3(fontDef.id);
        
        // Try to register the font
        // Note: node-canvas might have issues with WOFF2, but let's try
        registerFont(fontPath, { 
          family: fontDef.family,
          weight: 'normal'
        });
        fontRegistered = true;
      } catch (error) {
        console.warn(`Could not register font ${fontDef.family}:`, error.message);
      }
    }
    
    // Draw font name in the font (or fallback)
    ctx.fillStyle = '#000000';
    ctx.font = fontRegistered || fontDef.isSystem ? `24px "${fontDef.family}"` : '24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fontDef.displayName, width / 2, height / 2);
    
    // Convert to buffer
    const buffer = canvas.toBuffer('image/png');
    
    // Upload to S3
    const key = `fonts/${fontDef.id}/preview.png`;
    const command = new PutObjectCommand({
      Bucket: 'shopify-designs',
      Key: key,
      Body: buffer,
      ContentType: 'image/png',
      CacheControl: 'public, max-age=31536000',
    });
    
    await s3Client.send(command);
    console.log(`✓ Uploaded preview for ${fontDef.displayName}`);
    
    return `https://shopify-designs.s3.us-west-1.amazonaws.com/${key}`;
  } catch (error) {
    console.error(`✗ Failed to generate preview for ${fontDef.displayName}:`, error.message);
    return null;
  }
}

async function generateAllPreviews() {
  console.log('Generating font preview images with actual fonts...\n');
  
  const results = {
    success: [],
    failed: []
  };
  
  // Process each font
  for (const fontDef of FONT_LIST) {
    const previewUrl = await generateFontPreview(fontDef);
    if (previewUrl) {
      results.success.push(fontDef.displayName);
    } else {
      results.failed.push(fontDef.displayName);
    }
  }
  
  // Clean up temp directory
  fs.rmSync(tempDir, { recursive: true, force: true });
  
  // Summary
  console.log('\n=== Preview Generation Complete ===');
  console.log(`✓ Success: ${results.success.length} previews`);
  console.log(`✗ Failed: ${results.failed.length} previews`);
  
  if (results.failed.length > 0) {
    console.log('\nFailed fonts:', results.failed.join(', '));
  }
}

generateAllPreviews().catch(console.error);
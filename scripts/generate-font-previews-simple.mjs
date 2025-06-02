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

// We'll define fonts inline since importing TS from MJS is complex
const FONT_LIST = [
  // Sans Serif
  { id: 'arial', family: 'Arial', displayName: 'Arial', category: 'sans-serif' },
  { id: 'roboto', family: 'Roboto', displayName: 'Roboto', category: 'sans-serif' },
  { id: 'open-sans', family: 'Open Sans', displayName: 'Open Sans', category: 'sans-serif' },
  { id: 'lato', family: 'Lato', displayName: 'Lato', category: 'sans-serif' },
  { id: 'montserrat', family: 'Montserrat', displayName: 'Montserrat', category: 'sans-serif' },
  { id: 'raleway', family: 'Raleway', displayName: 'Raleway', category: 'sans-serif' },
  { id: 'poppins', family: 'Poppins', displayName: 'Poppins', category: 'sans-serif' },
  { id: 'archivo', family: 'Archivo', displayName: 'Archivo', category: 'sans-serif' },
  { id: 'archivo-narrow', family: 'Archivo Narrow', displayName: 'Archivo Narrow', category: 'sans-serif' },
  { id: 'barlow-semi-condensed', family: 'Barlow Semi Condensed', displayName: 'Barlow Semi Condensed', category: 'sans-serif' },
  { id: 'alumni-sans', family: 'Alumni Sans', displayName: 'Alumni Sans', category: 'sans-serif' },
  { id: 'arimo', family: 'Arimo', displayName: 'Arimo', category: 'sans-serif' },
  // Serif
  { id: 'times-new-roman', family: 'Times New Roman', displayName: 'Times New Roman', category: 'serif' },
  { id: 'georgia', family: 'Georgia', displayName: 'Georgia', category: 'serif' },
  { id: 'playfair-display', family: 'Playfair Display', displayName: 'Playfair Display', category: 'serif' },
  { id: 'merriweather', family: 'Merriweather', displayName: 'Merriweather', category: 'serif' },
  { id: 'lora', family: 'Lora', displayName: 'Lora', category: 'serif' },
  { id: 'abril-fatface', family: 'Abril Fatface', displayName: 'Abril Fatface', category: 'serif' },
  { id: 'antic-slab', family: 'Antic Slab', displayName: 'Antic Slab', category: 'serif' },
  { id: 'bellota', family: 'Bellota', displayName: 'Bellota', category: 'serif' },
  // Display
  { id: 'bebas-neue', family: 'Bebas Neue', displayName: 'Bebas Neue', category: 'display' },
  { id: 'oswald', family: 'Oswald', displayName: 'Oswald', category: 'display' },
  { id: 'anton', family: 'Anton', displayName: 'Anton', category: 'display' },
  { id: 'righteous', family: 'Righteous', displayName: 'Righteous', category: 'display' },
  { id: 'bowlby-one', family: 'Bowlby One', displayName: 'Bowlby One', category: 'display' },
  { id: 'boogaloo', family: 'Boogaloo', displayName: 'Boogaloo', category: 'display' },
  { id: 'fredoka-one', family: 'Fredoka One', displayName: 'Fredoka One', category: 'display' },
  { id: 'pacifico', family: 'Pacifico', displayName: 'Pacifico', category: 'display' },
  { id: 'lobster', family: 'Lobster', displayName: 'Lobster', category: 'display' },
  { id: 'amaranth', family: 'Amaranth', displayName: 'Amaranth', category: 'display' },
  { id: 'bevan', family: 'Bevan', displayName: 'Bevan', category: 'display' },
  { id: 'blazma', family: 'Blazma', displayName: 'Blazma', category: 'display' },
  // Script
  { id: 'alex-brush', family: 'Alex Brush', displayName: 'Alex Brush', category: 'script' },
  { id: 'allison', family: 'Allison', displayName: 'Allison', category: 'script' },
  { id: 'dancing-script', family: 'Dancing Script', displayName: 'Dancing Script', category: 'script' },
  { id: 'great-vibes', family: 'Great Vibes', displayName: 'Great Vibes', category: 'script' },
  { id: 'parisienne', family: 'Parisienne', displayName: 'Parisienne', category: 'script' },
  { id: 'sacramento', family: 'Sacramento', displayName: 'Sacramento', category: 'script' },
  { id: 'caveat', family: 'Caveat', displayName: 'Caveat', category: 'script' },
  { id: 'kalam', family: 'Kalam', displayName: 'Kalam', category: 'script' },
  { id: 'satisfy', family: 'Satisfy', displayName: 'Satisfy', category: 'script' },
  { id: 'amatic-sc', family: 'Amatic SC', displayName: 'Amatic SC', category: 'script' },
  // Monospace
  { id: 'courier-new', family: 'Courier New', displayName: 'Courier New', category: 'monospace' },
  { id: 'roboto-mono', family: 'Roboto Mono', displayName: 'Roboto Mono', category: 'monospace' },
  { id: 'source-code-pro', family: 'Source Code Pro', displayName: 'Source Code Pro', category: 'monospace' },
  { id: 'ibm-plex-mono', family: 'IBM Plex Mono', displayName: 'IBM Plex Mono', category: 'monospace' },
  { id: 'jetbrains-mono', family: 'JetBrains Mono', displayName: 'JetBrains Mono', category: 'monospace' }
];

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
    
    // Draw font name using a fallback font based on category
    ctx.fillStyle = '#000000';
    
    // Use appropriate system font based on category
    let fallbackFont = 'Arial, sans-serif';
    switch (fontDef.category) {
      case 'serif':
        fallbackFont = 'Georgia, serif';
        break;
      case 'script':
        fallbackFont = 'cursive';
        break;
      case 'monospace':
        fallbackFont = 'monospace';
        break;
      case 'display':
        fallbackFont = 'Arial, sans-serif';
        break;
    }
    
    ctx.font = `24px ${fallbackFont}`;
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
  console.log('Generating font preview images...\n');
  
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
  
  // Summary
  console.log('\n=== Preview Generation Complete ===');
  console.log(`✓ Success: ${results.success.length} previews`);
  console.log(`✗ Failed: ${results.failed.length} previews`);
  
  if (results.failed.length > 0) {
    console.log('\nFailed fonts:', results.failed.join(', '));
  }
}

generateAllPreviews().catch(console.error);
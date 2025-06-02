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
  // Sans Serif - Clean, modern look
  { id: 'arial', family: 'Arial', displayName: 'Arial', style: 'normal', weight: 'normal' },
  { id: 'roboto', family: 'Roboto', displayName: 'Roboto', style: 'normal', weight: 'normal' },
  { id: 'open-sans', family: 'Open Sans', displayName: 'Open Sans', style: 'normal', weight: 'normal' },
  { id: 'lato', family: 'Lato', displayName: 'Lato', style: 'normal', weight: 'lighter' },
  { id: 'montserrat', family: 'Montserrat', displayName: 'Montserrat', style: 'normal', weight: 'normal' },
  { id: 'raleway', family: 'Raleway', displayName: 'Raleway', style: 'normal', weight: 'lighter' },
  { id: 'poppins', family: 'Poppins', displayName: 'Poppins', style: 'normal', weight: 'normal' },
  { id: 'archivo', family: 'Archivo', displayName: 'Archivo', style: 'normal', weight: 'normal' },
  { id: 'archivo-narrow', family: 'Archivo Narrow', displayName: 'Archivo Narrow', style: 'condensed', weight: 'normal' },
  { id: 'barlow-semi-condensed', family: 'Barlow Semi Condensed', displayName: 'Barlow Semi Condensed', style: 'condensed', weight: 'normal' },
  { id: 'alumni-sans', family: 'Alumni Sans', displayName: 'Alumni Sans', style: 'normal', weight: 'normal' },
  { id: 'arimo', family: 'Arimo', displayName: 'Arimo', style: 'normal', weight: 'normal' },
  
  // Serif - Traditional, elegant
  { id: 'times-new-roman', family: 'Times New Roman', displayName: 'Times New Roman', style: 'serif', weight: 'normal' },
  { id: 'georgia', family: 'Georgia', displayName: 'Georgia', style: 'serif', weight: 'normal' },
  { id: 'playfair-display', family: 'Playfair Display', displayName: 'Playfair Display', style: 'serif', weight: 'normal' },
  { id: 'merriweather', family: 'Merriweather', displayName: 'Merriweather', style: 'serif', weight: 'normal' },
  { id: 'lora', family: 'Lora', displayName: 'Lora', style: 'serif', weight: 'normal' },
  { id: 'abril-fatface', family: 'Abril Fatface', displayName: 'Abril Fatface', style: 'serif', weight: 'bold' },
  { id: 'antic-slab', family: 'Antic Slab', displayName: 'Antic Slab', style: 'serif', weight: 'normal' },
  { id: 'bellota', family: 'Bellota', displayName: 'Bellota', style: 'serif', weight: 'normal' },
  
  // Display - Bold, impactful
  { id: 'bebas-neue', family: 'Bebas Neue', displayName: 'BEBAS NEUE', style: 'display', weight: 'bold', uppercase: true },
  { id: 'oswald', family: 'Oswald', displayName: 'Oswald', style: 'display', weight: 'normal' },
  { id: 'anton', family: 'Anton', displayName: 'ANTON', style: 'display', weight: 'bold', uppercase: true },
  { id: 'righteous', family: 'Righteous', displayName: 'Righteous', style: 'display', weight: 'normal' },
  { id: 'bowlby-one', family: 'Bowlby One', displayName: 'Bowlby One', style: 'display', weight: 'bold' },
  { id: 'boogaloo', family: 'Boogaloo', displayName: 'Boogaloo', style: 'display', weight: 'bold' },
  { id: 'fredoka-one', family: 'Fredoka One', displayName: 'Fredoka One', style: 'display', weight: 'bold' },
  { id: 'pacifico', family: 'Pacifico', displayName: 'Pacifico', style: 'script', weight: 'normal' },
  { id: 'lobster', family: 'Lobster', displayName: 'Lobster', style: 'script', weight: 'bold' },
  { id: 'amaranth', family: 'Amaranth', displayName: 'Amaranth', style: 'display', weight: 'normal' },
  { id: 'bevan', family: 'Bevan', displayName: 'Bevan', style: 'display', weight: 'bold' },
  
  // Script - Handwritten, decorative
  { id: 'alex-brush', family: 'Alex Brush', displayName: 'Alex Brush', style: 'script', weight: 'normal' },
  { id: 'allison', family: 'Allison', displayName: 'Allison', style: 'script', weight: 'normal' },
  { id: 'dancing-script', family: 'Dancing Script', displayName: 'Dancing Script', style: 'script', weight: 'normal' },
  { id: 'great-vibes', family: 'Great Vibes', displayName: 'Great Vibes', style: 'script', weight: 'normal' },
  { id: 'parisienne', family: 'Parisienne', displayName: 'Parisienne', style: 'script', weight: 'normal' },
  { id: 'sacramento', family: 'Sacramento', displayName: 'Sacramento', style: 'script', weight: 'normal' },
  { id: 'caveat', family: 'Caveat', displayName: 'Caveat', style: 'script', weight: 'normal' },
  { id: 'kalam', family: 'Kalam', displayName: 'Kalam', style: 'script', weight: 'normal' },
  { id: 'satisfy', family: 'Satisfy', displayName: 'Satisfy', style: 'script', weight: 'normal' },
  { id: 'amatic-sc', family: 'Amatic SC', displayName: 'Amatic SC', style: 'script', weight: 'normal' },
  
  // Monospace - Technical, code-like
  { id: 'courier-new', family: 'Courier New', displayName: 'Courier New', style: 'mono', weight: 'normal' },
  { id: 'roboto-mono', family: 'Roboto Mono', displayName: 'Roboto Mono', style: 'mono', weight: 'normal' },
  { id: 'source-code-pro', family: 'Source Code Pro', displayName: 'Source Code Pro', style: 'mono', weight: 'normal' },
  { id: 'ibm-plex-mono', family: 'IBM Plex Mono', displayName: 'IBM Plex Mono', style: 'mono', weight: 'normal' },
  { id: 'jetbrains-mono', family: 'JetBrains Mono', displayName: 'JetBrains Mono', style: 'mono', weight: 'normal' }
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
      fontWeight = 'bold';
      fontSize = 22;
      letterSpacing = 1;
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
    fontWeight = 'bold';
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
    
    // Apply letter spacing if needed
    if (style.letterSpacing) {
      ctx.letterSpacing = `${style.letterSpacing}px`;
    }
    
    // Draw text
    const text = fontDef.uppercase ? fontDef.displayName.toUpperCase() : fontDef.displayName;
    ctx.fillText(text, width / 2, height / 2);
    
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
  console.log('Generating styled font preview images...\n');
  
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
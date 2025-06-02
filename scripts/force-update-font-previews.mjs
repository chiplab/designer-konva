#!/usr/bin/env node

import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
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

// Define font styles with more extreme visual differences
const FONT_LIST = [
  // Sans Serif - Clean, modern look
  { id: 'arial', displayName: 'Arial', style: { fontSize: 50, fontWeight: 'normal', fontFamily: 'Arial, sans-serif' }},
  { id: 'roboto', displayName: 'Roboto', style: { fontSize: 50, fontWeight: 'normal', fontFamily: 'Arial, sans-serif' }},
  { id: 'open-sans', displayName: 'Open Sans', style: { fontSize: 50, fontWeight: '300', fontFamily: 'Arial, sans-serif' }},
  { id: 'lato', displayName: 'Lato', style: { fontSize: 50, fontWeight: '300', fontFamily: 'Arial, sans-serif' }},
  { id: 'montserrat', displayName: 'Montserrat', style: { fontSize: 50, fontWeight: '500', fontFamily: 'Arial, sans-serif' }},
  { id: 'raleway', displayName: 'Raleway', style: { fontSize: 50, fontWeight: '200', fontFamily: 'Arial, sans-serif' }},
  { id: 'poppins', displayName: 'Poppins', style: { fontSize: 50, fontWeight: '500', fontFamily: 'Arial, sans-serif' }},
  { id: 'archivo', displayName: 'Archivo', style: { fontSize: 50, fontWeight: 'normal', fontFamily: 'Arial, sans-serif' }},
  { id: 'archivo-narrow', displayName: 'Archivo Narrow', style: { fontSize: 50, fontWeight: 'normal', fontFamily: 'Arial Narrow, sans-serif', transform: 'scaleX(0.85)' }},
  { id: 'barlow-semi-condensed', displayName: 'Barlow Semi Condensed', style: { fontSize: 50, fontWeight: 'normal', fontFamily: 'Arial, sans-serif', transform: 'scaleX(0.9)' }},
  { id: 'alumni-sans', displayName: 'Alumni Sans', style: { fontSize: 50, fontWeight: 'normal', fontFamily: 'Arial, sans-serif' }},
  { id: 'arimo', displayName: 'Arimo', style: { fontSize: 50, fontWeight: 'normal', fontFamily: 'Arial, sans-serif' }},
  
  // Serif - Traditional, elegant
  { id: 'times-new-roman', displayName: 'Times New Roman', style: { fontSize: 50, fontWeight: 'normal', fontFamily: 'Times New Roman, serif' }},
  { id: 'georgia', displayName: 'Georgia', style: { fontSize: 50, fontWeight: 'normal', fontFamily: 'Georgia, serif' }},
  { id: 'playfair-display', displayName: 'Playfair Display', style: { fontSize: 48, fontWeight: 'bold', fontFamily: 'Georgia, serif' }},
  { id: 'merriweather', displayName: 'Merriweather', style: { fontSize: 45, fontWeight: 'normal', fontFamily: 'Georgia, serif' }},
  { id: 'lora', displayName: 'Lora', style: { fontSize: 50, fontWeight: 'normal', fontFamily: 'Georgia, serif' }},
  { id: 'abril-fatface', displayName: 'Abril Fatface', style: { fontSize: 50, fontWeight: '900', fontFamily: 'Georgia, serif' }},
  { id: 'antic-slab', displayName: 'Antic Slab', style: { fontSize: 50, fontWeight: 'normal', fontFamily: 'Georgia, serif' }},
  { id: 'bellota', displayName: 'Bellota', style: { fontSize: 50, fontWeight: 'normal', fontFamily: 'Georgia, serif' }},
  
  // Display - Bold, impactful (THIS IS THE KEY PART)
  { id: 'bebas-neue', displayName: 'BEBAS NEUE', style: { fontSize: 50, fontWeight: '900', fontFamily: 'Impact, sans-serif', letterSpacing: 3, color: '#000' }},
  { id: 'oswald', displayName: 'OSWALD', style: { fontSize: 48, fontWeight: '700', fontFamily: 'Arial Black, sans-serif', letterSpacing: 1 }},
  { id: 'anton', displayName: 'ANTON', style: { fontSize: 50, fontWeight: '900', fontFamily: 'Impact, sans-serif', letterSpacing: 2 }},
  { id: 'righteous', displayName: 'Righteous', style: { fontSize: 48, fontWeight: 'bold', fontFamily: 'Arial Black, sans-serif' }},
  { id: 'bowlby-one', displayName: 'Bowlby One', style: { fontSize: 45, fontWeight: '900', fontFamily: 'Arial Black, sans-serif' }},
  { id: 'boogaloo', displayName: 'Boogaloo', style: { fontSize: 50, fontWeight: 'bold', fontFamily: 'Arial Rounded MT Bold, sans-serif' }},
  { id: 'fredoka-one', displayName: 'Fredoka One', style: { fontSize: 48, fontWeight: 'bold', fontFamily: 'Arial Rounded MT Bold, sans-serif' }},
  { id: 'pacifico', displayName: 'Pacifico', style: { fontSize: 50, fontWeight: 'normal', fontFamily: 'Brush Script MT, cursive', fontStyle: 'italic' }},
  { id: 'lobster', displayName: 'Lobster', style: { fontSize: 50, fontWeight: 'bold', fontFamily: 'Brush Script MT, cursive' }},
  { id: 'amaranth', displayName: 'Amaranth', style: { fontSize: 48, fontWeight: 'bold', fontFamily: 'Arial, sans-serif' }},
  { id: 'bevan', displayName: 'BEVAN', style: { fontSize: 50, fontWeight: '900', fontFamily: 'Impact, sans-serif' }},
  
  // Script - Handwritten, decorative
  { id: 'alex-brush', displayName: 'Alex Brush', style: { fontSize: 50, fontWeight: 'normal', fontFamily: 'Brush Script MT, cursive', fontStyle: 'italic' }},
  { id: 'allison', displayName: 'Allison', style: { fontSize: 50, fontWeight: 'normal', fontFamily: 'Brush Script MT, cursive', fontStyle: 'italic' }},
  { id: 'dancing-script', displayName: 'Dancing Script', style: { fontSize: 42, fontWeight: 'normal', fontFamily: 'Georgia, serif', fontStyle: 'italic', transform: 'rotate(-5deg)' }},
  { id: 'great-vibes', displayName: 'Great Vibes', style: { fontSize: 50, fontWeight: 'normal', fontFamily: 'Brush Script MT, cursive', fontStyle: 'italic' }},
  { id: 'parisienne', displayName: 'Parisienne', style: { fontSize: 44, fontWeight: 'normal', fontFamily: 'Georgia, serif', fontStyle: 'italic', transform: 'rotate(-3deg)' }},
  { id: 'sacramento', displayName: 'Sacramento', style: { fontSize: 44, fontWeight: 'normal', fontFamily: 'Georgia, serif', fontStyle: 'italic', letterSpacing: -1 }},
  { id: 'caveat', displayName: 'Caveat', style: { fontSize: 46, fontWeight: 'normal', fontFamily: 'Arial, sans-serif', transform: 'rotate(-2deg)' }},
  { id: 'kalam', displayName: 'Kalam', style: { fontSize: 46, fontWeight: 'normal', fontFamily: 'Arial, sans-serif', transform: 'rotate(2deg)' }},
  { id: 'satisfy', displayName: 'Satisfy', style: { fontSize: 44, fontWeight: 'normal', fontFamily: 'Georgia, serif', fontStyle: 'italic', transform: 'rotate(-4deg)' }},
  { id: 'amatic-sc', displayName: 'Amatic SC', style: { fontSize: 50, fontWeight: '300', fontFamily: 'Arial Narrow, sans-serif', letterSpacing: 1 }},
  
  // Monospace - Technical, code-like
  { id: 'courier-new', displayName: 'Courier New', style: { fontSize: 42, fontWeight: 'normal', fontFamily: 'Courier New, monospace' }},
  { id: 'roboto-mono', displayName: 'Roboto Mono', style: { fontSize: 42, fontWeight: 'normal', fontFamily: 'monospace' }},
  { id: 'source-code-pro', displayName: 'Source Code Pro', style: { fontSize: 42, fontWeight: 'normal', fontFamily: 'monospace' }},
  { id: 'ibm-plex-mono', displayName: 'IBM Plex Mono', style: { fontSize: 42, fontWeight: 'normal', fontFamily: 'monospace' }},
  { id: 'jetbrains-mono', displayName: 'JetBrains Mono', style: { fontSize: 42, fontWeight: 'normal', fontFamily: 'monospace' }}
];

async function deleteOldPreview(fontId) {
  try {
    const deleteCommand = new DeleteObjectCommand({
      Bucket: 'shopify-designs',
      Key: `fonts/${fontId}/preview.png`
    });
    await s3Client.send(deleteCommand);
    console.log(`  Deleted old preview for ${fontId}`);
  } catch (error) {
    // Ignore if doesn't exist
  }
}

async function generateFontPreview(fontDef) {
  console.log(`Generating preview for ${fontDef.displayName}...`);
  
  try {
    // Delete old preview first
    await deleteOldPreview(fontDef.id);
    
    // Create canvas
    const width = 300;
    const height = 60;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    // Apply styles
    const style = fontDef.style;
    ctx.fillStyle = style.color || '#000000';
    ctx.font = `${style.fontStyle || 'normal'} ${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Apply transform if needed
    if (style.transform) {
      ctx.save();
      ctx.translate(width / 2, height / 2);
      
      if (style.transform.includes('rotate')) {
        const angle = parseFloat(style.transform.match(/rotate\(([-\d.]+)deg\)/)[1]);
        ctx.rotate(angle * Math.PI / 180);
      }
      
      if (style.transform.includes('scaleX')) {
        const scale = parseFloat(style.transform.match(/scaleX\(([\d.]+)\)/)[1]);
        ctx.scale(scale, 1);
      }
      
      ctx.translate(-width / 2, -height / 2);
    }
    
    // Handle letter spacing for display fonts
    if (style.letterSpacing && style.letterSpacing !== 0) {
      const letters = fontDef.displayName.split('');
      let totalWidth = 0;
      
      // Calculate total width with spacing
      letters.forEach((letter) => {
        totalWidth += ctx.measureText(letter).width;
      });
      totalWidth += (letters.length - 1) * style.letterSpacing;
      
      // Draw each letter
      let x = (width - totalWidth) / 2;
      letters.forEach((letter) => {
        const letterWidth = ctx.measureText(letter).width;
        ctx.fillText(letter, x + letterWidth / 2, height / 2);
        x += letterWidth + style.letterSpacing;
      });
    } else {
      ctx.fillText(fontDef.displayName, width / 2, height / 2);
    }
    
    if (style.transform) {
      ctx.restore();
    }
    
    // Convert to buffer
    const buffer = canvas.toBuffer('image/png');
    
    // Upload to S3 with cache-busting
    const key = `fonts/${fontDef.id}/preview.png`;
    const command = new PutObjectCommand({
      Bucket: 'shopify-designs',
      Key: key,
      Body: buffer,
      ContentType: 'image/png',
      CacheControl: 'no-cache, max-age=0',
    });
    
    await s3Client.send(command);
    console.log(`✓ Uploaded new preview for ${fontDef.displayName}`);
    
    return true;
  } catch (error) {
    console.error(`✗ Failed to generate preview for ${fontDef.displayName}:`, error.message);
    return false;
  }
}

async function generateAllPreviews() {
  console.log('Force updating all font preview images...\n');
  
  const results = {
    success: [],
    failed: []
  };
  
  // Process each font
  for (const fontDef of FONT_LIST) {
    const success = await generateFontPreview(fontDef);
    if (success) {
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
  
  console.log('\nIMPORTANT: Clear your browser cache or add ?v=2 to preview URLs to see the new previews');
}

generateAllPreviews().catch(console.error);
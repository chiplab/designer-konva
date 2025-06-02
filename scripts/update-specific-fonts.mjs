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

// Only update the problematic fonts
const FONTS_TO_UPDATE = [
  { id: 'dancing-script', displayName: 'Dancing Script', style: { fontSize: 42, fontWeight: 'normal', fontFamily: 'Georgia, serif', fontStyle: 'italic', transform: 'rotate(-5deg)' }},
  { id: 'parisienne', displayName: 'Parisienne', style: { fontSize: 44, fontWeight: 'normal', fontFamily: 'Georgia, serif', fontStyle: 'italic', transform: 'rotate(-3deg)' }},
  { id: 'sacramento', displayName: 'Sacramento', style: { fontSize: 44, fontWeight: 'normal', fontFamily: 'Georgia, serif', fontStyle: 'italic', letterSpacing: -1 }},
  { id: 'caveat', displayName: 'Caveat', style: { fontSize: 46, fontWeight: 'normal', fontFamily: 'Arial, sans-serif', transform: 'rotate(-2deg)' }},
  { id: 'kalam', displayName: 'Kalam', style: { fontSize: 46, fontWeight: 'normal', fontFamily: 'Arial, sans-serif', transform: 'rotate(2deg)' }},
  { id: 'satisfy', displayName: 'Satisfy', style: { fontSize: 44, fontWeight: 'normal', fontFamily: 'Georgia, serif', fontStyle: 'italic', transform: 'rotate(-4deg)' }},
  { id: 'amatic-sc', displayName: 'Amatic SC', style: { fontSize: 50, fontWeight: '300', fontFamily: 'Arial Narrow, sans-serif', letterSpacing: 1 }},
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
    
    // Handle letter spacing
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
  console.log('Updating previews for problematic script fonts...\n');
  
  const results = {
    success: [],
    failed: []
  };
  
  // Process each font
  for (const fontDef of FONTS_TO_UPDATE) {
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
}

generateAllPreviews().catch(console.error);
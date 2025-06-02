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

// Only update the problematic script fonts
const FONTS_TO_UPDATE = [
  { id: 'dancing-script', displayName: 'Dancing Script', category: 'script' },
  { id: 'parisienne', displayName: 'Parisienne', category: 'script' },
  { id: 'sacramento', displayName: 'Sacramento', category: 'script' },
  { id: 'caveat', displayName: 'Caveat', category: 'handwritten' },
  { id: 'kalam', displayName: 'Kalam', category: 'handwritten' },
  { id: 'satisfy', displayName: 'Satisfy', category: 'script' },
  { id: 'amatic-sc', displayName: 'Amatic SC', category: 'handwritten' },
];

async function generateTextPreview(fontDef) {
  console.log(`Generating text preview for ${fontDef.displayName}...`);
  
  try {
    // Create canvas
    const width = 300;
    const height = 60;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    // For script fonts that don't render well, use a styled text approach
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    if (fontDef.category === 'script') {
      // Use serif font with italic for script fonts
      ctx.font = 'italic 46px Georgia, serif';
      ctx.fillText(fontDef.displayName, width / 2, height / 2);
      
      // Add a small decorative element to indicate script nature
      ctx.font = 'italic 12px Georgia, serif';
      ctx.fillStyle = '#666';
      ctx.fillText('script', width - 30, height - 10);
    } else if (fontDef.category === 'handwritten') {
      // Use a different approach for handwritten fonts
      ctx.font = '44px Arial, sans-serif';
      ctx.fillText(fontDef.displayName, width / 2, height / 2);
      
      // Add handwritten indicator
      ctx.font = '12px Arial, sans-serif';
      ctx.fillStyle = '#666';
      ctx.fillText('handwritten', width - 45, height - 10);
    }
    
    // Convert to buffer
    const buffer = canvas.toBuffer('image/png');
    
    // Delete old preview first
    try {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: 'shopify-designs',
        Key: `fonts/${fontDef.id}/preview.png`
      });
      await s3Client.send(deleteCommand);
      console.log(`  Deleted old preview for ${fontDef.id}`);
    } catch (error) {
      // Ignore if doesn't exist
    }
    
    // Upload to S3
    const key = `fonts/${fontDef.id}/preview.png`;
    const command = new PutObjectCommand({
      Bucket: 'shopify-designs',
      Key: key,
      Body: buffer,
      ContentType: 'image/png',
      CacheControl: 'no-cache, max-age=0',
    });
    
    await s3Client.send(command);
    console.log(`✓ Uploaded text preview for ${fontDef.displayName}`);
    
    return true;
  } catch (error) {
    console.error(`✗ Failed to generate preview for ${fontDef.displayName}:`, error.message);
    return false;
  }
}

async function generateAllPreviews() {
  console.log('Generating text-based previews for problematic script fonts...\n');
  
  const results = {
    success: [],
    failed: []
  };
  
  // Process each font
  for (const fontDef of FONTS_TO_UPDATE) {
    const success = await generateTextPreview(fontDef);
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
  
  console.log('\nNOTE: These are temporary text-based previews. For best results, consider using a tool that can render the actual fonts.');
}

generateAllPreviews().catch(console.error);
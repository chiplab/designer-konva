#!/usr/bin/env node

import { createCanvas, registerFont } from 'canvas';
import fs from 'fs';
import path from 'path';
import https from 'https';
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

// All fonts to process
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
  { id: 'bebas-neue', family: 'Bebas Neue', displayName: 'BEBAS NEUE', uppercase: true },
  { id: 'oswald', family: 'Oswald', displayName: 'OSWALD', uppercase: true },
  { id: 'anton', family: 'Anton', displayName: 'ANTON', uppercase: true },
  { id: 'righteous', family: 'Righteous', displayName: 'Righteous' },
  { id: 'bowlby-one', family: 'Bowlby One', displayName: 'Bowlby One' },
  { id: 'boogaloo', family: 'Boogaloo', displayName: 'Boogaloo' },
  { id: 'fredoka-one', family: 'Fredoka One', displayName: 'Fredoka One' },
  { id: 'pacifico', family: 'Pacifico', displayName: 'Pacifico' },
  { id: 'lobster', family: 'Lobster', displayName: 'Lobster' },
  { id: 'amaranth', family: 'Amaranth', displayName: 'Amaranth' },
  { id: 'bevan', family: 'Bevan', displayName: 'BEVAN', uppercase: true },
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

async function downloadFontTTF(fontFamily) {
  const fontUrl = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, '+')}:wght@400`;
  
  return new Promise((resolve, reject) => {
    https.get(fontUrl, (response) => {
      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });
      response.on('end', () => {
        // Extract TTF URL from the CSS
        const ttfMatch = data.match(/url\((https:\/\/fonts\.gstatic\.com[^)]+\.ttf)\)/);
        if (!ttfMatch) {
          reject(new Error('No TTF URL found in Google Fonts CSS'));
          return;
        }
        
        const ttfUrl = ttfMatch[1];
        const filename = `${fontFamily.replace(/ /g, '-').toLowerCase()}.ttf`;
        const filePath = path.join(tempDir, filename);
        
        // Download the TTF file
        const file = fs.createWriteStream(filePath);
        https.get(ttfUrl, (ttfResponse) => {
          ttfResponse.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve(filePath);
          });
        }).on('error', (err) => {
          fs.unlink(filePath, () => {});
          reject(err);
        });
      });
    }).on('error', reject);
  });
}

async function deleteOldPreview(fontId) {
  try {
    const deleteCommand = new DeleteObjectCommand({
      Bucket: 'shopify-designs',
      Key: `fonts/${fontId}/preview.png`
    });
    await s3Client.send(deleteCommand);
  } catch (error) {
    // Ignore if doesn't exist
  }
}

async function processFontPreview(fontDef) {
  console.log(`\nProcessing ${fontDef.displayName}...`);
  
  let fontPath = null;
  
  try {
    // Step 1: Download font (skip for system fonts)
    if (!fontDef.isSystem) {
      console.log(`  Downloading TTF for ${fontDef.family}...`);
      fontPath = await downloadFontTTF(fontDef.family);
      console.log(`  ✓ Downloaded to ${fontPath}`);
      
      // Step 2: Register font with canvas
      console.log(`  Registering font...`);
      registerFont(fontPath, { family: fontDef.family });
      console.log(`  ✓ Font registered`);
    }
    
    // Step 3: Generate preview
    console.log(`  Generating preview...`);
    const width = 300;
    const height = 60;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    // Draw text with the actual font
    ctx.fillStyle = '#000000';
    ctx.font = `50px "${fontDef.family}"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const text = fontDef.uppercase ? fontDef.displayName.toUpperCase() : fontDef.displayName;
    ctx.fillText(text, width / 2, height / 2);
    
    // Convert to buffer
    const buffer = canvas.toBuffer('image/png');
    console.log(`  ✓ Preview generated`);
    
    // Step 4: Delete old preview from S3
    console.log(`  Deleting old preview from S3...`);
    await deleteOldPreview(fontDef.id);
    
    // Step 5: Upload to S3
    console.log(`  Uploading to S3...`);
    const key = `fonts/${fontDef.id}/preview.png`;
    const command = new PutObjectCommand({
      Bucket: 'shopify-designs',
      Key: key,
      Body: buffer,
      ContentType: 'image/png',
      CacheControl: 'no-cache, max-age=0',
    });
    
    await s3Client.send(command);
    console.log(`  ✓ Uploaded to S3`);
    
    // Step 6: Clean up TTF file
    if (fontPath && fs.existsSync(fontPath)) {
      fs.unlinkSync(fontPath);
      console.log(`  ✓ Cleaned up TTF file`);
    }
    
    console.log(`✅ Successfully processed ${fontDef.displayName}`);
    return true;
    
  } catch (error) {
    console.error(`❌ Failed to process ${fontDef.displayName}:`, error.message);
    
    // Clean up on error
    if (fontPath && fs.existsSync(fontPath)) {
      fs.unlinkSync(fontPath);
    }
    
    return false;
  }
}

async function generateAllPreviews() {
  console.log('Generating font previews with actual TTF files...');
  console.log('This will process each font one by one.\n');
  
  const results = {
    success: [],
    failed: []
  };
  
  // Process each font sequentially
  for (const fontDef of FONT_LIST) {
    const success = await processFontPreview(fontDef);
    if (success) {
      results.success.push(fontDef.displayName);
    } else {
      results.failed.push(fontDef.displayName);
    }
    
    // Small delay between fonts to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Clean up temp directory
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  
  // Summary
  console.log('\n=== Preview Generation Complete ===');
  console.log(`✅ Success: ${results.success.length}/${FONT_LIST.length} previews`);
  console.log(`❌ Failed: ${results.failed.length}/${FONT_LIST.length} previews`);
  
  if (results.failed.length > 0) {
    console.log('\nFailed fonts:', results.failed.join(', '));
  }
  
  console.log('\nIMPORTANT: Update cache version in app/constants/fonts.ts if needed');
}

// Run the script
generateAllPreviews().catch(console.error);
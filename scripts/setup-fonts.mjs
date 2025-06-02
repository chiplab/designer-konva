#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import https from 'https';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables by reading .env file manually
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

const BUCKET_NAME = 'shopify-designs';
const FONTS_PREFIX = 'fonts';

// Google Fonts mapping
const GOOGLE_FONTS_MAP = {
  // Sans Serif
  'roboto': { weights: [400, 700], urlName: 'Roboto' },
  'open-sans': { weights: [400, 700], urlName: 'Open+Sans' },
  'lato': { weights: [400, 700], urlName: 'Lato' },
  'montserrat': { weights: [400, 700], urlName: 'Montserrat' },
  'raleway': { weights: [400], urlName: 'Raleway' },
  'poppins': { weights: [400, 700], urlName: 'Poppins' },
  'archivo': { weights: [400], urlName: 'Archivo' },
  'archivo-narrow': { weights: [400], urlName: 'Archivo+Narrow' },
  'barlow-semi-condensed': { weights: [400], urlName: 'Barlow+Semi+Condensed' },
  'alumni-sans': { weights: [400], urlName: 'Alumni+Sans' },
  'arimo': { weights: [400], urlName: 'Arimo' },
  
  // Serif
  'playfair-display': { weights: [400, 700], urlName: 'Playfair+Display' },
  'merriweather': { weights: [400], urlName: 'Merriweather' },
  'lora': { weights: [400], urlName: 'Lora' },
  'abril-fatface': { weights: [400], urlName: 'Abril+Fatface' },
  'antic-slab': { weights: [400], urlName: 'Antic+Slab' },
  'bellota': { weights: [400], urlName: 'Bellota' },
  
  // Display
  'bebas-neue': { weights: [400], urlName: 'Bebas+Neue' },
  'oswald': { weights: [400], urlName: 'Oswald' },
  'anton': { weights: [400], urlName: 'Anton' },
  'righteous': { weights: [400], urlName: 'Righteous' },
  'bowlby-one': { weights: [400], urlName: 'Bowlby+One' },
  'boogaloo': { weights: [400], urlName: 'Boogaloo' },
  'fredoka-one': { weights: [400], urlName: 'Fredoka+One' },
  'pacifico': { weights: [400], urlName: 'Pacifico' },
  'lobster': { weights: [400], urlName: 'Lobster' },
  'amaranth': { weights: [400], urlName: 'Amaranth' },
  'bevan': { weights: [400], urlName: 'Bevan' },
  
  // Script
  'alex-brush': { weights: [400], urlName: 'Alex+Brush' },
  'allison': { weights: [400], urlName: 'Allison' },
  'dancing-script': { weights: [400, 700], urlName: 'Dancing+Script' },
  'great-vibes': { weights: [400], urlName: 'Great+Vibes' },
  'parisienne': { weights: [400], urlName: 'Parisienne' },
  'sacramento': { weights: [400], urlName: 'Sacramento' },
  'caveat': { weights: [400], urlName: 'Caveat' },
  'kalam': { weights: [400], urlName: 'Kalam' },
  'satisfy': { weights: [400], urlName: 'Satisfy' },
  'amatic-sc': { weights: [400], urlName: 'Amatic+SC' },
  
  // Monospace
  'roboto-mono': { weights: [400], urlName: 'Roboto+Mono' },
  'source-code-pro': { weights: [400], urlName: 'Source+Code+Pro' },
  'ibm-plex-mono': { weights: [400], urlName: 'IBM+Plex+Mono' },
  'jetbrains-mono': { weights: [400], urlName: 'JetBrains+Mono' },
};

// System fonts that don't need downloading
const SYSTEM_FONTS = ['arial', 'times-new-roman', 'georgia', 'courier-new'];

async function downloadFont(fontId, weight) {
  const fontConfig = GOOGLE_FONTS_MAP[fontId];
  if (!fontConfig) {
    console.log(`Skipping ${fontId} - not in Google Fonts map`);
    return null;
  }

  // Use the explicitly defined URL name
  const fontName = fontConfig.urlName;
  const url = `https://fonts.googleapis.com/css2?family=${fontName}:wght@${weight}&display=swap`;

  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    };
    
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        
        // Parse all font-face blocks to find the correct Latin subset
        const fontFaceBlocks = data.split('@font-face');
        let woff2Url = null;
        
        for (const block of fontFaceBlocks) {
          // Look for the latin subset (not latin-ext)
          // The latin subset contains unicode-range U+0000-00FF
          if (block.includes('unicode-range') && block.includes('U+0000-00FF')) {
            const urlMatch = block.match(/url\((https:\/\/fonts\.gstatic\.com[^)]+\.woff2)\)/);
            if (urlMatch) {
              woff2Url = urlMatch[1];
              console.log('  Found latin subset');
              break;
            }
          }
        }
        
        // Fallback: if no unicode-range specified, it's probably the full font
        if (!woff2Url) {
          const match = data.match(/url\((https:\/\/fonts\.gstatic\.com[^)]+\.woff2)\)/);
          if (match) {
            woff2Url = match[1];
            console.log('  Using first woff2 URL (no unicode-range found)');
          }
        }
        
        if (woff2Url) {
          // Download the woff2 file
          https.get(woff2Url, (woff2Res) => {
            const chunks = [];
            woff2Res.on('data', chunk => chunks.push(chunk));
            woff2Res.on('end', () => {
              resolve(Buffer.concat(chunks));
            });
          });
        } else {
          console.log(`Failed to find woff2 URL in response for ${fontId}`);
          reject(new Error(`Could not find woff2 URL for ${fontId}`));
        }
      });
    }).on('error', reject);
  });
}

async function uploadToS3(fontId, weight, buffer) {
  const key = `${FONTS_PREFIX}/${fontId}/${fontId}-${weight === 400 ? 'regular' : 'bold'}.woff2`;
  
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: 'font/woff2',
    CacheControl: 'public, max-age=31536000', // 1 year cache
  });

  try {
    await s3Client.send(command);
    console.log(`✓ Uploaded ${fontId} (weight: ${weight}) to S3`);
    return `https://${BUCKET_NAME}.s3.us-west-1.amazonaws.com/${key}`;
  } catch (error) {
    console.error(`✗ Failed to upload ${fontId}:`, error.message);
    throw error;
  }
}

async function setupFonts() {
  console.log('Starting font setup...\n');

  const results = {
    success: [],
    failed: [],
    skipped: []
  };

  // Process each font
  for (const [fontId, config] of Object.entries(GOOGLE_FONTS_MAP)) {
    if (SYSTEM_FONTS.includes(fontId)) {
      console.log(`Skipping ${fontId} - system font`);
      results.skipped.push(fontId);
      continue;
    }

    try {
      // Download each weight
      for (const weight of config.weights) {
        console.log(`Processing ${fontId} (weight: ${weight})...`);
        
        const fontBuffer = await downloadFont(fontId, weight);
        if (fontBuffer) {
          await uploadToS3(fontId, weight, fontBuffer);
          results.success.push(`${fontId}-${weight}`);
        }
      }
    } catch (error) {
      console.error(`Failed to process ${fontId}:`, error.message);
      results.failed.push(fontId);
    }
  }

  // Summary
  console.log('\n=== Setup Complete ===');
  console.log(`✓ Success: ${results.success.length} fonts`);
  console.log(`✗ Failed: ${results.failed.length} fonts`);
  console.log(`- Skipped: ${results.skipped.length} fonts`);

  if (results.failed.length > 0) {
    console.log('\nFailed fonts:', results.failed.join(', '));
  }
}

// Add special handling for system fonts that need placeholder files
async function createSystemFontPlaceholders() {
  const systemFontMessage = `System font - no download required`;
  const buffer = Buffer.from(systemFontMessage);

  for (const fontId of SYSTEM_FONTS) {
    const weights = fontId === 'arial' ? [400, 700] : [400];
    
    for (const weight of weights) {
      const key = `${FONTS_PREFIX}/${fontId}/${fontId}-${weight === 400 ? 'regular' : 'bold'}.woff2`;
      
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: 'text/plain',
        CacheControl: 'public, max-age=31536000',
      });

      try {
        await s3Client.send(command);
        console.log(`✓ Created placeholder for system font ${fontId} (weight: ${weight})`);
      } catch (error) {
        console.error(`✗ Failed to create placeholder for ${fontId}:`, error.message);
      }
    }
  }
}

// Run the setup
try {
  await setupFonts();
  await createSystemFontPlaceholders();
} catch (error) {
  console.error('Setup failed:', error);
  process.exit(1);
}
#!/usr/bin/env node

/**
 * Script to clear template bindings for a product
 * This removes the metafields that point to old template IDs
 */

const PRODUCT_ID = 'gid://shopify/Product/9852686237991';
const APP_URL = process.env.APP_URL || 'https://furniture-payments-fixtures-volvo.trycloudflare.com';

async function clearBindings() {
  console.log('=== CLEARING TEMPLATE BINDINGS ===\n');
  console.log(`Product ID: ${PRODUCT_ID}`);
  console.log(`App URL: ${APP_URL}\n`);

  try {
    const response = await fetch(`${APP_URL}/app/api/templates/clear-bindings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `productId=${encodeURIComponent(PRODUCT_ID)}`
    });

    if (!response.ok) {
      console.error(`HTTP error! status: ${response.status}`);
      const text = await response.text();
      console.error('Response:', text);
      return;
    }

    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ Success! Cleared ${result.clearedCount} variant bindings`);
      if (result.errors && result.errors.length > 0) {
        console.log('\n⚠️  Some errors occurred:');
        result.errors.forEach(err => console.log(`  - ${err}`));
      }
    } else {
      console.error('❌ Failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\nNote: This script needs to be run while the app is running.');
    console.log('The app might be requiring authentication.');
  }
}

console.log('Note: This script will clear all template bindings for the product.');
console.log('You\'ll need to regenerate the color variants after running this.\n');
console.log('Unfortunately, due to authentication requirements, you may need to:');
console.log('1. Manually clear the bindings through the Shopify admin');
console.log('2. OR modify the generate variants function to overwrite existing bindings\n');

// Run the script
clearBindings();
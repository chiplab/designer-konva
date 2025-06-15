/**
 * Product Mappings Configuration
 * Maps source products (with base images) to selling products (customer-facing)
 */

export const PRODUCT_MAPPINGS = {
  // Source Product ID -> Selling Product ID
  'gid://shopify/Product/9797597331751': 'gid://shopify/Product/9852686237991', // Composite Poker Chip 8 Spot
  
  // Add more mappings as needed
  // 'gid://shopify/Product/SOURCE_ID': 'gid://shopify/Product/SELLING_ID',
};

/**
 * Get the selling product ID for a given source product ID
 */
export function getSellingProductId(sourceProductId: string): string {
  return PRODUCT_MAPPINGS[sourceProductId] || sourceProductId;
}

/**
 * Check if a product has a selling product mapping
 */
export function hasSellingProduct(sourceProductId: string): boolean {
  return sourceProductId in PRODUCT_MAPPINGS;
}
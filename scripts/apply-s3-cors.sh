#!/bin/bash

# Apply CORS configuration to S3 bucket
echo "Applying CORS configuration to shopify-designs bucket..."

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Check if the CORS config file exists
if [ ! -f "$PROJECT_ROOT/s3-cors-config-cli.json" ]; then
  echo "❌ Error: s3-cors-config-cli.json not found in project root"
  exit 1
fi

# Apply CORS configuration
aws s3api put-bucket-cors \
  --bucket shopify-designs \
  --cors-configuration "file://$PROJECT_ROOT/s3-cors-config-cli.json" \
  --region us-west-1

if [ $? -eq 0 ]; then
  echo "✅ CORS configuration applied successfully!"
  echo ""
  echo "Verifying CORS configuration..."
  aws s3api get-bucket-cors --bucket shopify-designs --region us-west-1
else
  echo "❌ Failed to apply CORS configuration"
  echo "Make sure you have:"
  echo "1. AWS CLI installed and configured"
  echo "2. Proper permissions to modify bucket CORS"
  echo "3. The bucket name and region are correct"
fi
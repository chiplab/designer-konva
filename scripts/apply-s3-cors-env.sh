#!/bin/bash

# Apply CORS configuration to S3 bucket using credentials from .env file
echo "Applying CORS configuration to shopify-designs bucket..."

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Check if the CORS config file exists
if [ ! -f "$PROJECT_ROOT/s3-cors-config.json" ]; then
  echo "❌ Error: s3-cors-config.json not found in project root"
  exit 1
fi

# Check if .env file exists
if [ ! -f "$PROJECT_ROOT/.env" ]; then
  echo "❌ Error: .env file not found in project root"
  exit 1
fi

# Load AWS credentials from .env file
export AWS_ACCESS_KEY_ID=$(grep AWS_ACCESS_KEY_ID "$PROJECT_ROOT/.env" | cut -d '=' -f2)
export AWS_SECRET_ACCESS_KEY=$(grep AWS_SECRET_ACCESS_KEY "$PROJECT_ROOT/.env" | cut -d '=' -f2)

if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
  echo "❌ Error: AWS credentials not found in .env file"
  exit 1
fi

echo "Using AWS credentials from .env file..."

# Apply CORS configuration
aws s3api put-bucket-cors \
  --bucket shopify-designs \
  --cors-configuration "file://$PROJECT_ROOT/s3-cors-config.json" \
  --region us-west-1

if [ $? -eq 0 ]; then
  echo "✅ CORS configuration applied successfully!"
  echo ""
  echo "Verifying CORS configuration..."
  aws s3api get-bucket-cors --bucket shopify-designs --region us-west-1
else
  echo "❌ Failed to apply CORS configuration"
  echo "Make sure you have:"
  echo "1. AWS CLI installed (brew install awscli)"
  echo "2. Proper permissions to modify bucket CORS"
  echo "3. The bucket name and region are correct"
  echo ""
  echo "You can also apply CORS manually in the AWS Console:"
  echo "1. Go to https://s3.console.aws.amazon.com/s3/buckets/shopify-designs"
  echo "2. Click on 'Permissions' tab"
  echo "3. Scroll to 'Cross-origin resource sharing (CORS)'"
  echo "4. Click 'Edit' and paste the contents of s3-cors-config.json"
fi
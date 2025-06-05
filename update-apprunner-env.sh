#!/bin/bash

# Update App Runner Environment Variables
# Usage: ./update-apprunner-env.sh

SERVICE_ARN="arn:aws:apprunner:us-east-1:070259837090:service/designer-konva-app/099844847c4e460d931162d5f0586996"
REGION="us-east-1"

echo "🔧 Updating App Runner environment variables..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found! Please create one based on .env.example"
    exit 1
fi

# Source the .env file
export $(cat .env | grep -v '^#' | xargs)

# Create JSON configuration for environment variables
cat > env-update.json << EOF
{
    "ServiceArn": "${SERVICE_ARN}",
    "SourceConfiguration": {
        "ImageRepository": {
            "ImageIdentifier": "070259837090.dkr.ecr.us-east-1.amazonaws.com/designer-konva:latest",
            "ImageConfiguration": {
                "RuntimeEnvironmentVariables": {
                    "NODE_ENV": "production",
                    "DATABASE_URL": "file:./prisma/data/db.sqlite",
                    "SHOPIFY_APP_URL": "https://6ux5iwunmq.us-east-1.awsapprunner.com",
                    "HOST": "https://6ux5iwunmq.us-east-1.awsapprunner.com",
                    "SHOPIFY_API_KEY": "${SHOPIFY_API_KEY}",
                    "SHOPIFY_API_SECRET": "${SHOPIFY_API_SECRET}",
                    "SCOPES": "${SCOPES:-write_products}",
                    "AWS_ACCESS_KEY_ID": "${AWS_ACCESS_KEY_ID}",
                    "AWS_SECRET_ACCESS_KEY": "${AWS_SECRET_ACCESS_KEY}"
                },
                "StartCommand": "npm run docker-start",
                "Port": "3000"
            },
            "ImageRepositoryType": "ECR"
        }
    }
}
EOF

echo "📤 Updating App Runner service..."
aws apprunner update-service --cli-input-json file://env-update.json --region ${REGION}

# Clean up
rm env-update.json

echo "✅ Environment variables update initiated!"
echo "🔗 Your app URL: https://6ux5iwunmq.us-east-1.awsapprunner.com"
echo ""
echo "⏳ Check deployment status with:"
echo "aws apprunner describe-service --service-arn ${SERVICE_ARN} --region ${REGION} --query 'Service.Status'"
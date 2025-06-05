#!/bin/bash

# AWS App Runner Deployment Script
# Make sure you have AWS CLI configured with proper credentials

# Configuration
AWS_REGION="us-east-1"  # App Runner is available in us-east-1
ECR_REPOSITORY="designer-konva"
IMAGE_TAG="latest"
SERVICE_NAME="designer-konva-app"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting deployment to AWS App Runner...${NC}"

# Get AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo -e "${RED}Failed to get AWS account ID. Make sure AWS CLI is configured.${NC}"
    exit 1
fi

ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}"

# Create ECR repository if it doesn't exist
echo -e "${YELLOW}Creating ECR repository if needed...${NC}"
aws ecr describe-repositories --repository-names ${ECR_REPOSITORY} --region ${AWS_REGION} 2>/dev/null || \
    aws ecr create-repository --repository-name ${ECR_REPOSITORY} --region ${AWS_REGION}

# Get ECR login token
echo -e "${YELLOW}Logging into ECR...${NC}"
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_URI}

# Build Docker image
echo -e "${YELLOW}Building Docker image...${NC}"
docker build -t ${ECR_REPOSITORY}:${IMAGE_TAG} .

# Tag image for ECR
echo -e "${YELLOW}Tagging image for ECR...${NC}"
docker tag ${ECR_REPOSITORY}:${IMAGE_TAG} ${ECR_URI}:${IMAGE_TAG}

# Push to ECR
echo -e "${YELLOW}Pushing image to ECR...${NC}"
docker push ${ECR_URI}:${IMAGE_TAG}

# Create App Runner configuration file
echo -e "${YELLOW}Creating App Runner configuration...${NC}"
cat > apprunner.yaml << EOF
version: 1.0
runtime: docker
build:
  commands:
    build:
      - echo "No build commands"
run:
  runtime-version: latest
  command: npm run docker-start
  network:
    port: 3000
    env: PORT
  env:
    - name: NODE_ENV
      value: production
    - name: DATABASE_URL
      value: file:./prisma/data/db.sqlite
EOF

echo -e "${GREEN}Docker image pushed to ECR successfully!${NC}"
echo -e "${YELLOW}ECR URI: ${ECR_URI}:${IMAGE_TAG}${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Go to AWS App Runner console: https://console.aws.amazon.com/apprunner"
echo "2. Create a new service with ECR source"
echo "3. Use this ECR URI: ${ECR_URI}:${IMAGE_TAG}"
echo "4. Configure environment variables in App Runner"
echo "5. Your app will be available at the App Runner provided URL"
echo ""
echo -e "${GREEN}Don't forget to update Shopify app configuration with the new URL!${NC}"
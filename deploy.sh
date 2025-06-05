#!/bin/bash
set -e

echo "🔧 Building Docker image..."
DOCKER_DEFAULT_PLATFORM=linux/amd64 docker build -t designer-konva .

echo "🏷️  Tagging image..."
docker tag designer-konva:latest 070259837090.dkr.ecr.us-east-1.amazonaws.com/designer-konva:latest

echo "🚀 Pushing to ECR..."
docker push 070259837090.dkr.ecr.us-east-1.amazonaws.com/designer-konva:latest

echo "🔄 Starting App Runner deployment..."
aws apprunner start-deployment \
  --service-arn arn:aws:apprunner:us-east-1:070259837090:service/designer-konva-app/099844847c4e460d931162d5f0586996 \
  --region us-east-1

echo "✅ Deployment initiated!"
echo "Check status with: aws apprunner describe-service --service-arn arn:aws:apprunner:us-east-1:070259837090:service/designer-konva-app/099844847c4e460d931162d5f0586996 --region us-east-1 --query 'Service.Status'"
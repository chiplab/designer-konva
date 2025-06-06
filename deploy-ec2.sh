#!/bin/bash

# EC2 Deployment Script for Shopify Designer App

echo "🚀 Starting deployment..."

# Navigate to app directory
cd /home/ec2-user/designer-konva

# Pull latest changes
echo "📥 Pulling latest changes from git..."
git pull origin main

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --production=false

# Build the app
echo "🔨 Building the app..."
npm run build

# Run database migrations
echo "🗄️  Running database migrations..."
npm run setup

# Restart PM2 process
echo "🔄 Restarting PM2 process..."
pm2 reload ecosystem.config.cjs --update-env

# Save PM2 state
pm2 save

echo "✅ Deployment complete!"
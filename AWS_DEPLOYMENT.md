# AWS Deployment Guide

## Option 1: AWS App Runner (Recommended for simplicity)

### Prerequisites
1. AWS Account with App Runner access
2. ECR (Elastic Container Registry) repository
3. Your built Docker image

### Steps

1. **Build and tag your Docker image:**
```bash
# Build the image
docker build -t designer-konva .

# Test locally
docker run -p 3000:3000 --env-file .env designer-konva
```

2. **Push to ECR:**
```bash
# Get login token
aws ecr get-login-password --region us-west-1 | docker login --username AWS --password-stdin YOUR_ECR_URI

# Tag image
docker tag designer-konva:latest YOUR_ECR_URI/designer-konva:latest

# Push image
docker push YOUR_ECR_URI/designer-konva:latest
```

3. **Create App Runner service:**
```bash
# Create apprunner.yaml
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
      value: file:./data/db.sqlite
    - name: SHOPIFY_APP_URL
      value: https://YOUR_APP_RUNNER_URL.awsapprunner.com
EOF
```

4. **Configure environment variables in App Runner:**
- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY
- SHOPIFY_API_KEY
- SHOPIFY_API_SECRET
- SCOPES
- HOST (your App Runner URL)

## Option 2: EC2 with Docker

### Setup EC2 Instance

1. **Launch EC2 instance:**
   - Amazon Linux 2 or Ubuntu 22.04
   - t3.small or larger
   - Security group: Allow ports 22, 80, 443

2. **Install Docker on EC2:**
```bash
# For Amazon Linux 2
sudo yum update -y
sudo amazon-linux-extras install docker
sudo service docker start
sudo usermod -a -G docker ec2-user

# For Ubuntu
sudo apt update
sudo apt install docker.io docker-compose -y
sudo systemctl start docker
sudo usermod -aG docker ubuntu
```

3. **Setup Nginx as reverse proxy:**
```bash
sudo yum install nginx -y  # or apt install nginx

# Configure nginx
sudo tee /etc/nginx/conf.d/app.conf << EOF
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        
        # CORS headers for Shopify
        add_header 'Access-Control-Allow-Origin' '\$http_origin' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,X-CustomHeader,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Authorization' always;
    }
}
EOF

sudo nginx -t
sudo systemctl restart nginx
```

4. **Deploy with docker-compose:**
```bash
# Copy files to EC2
scp -r . ec2-user@YOUR_EC2_IP:~/designer-konva/

# SSH into EC2
ssh ec2-user@YOUR_EC2_IP

# Run the app
cd designer-konva
docker-compose up -d
```

## Option 3: ECS (Elastic Container Service)

For production-grade deployment with auto-scaling:

1. Create ECS cluster
2. Create task definition with your Docker image
3. Create service with ALB (Application Load Balancer)
4. Configure ALB with proper CORS headers

## SSL/TLS Setup

For any option, use AWS Certificate Manager:

1. Request certificate for your domain
2. For App Runner: Automatically handled
3. For EC2: Use ALB or configure Let's Encrypt
4. For ECS: Configure on ALB

## Post-Deployment

1. Update Shopify app configuration:
   - App URL: https://your-domain.com
   - Redirect URLs: https://your-domain.com/auth/callback
   - App Proxy URL: https://your-domain.com

2. Update environment variables:
   - SHOPIFY_APP_URL=https://your-domain.com
   - HOST=https://your-domain.com

3. Test the app proxy:
   - Visit: https://your-store.myshopify.com/apps/designer/meow
   - Verify no CORS errors!

## Monitoring

- CloudWatch for logs
- App Runner metrics
- Set up alarms for high CPU/memory usage
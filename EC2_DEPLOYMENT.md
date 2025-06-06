# EC2 Deployment Guide

## Initial Setup on EC2

1. **SSH into your EC2 instance:**
   ```bash
   ssh -i ~/.ssh/lfg-1.pem ec2-user@54.241.88.100
   ```

2. **Clone the repository:**
   ```bash
   cd /home/ec2-user
   git clone https://github.com/YOUR_USERNAME/designer-konva.git
   cd designer-konva
   ```

3. **Install dependencies:**
   ```bash
   npm ci --production=false
   ```

4. **Set up environment variables:**
   ```bash
   cp .env.production.sample .env
   nano .env  # Edit with your actual values
   ```

5. **Build and setup the app:**
   ```bash
   npm run build
   npm run setup  # This runs Prisma migrations
   ```

6. **Start with PM2:**
   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup  # Follow the instructions to enable PM2 on system restart
   ```

## GitHub Actions Setup

1. **Add your EC2 SSH key to GitHub Secrets:**
   - Go to your GitHub repository settings
   - Navigate to Settings > Secrets and variables > Actions
   - Add a new secret named `EC2_SSH_KEY`
   - Copy the contents of your `~/.ssh/lfg-1.pem` file as the value

2. **The workflow will automatically:**
   - Trigger on pushes to the main branch
   - SSH into your EC2 instance
   - Pull the latest code
   - Install dependencies
   - Build the app
   - Run migrations
   - Restart the PM2 process

## Nginx Setup (Optional but Recommended)

1. **Install Nginx:**
   ```bash
   sudo yum install nginx -y
   ```

2. **Configure Nginx as a reverse proxy:**
   ```bash
   sudo nano /etc/nginx/conf.d/shopify-designer.conf
   ```

   Add:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;  # or your EC2 public DNS

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

3. **Start Nginx:**
   ```bash
   sudo systemctl start nginx
   sudo systemctl enable nginx
   ```

## Security Group Configuration

Make sure your EC2 security group allows:
- Port 80 (HTTP) - if using Nginx
- Port 443 (HTTPS) - if using SSL
- Port 3000 - if accessing Node.js directly
- Port 22 (SSH) - for deployment access

## Manual Deployment

If you need to deploy manually:
```bash
ssh -i ~/.ssh/lfg-1.pem ec2-user@54.241.88.100
cd /home/ec2-user/designer-konva
bash deploy-ec2.sh
```

## Monitoring

Check PM2 status:
```bash
pm2 status
pm2 logs shopify-designer
pm2 monit  # Real-time monitoring
```

## Troubleshooting

1. **Check logs:**
   ```bash
   pm2 logs
   tail -f /home/ec2-user/logs/pm2-error.log
   ```

2. **Restart the app:**
   ```bash
   pm2 restart shopify-designer
   ```

3. **Check Nginx logs:**
   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```
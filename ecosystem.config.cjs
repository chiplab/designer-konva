module.exports = {
  apps: [{
    name: 'shopify-designer',
    script: 'npm',
    args: 'run start',
    cwd: '/home/ec2-user/designer-konva',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: '/home/ec2-user/logs/pm2-error.log',
    out_file: '/home/ec2-user/logs/pm2-out.log',
    log_file: '/home/ec2-user/logs/pm2-combined.log',
    time: true
  }]
};
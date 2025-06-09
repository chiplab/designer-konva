# RDS PostgreSQL Setup Guide

## Overview
This guide helps you set up and connect to the shared PostgreSQL development database on AWS RDS.

## Prerequisites
- AWS access (to create RDS instance)
- SSH key file: `~/.ssh/lfg-2.pem`
- Bastion host access: `ec2-user@50.18.129.148`

## Step 1: Create RDS PostgreSQL Instance (One-time setup)

### Via AWS Console:
1. Go to RDS > Create database
2. Choose:
   - Engine: PostgreSQL (latest version, currently 15.x)
   - Template: Dev/Test
   - DB instance identifier: `designer-dev`
   - Master username: `postgres`
   - Master password: (save this securely)
   - DB instance class: `db.t3.micro` (free tier eligible)
   - Storage: 20 GB
   - VPC: Same as your bastion host
   - Security group: Allow port 5432 from bastion host
   - Initial database name: `designer_dev`

### Via AWS CLI:
```bash
aws rds create-db-instance \
  --db-instance-identifier designer-dev \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 15.5 \
  --master-username postgres \
  --master-user-password YOUR_SECURE_PASSWORD \
  --allocated-storage 20 \
  --vpc-security-group-ids sg-xxxxxx \
  --db-subnet-group-name your-subnet-group \
  --backup-retention-period 7 \
  --no-publicly-accessible \
  --db-name designer_dev
```

## Step 2: Update Configuration

1. Get your RDS endpoint from AWS Console (e.g., `designer-dev.cncask2wa433.us-west-1.rds.amazonaws.com`)

2. Update `scripts/rds-tunnel.sh`:
```bash
RDS_ENDPOINT="designer-dev.cncask2wa433.us-west-1.rds.amazonaws.com"
```

3. Update `.env`:
```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/designer_dev?schema=public"
```

## Step 3: Connect to Database

1. Start the SSH tunnel:
```bash
npm run db:tunnel
# or
./scripts/rds-tunnel.sh
```

2. In a new terminal, run migrations:
```bash
npx prisma migrate deploy
```

3. (Optional) Seed initial data:
```bash
npx prisma db seed
```

## Step 4: Verify Connection

```bash
npx prisma studio
```

This opens a web UI to browse your database at http://localhost:5555

## Daily Development Workflow

1. Start tunnel: `npm run db:tunnel`
2. Start app: `npm run dev`
3. Work normally - all database operations go through the tunnel

## Troubleshooting

### "Connection refused" error
- Ensure tunnel is running
- Check if port 5432 is already in use: `lsof -i :5432`

### "Authentication failed"
- Verify password in DATABASE_URL
- Check PostgreSQL user permissions

### "Database does not exist"
- Run: `npx prisma migrate deploy`

## Team Access

To grant access to a new developer:
1. Share the `.pem` file securely
2. Add their IP to bastion host security group (if needed)
3. Share the database password securely
4. Have them follow steps 2-4 above

## Security Notes

- Never commit real passwords to git
- Use strong passwords for database
- Rotate credentials periodically
- The tunnel ensures database is never exposed to internet
# Production Deployment Checklist

## For EC2 Production Server

1. **Update `.env` file** on production server:
   ```
   DATABASE_URL="postgresql://postgres:o!(HNa1~[fFlS>MWMcv_s~B0>ZfP@designer-konva-dev.cjyk6pbmwqld.us-west-1.rds.amazonaws.com:5432/designer_dev?schema=public"
   ```
   Note: Use the direct RDS endpoint, not localhost (no SSH tunnel in production)

2. **Pull latest code**:
   ```bash
   git pull origin main
   ```

3. **Run database setup** (this generates Prisma client and runs migrations):
   ```bash
   npm run setup
   ```

4. **Build the application**:
   ```bash
   npm run build
   ```

5. **Restart the PM2 process**:
   ```bash
   pm2 restart all
   ```

## Important Notes

- The RDS database is already set up and accessible from the EC2 instance
- No new npm dependencies were added, so no need for `npm install`
- The `npm run setup` command will:
  - Generate the Prisma client with the new ProductLayout model
  - Run any pending migrations (including the ProductLayout migration)
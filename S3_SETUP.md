# S3 Setup Guide for Shopify Designer App

## Prerequisites

1. AWS Account with S3 access
2. S3 Bucket: `shopify-designs` in region `us-west-1`
3. IAM User with appropriate permissions

## Step 1: Configure S3 Bucket

### 1.1 Bucket Permissions

Your bucket needs to allow public read access for images. You have two options:

#### Option A: Using Bucket Policies (Recommended)

1. Go to your S3 bucket in AWS Console
2. Navigate to "Permissions" tab
3. Edit "Bucket policy" and add:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::shopify-designs/*"
        }
    ]
}
```

#### Option B: Using ACLs

1. Go to your S3 bucket settings
2. Navigate to "Permissions" > "Object Ownership"
3. Enable "ACLs enabled" and select "Bucket owner preferred"
4. Under "Block Public Access settings", ensure "Block public access to buckets and objects granted through new access control lists (ACLs)" is OFF

### 1.2 CORS Configuration (CRITICAL)

CORS must be properly configured for images to display in the canvas. Choose one of these methods:

#### Method A: Using AWS CLI (Recommended)

Run the provided script from the project root:

```bash
./scripts/apply-s3-cors.sh
```

Or manually apply using AWS CLI:

```bash
aws s3api put-bucket-cors \
  --bucket shopify-designs \
  --cors-configuration file://s3-cors-config.json \
  --region us-west-1
```

#### Method B: Via AWS Console

1. In your S3 bucket, go to "Permissions" tab
2. Scroll to "Cross-origin resource sharing (CORS)"
3. Click "Edit" and paste the entire contents of `s3-cors-config.json`:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": [
      "https://*.myshopify.com",
      "https://*.shopify.com",
      "https://*.shopifycdn.com",
      "https://*.trycloudflare.com",
      "http://localhost:*",
      "http://127.0.0.1:*"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

**Important**: After applying CORS, verify it's working:
```bash
aws s3api get-bucket-cors --bucket shopify-designs --region us-west-1
```

## Step 2: Create IAM User

Create an IAM user with the following policy:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:PutObjectAcl",
                "s3:GetObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::shopify-designs",
                "arn:aws:s3:::shopify-designs/*"
            ]
        }
    ]
}
```

## Step 3: Configure Environment Variables

Add your AWS credentials to `.env`:

```
AWS_ACCESS_KEY_ID=your-actual-access-key
AWS_SECRET_ACCESS_KEY=your-actual-secret-key
```

## Step 4: Upload Default Assets

Upload the following files to your S3 bucket:

1. `assets/default/images/8-spot-red-base-image.png`
2. `assets/default/images/8-spot-black-base.png`
3. `assets/default/images/8-spot-blue-base.png`
4. `assets/default/svgs/borders_v7-11.svg`

You can use the AWS CLI:

```bash
# Upload images
aws s3 cp public/media/images/8-spot-red-base-image.png s3://shopify-designs/assets/default/images/
aws s3 cp public/media/images/8-spot-black-base.png s3://shopify-designs/assets/default/images/
aws s3 cp public/media/images/8-spot-blue-base.png s3://shopify-designs/assets/default/images/

# Upload SVGs
aws s3 cp public/media/images/borders_v7-11.svg s3://shopify-designs/assets/default/svgs/
```

## Troubleshooting

### "Failed to upload asset" Error

1. Check that your AWS credentials are correctly set in `.env`
2. Restart your development server after updating `.env`
3. Verify your IAM user has the required permissions
4. Check bucket name and region match your configuration

### CORS Errors

If you see errors like "has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header":

1. **Apply CORS configuration**: Run `./scripts/apply-s3-cors.sh`
2. **Verify CORS is applied**: 
   ```bash
   aws s3api get-bucket-cors --bucket shopify-designs --region us-west-1
   ```
3. **Check your domain is included**: Ensure your app's domain matches one of the patterns in AllowedOrigins
4. **Clear browser cache**: CORS settings may be cached
5. **Wait a few minutes**: S3 CORS changes can take 2-3 minutes to propagate globally

### Access Denied Errors

If you see "S3 Access Denied" errors:

1. Check if ACLs are enabled on your bucket (if using ACL approach)
2. Verify bucket policy allows public read access
3. Ensure IAM user has PutObjectAcl permission

### Alternative: Remove ACL Requirement

If you prefer not to use ACLs, modify `app/services/s3.server.ts`:

```typescript
// Remove this line:
...(isPublic && { ACL: "public-read" }),
```

And rely solely on bucket policies for public access.
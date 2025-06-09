# RDS Connection Debugging Guide

This guide helps troubleshoot the connection error from EC2 to RDS:
```
Error: P1001: Can't reach database server at `designer-konva-dev.cjyk6pbmwqld.us-west-1.rds.amazonaws.com:5432`
```

## Prerequisites
- AWS CLI installed and configured
- EC2 Instance IP: 172.31.13.60
- RDS Endpoint: designer-konva-dev.cjyk6pbmwqld.us-west-1.rds.amazonaws.com

## Step 1: Check RDS Instance Status and Details

```bash
# Get RDS instance details
aws rds describe-db-instances --db-instance-identifier designer-konva-dev --region us-west-1

# Check if the instance is available
aws rds describe-db-instances --db-instance-identifier designer-konva-dev --region us-west-1 --query 'DBInstances[0].DBInstanceStatus'

# Get the VPC Security Groups attached to RDS
aws rds describe-db-instances --db-instance-identifier designer-konva-dev --region us-west-1 --query 'DBInstances[0].VpcSecurityGroups[*].VpcSecurityGroupId'

# Check if RDS is publicly accessible
aws rds describe-db-instances --db-instance-identifier designer-konva-dev --region us-west-1 --query 'DBInstances[0].PubliclyAccessible'
```

## Step 2: Get EC2 Instance Security Group

```bash
# First, find your EC2 instance ID by IP
aws ec2 describe-instances --region us-west-1 --filters "Name=private-ip-address,Values=172.31.13.60" --query 'Reservations[0].Instances[0].InstanceId'

# Get the security group(s) of your EC2 instance
aws ec2 describe-instances --region us-west-1 --filters "Name=private-ip-address,Values=172.31.13.60" --query 'Reservations[0].Instances[0].SecurityGroups[*].GroupId'
```

## Step 3: Check RDS Security Group Rules

```bash
# Replace sg-XXXXXXXX with the actual RDS security group ID from Step 1
RDS_SG_ID="sg-XXXXXXXX"

# Check inbound rules for the RDS security group
aws ec2 describe-security-groups --group-ids $RDS_SG_ID --region us-west-1 --query 'SecurityGroups[0].IpPermissions'
```

## Step 4: Add EC2 to RDS Security Group (if needed)

### Option A: Add EC2's Security Group to RDS Security Group (Recommended)

```bash
# Replace with actual values
RDS_SG_ID="sg-XXXXXXXX"  # RDS security group
EC2_SG_ID="sg-YYYYYYYY"  # EC2 security group

# Add rule to allow EC2 security group to connect to RDS on PostgreSQL port
aws ec2 authorize-security-group-ingress \
  --group-id $RDS_SG_ID \
  --protocol tcp \
  --port 5432 \
  --source-group $EC2_SG_ID \
  --region us-west-1
```

### Option B: Add EC2's Private IP to RDS Security Group

```bash
# Replace with actual RDS security group ID
RDS_SG_ID="sg-XXXXXXXX"

# Add rule to allow EC2's private IP
aws ec2 authorize-security-group-ingress \
  --group-id $RDS_SG_ID \
  --protocol tcp \
  --port 5432 \
  --cidr 172.31.13.60/32 \
  --region us-west-1
```

### Option C: Add EC2's Subnet CIDR to RDS Security Group

```bash
# Get EC2's subnet CIDR
aws ec2 describe-instances --region us-west-1 --filters "Name=private-ip-address,Values=172.31.13.60" --query 'Reservations[0].Instances[0].SubnetId'

# Get subnet CIDR block
SUBNET_ID="subnet-XXXXXXXX"  # Replace with actual subnet ID
aws ec2 describe-subnets --subnet-ids $SUBNET_ID --region us-west-1 --query 'Subnets[0].CidrBlock'

# Add subnet CIDR to RDS security group
RDS_SG_ID="sg-XXXXXXXX"
SUBNET_CIDR="172.31.0.0/20"  # Replace with actual CIDR

aws ec2 authorize-security-group-ingress \
  --group-id $RDS_SG_ID \
  --protocol tcp \
  --port 5432 \
  --cidr $SUBNET_CIDR \
  --region us-west-1
```

## Step 5: Test Connectivity

From your EC2 instance, run these tests:

```bash
# Test DNS resolution
nslookup designer-konva-dev.cjyk6pbmwqld.us-west-1.rds.amazonaws.com

# Test network connectivity
nc -zv designer-konva-dev.cjyk6pbmwqld.us-west-1.rds.amazonaws.com 5432

# Test with telnet
telnet designer-konva-dev.cjyk6pbmwqld.us-west-1.rds.amazonaws.com 5432

# Test with PostgreSQL client
psql -h designer-konva-dev.cjyk6pbmwqld.us-west-1.rds.amazonaws.com -p 5432 -U postgres -d postgres
```

## Step 6: Verify Database Configuration

```bash
# Check if the database exists
aws rds describe-db-instances --db-instance-identifier designer-konva-dev --region us-west-1 --query 'DBInstances[0].DBName'

# Check the master username
aws rds describe-db-instances --db-instance-identifier designer-konva-dev --region us-west-1 --query 'DBInstances[0].MasterUsername'
```

## Step 7: Check VPC and Subnet Configuration

```bash
# Get RDS subnet group
aws rds describe-db-instances --db-instance-identifier designer-konva-dev --region us-west-1 --query 'DBInstances[0].DBSubnetGroup.DBSubnetGroupName'

# Get subnet details
aws rds describe-db-subnet-groups --db-subnet-group-name <subnet-group-name> --region us-west-1

# Verify EC2 and RDS are in the same VPC
# Get EC2 VPC
aws ec2 describe-instances --region us-west-1 --filters "Name=private-ip-address,Values=172.31.13.60" --query 'Reservations[0].Instances[0].VpcId'

# Get RDS VPC
aws rds describe-db-instances --db-instance-identifier designer-konva-dev --region us-west-1 --query 'DBInstances[0].DBSubnetGroup.VpcId'
```

## Common Issues and Solutions

### 1. RDS Not Publicly Accessible
If RDS is not publicly accessible and EC2 is in the same VPC, this is fine. Just ensure security groups are configured correctly.

### 2. Different VPCs
If EC2 and RDS are in different VPCs, you need:
- VPC Peering
- Or make RDS publicly accessible
- Or use a bastion host

### 3. Wrong Database Name
Ensure your DATABASE_URL uses the correct database name that exists in RDS.

### 4. Network ACLs
Check if there are any Network ACLs blocking traffic:
```bash
# Get subnet Network ACL
SUBNET_ID="subnet-XXXXXXXX"
aws ec2 describe-network-acls --region us-west-1 --filters "Name=association.subnet-id,Values=$SUBNET_ID"
```

## Environment Variable Format

Ensure your DATABASE_URL is formatted correctly:
```
DATABASE_URL="postgresql://username:password@designer-konva-dev.cjyk6pbmwqld.us-west-1.rds.amazonaws.com:5432/database_name?schema=public"
```

## Quick Diagnostic Script

Save this as `diagnose-rds.sh` on your EC2 instance:

```bash
#!/bin/bash

echo "=== RDS Connection Diagnostics ==="
echo

echo "1. Testing DNS resolution..."
nslookup designer-konva-dev.cjyk6pbmwqld.us-west-1.rds.amazonaws.com

echo -e "\n2. Testing network connectivity..."
nc -zv designer-konva-dev.cjyk6pbmwqld.us-west-1.rds.amazonaws.com 5432

echo -e "\n3. Checking local network configuration..."
ip addr show
ip route show

echo -e "\n4. Testing PostgreSQL connection..."
PGPASSWORD=$DB_PASSWORD psql -h designer-konva-dev.cjyk6pbmwqld.us-west-1.rds.amazonaws.com -p 5432 -U $DB_USER -d $DB_NAME -c "SELECT version();"
```

Make it executable and run:
```bash
chmod +x diagnose-rds.sh
./diagnose-rds.sh
```
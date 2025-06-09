#!/bin/bash
# Script to create SSH tunnel to RDS PostgreSQL via bastion host

# You'll need to update the RDS endpoint when you create the PostgreSQL instance
# For now, using placeholder
RDS_ENDPOINT="your-postgres-instance.rds.amazonaws.com"
RDS_ENDPOINT="designer-dev.cncask2wa433.us-west-1.rds.amazonaws.com" # UPDATE THIS

echo "Starting SSH tunnel to RDS PostgreSQL..."
echo "Local port 5432 -> RDS PostgreSQL port 5432"
echo "Press Ctrl+C to stop the tunnel"

ssh -i ~/.ssh/lfg-2.pem -N -L 5432:${RDS_ENDPOINT}:5432 ec2-user@50.18.129.148
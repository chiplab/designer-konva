#!/bin/bash
# Stable SSH tunnel to RDS PostgreSQL with auto-reconnection and keepalive

RDS_ENDPOINT="designer-dev.cncask2wa433.us-west-1.rds.amazonaws.com"
BASTION_HOST="50.18.129.148"
BASTION_USER="ec2-user"
SSH_KEY="~/.ssh/lfg-1.pem"
LOCAL_PORT=5432
REMOTE_PORT=5432

# Function to check if tunnel is active
check_tunnel() {
    # Check if port 5432 is listening
    lsof -i :$LOCAL_PORT -sTCP:LISTEN > /dev/null 2>&1
    return $?
}

# Kill any existing tunnel on the same port
kill_existing_tunnel() {
    echo "Checking for existing tunnels on port $LOCAL_PORT..."
    existing_pid=$(lsof -ti :$LOCAL_PORT)
    if [ ! -z "$existing_pid" ]; then
        echo "Found existing process $existing_pid on port $LOCAL_PORT, killing it..."
        kill -9 $existing_pid 2>/dev/null
        sleep 1
    fi
}

# Start the tunnel with keepalive settings
start_tunnel() {
    echo "Starting SSH tunnel to RDS PostgreSQL..."
    echo "Local port $LOCAL_PORT -> RDS PostgreSQL port $REMOTE_PORT"
    
    ssh -i $SSH_KEY \
        -o ServerAliveInterval=30 \
        -o ServerAliveCountMax=3 \
        -o TCPKeepAlive=yes \
        -o ExitOnForwardFailure=yes \
        -o StrictHostKeyChecking=no \
        -N -L $LOCAL_PORT:${RDS_ENDPOINT}:$REMOTE_PORT \
        ${BASTION_USER}@${BASTION_HOST} &
    
    SSH_PID=$!
    echo "SSH tunnel started with PID: $SSH_PID"
    
    # Wait a moment for the tunnel to establish
    sleep 2
    
    # Check if tunnel is working
    if check_tunnel; then
        echo "✅ SSH tunnel established successfully!"
        return 0
    else
        echo "❌ Failed to establish SSH tunnel"
        return 1
    fi
}

# Main execution
echo "=== RDS SSH Tunnel Manager ==="

# Kill any existing tunnel first
kill_existing_tunnel

# Start the tunnel
if start_tunnel; then
    echo ""
    echo "Tunnel is running. Press Ctrl+C to stop."
    echo ""
    
    # Keep the script running and monitor the tunnel
    while true; do
        if ! check_tunnel; then
            echo ""
            echo "⚠️  Tunnel appears to be down. Attempting to restart..."
            kill_existing_tunnel
            if start_tunnel; then
                echo "✅ Tunnel restarted successfully!"
            else
                echo "❌ Failed to restart tunnel. Exiting."
                exit 1
            fi
        fi
        sleep 10
    done
else
    echo "Failed to start SSH tunnel. Please check your configuration."
    exit 1
fi
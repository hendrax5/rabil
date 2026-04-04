#!/bin/bash
set -e

# Replace SQL variables
sed -i "s/server = \".*\"/server = \"${DB_HOST:-db}\"/" /etc/freeradius/3.0/mods-available/sql
sed -i "s/port = .*/port = ${DB_PORT:-3306}/" /etc/freeradius/3.0/mods-available/sql
sed -i "s/login = \".*\"/login = \"${DB_USER:-root}\"/" /etc/freeradius/3.0/mods-available/sql
sed -i "s/password = \".*\"/password = \"${DB_PASSWORD}\"/" /etc/freeradius/3.0/mods-available/sql
sed -i "s/radius_db = \".*\"/radius_db = \"${DB_NAME:-aibill_radius}\"/" /etc/freeradius/3.0/mods-available/sql

# Replace REST module connect_uri
sed -i "s|connect_uri = \".*\"|connect_uri = \"${API_URL:-http://app:3000}\"|" /etc/freeradius/3.0/mods-available/rest

# Ensure filter_username is commented out for PPPoE support
sed -i 's/^\(\s*\)filter_username/\1#filter_username #/' /etc/freeradius/3.0/sites-available/default

# Setup Native Routing to VPN Tunnels without NAT
echo "Configuring zero-NAT routing for Mikrotik VPN links..."
L2TP_IP=$(getent hosts aibill-l2tp | awk '{ print $1 }')
if [ -n "$L2TP_IP" ]; then
    echo "Routing 172.26.0.0/24 directly via L2TP Server ($L2TP_IP)..."
    ip route add 172.26.0.0/24 via "$L2TP_IP" 2>/dev/null || true
    # Fallback to old route if needed
    ip route add 192.168.42.0/24 via "$L2TP_IP" 2>/dev/null || true
fi

WG_IP=$(getent hosts aibill-vpn | awk '{ print $1 }')
if [ -n "$WG_IP" ]; then
    echo "Routing 10.8.0.0/24 directly via WireGuard Server ($WG_IP)..."
    ip route add 10.8.0.0/24 via "$WG_IP" 2>/dev/null || true
fi

echo "Starting FreeRADIUS in foreground..."
exec freeradius -X

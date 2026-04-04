#!/bin/bash
set -e

echo "Waiting for database to be ready..."
# A simple wait for DB loop before Prisma tries to connect
while ! mysqladmin ping -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASSWORD" --ssl=0 --silent; do
    echo "Waiting for database connection at $DB_HOST..."
    sleep 3
done
echo "Database is ready!"

echo "Running Database Schema Push..."
# Check Prisma scheme version or push changes
npx prisma db push --accept-data-loss --skip-generate || echo "Database push encountered an issue. Ignoring to resume boot..."

echo "Fixing radius tables if needed..."
mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASSWORD" --ssl=0 "$DB_NAME" < prisma/migrations/fix_radacct_groupname/migration.sql || echo "Could not run db:fix-radius automatically, please check manually."

# Seed Database
echo "Running Database Seeding..."
npx tsx prisma/seeds/seed-all.ts || echo "Seed might have partially failed or already been seeded. It is safe to continue."

# Set up VPN L2TP sync script for ipsec-vpn-server container
echo "Initializing L2TP Sync scripts for IPsec LNS Container..."
mkdir -p /vpn_data
cat << 'EOF' > /vpn_data/sync-secrets.sh
#!/bin/bash
# This script is automatically sourced by hwdsl2/ipsec-vpn-server on boot
echo "Starting AIBILL chap-secrets live syc engine in background..."
(
    # Disable NAT permanently
    iptables -t nat -F POSTROUTING
    iptables -t nat -A POSTROUTING -s 192.168.42.0/24 -j RETURN
    
    while true; do
        if [ -f "/vpn_data/chap-secrets" ]; then
            cat "/vpn_data/chap-secrets" > /etc/ppp/chap-secrets
        fi
        sleep 5
    done
) &
EOF
chmod +x /vpn_data/sync-secrets.sh
if [ ! -f "/vpn_data/chap-secrets" ]; then
    touch "/vpn_data/chap-secrets"
fi

# Set up VPN direct routing
echo "Routing VPN subnets directly to VPN containers..."
L2TP_IP=$(getent hosts aibill-l2tp | awk '{ print $1 }')
if [ -n "$L2TP_IP" ]; then
    ip route add 172.26.0.0/24 via "$L2TP_IP" 2>/dev/null || true
    ip route add 192.168.42.0/24 via "$L2TP_IP" 2>/dev/null || true
fi

WG_IP=$(getent hosts aibill-vpn | awk '{ print $1 }')
if [ -n "$WG_IP" ]; then
    ip route add 10.8.0.0/24 via "$WG_IP" 2>/dev/null || true
fi

# Start Next.js App
echo "Starting Next.js App..."
exec npm run start

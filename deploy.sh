#!/bin/bash

# =========================================================
# AIBILL RADIUS - Production Deployment Script
# Digunakan untuk menerapkan pembaruan terbaru dari GitHub
# =========================================================

# Menghentikan script jika ada perintah yang gagal (Error handling)
set -e

echo "============================================"
echo "🚀 Memulai Deployment AIBILL ke Production..."
echo "============================================"

# 1. Pastikan berada di direktori project
# cd "$(dirname "$0")"

# 2. Ambil perubahan terbaru dari GitHub (Paksa overwrite secara brutal jika ada conflict)
echo "📦 [1/4] Mengambil source code terbaru dari GitHub..."
git fetch origin
git reset --hard origin/master
# Jika branch utama Anda bernama 'master', ubah tulisan 'main' di atas menjadi 'master'

# 3. Generate .env File dengan Standar Security Tinggi jika belum ada
echo "🔐 [2/4] Mengecek konfigurasi environment (.env) production..."
if [ ! -f .env ]; then
    echo "⚠️ File .env tidak ditemukan! Membuat konfigurasi .env baru dengan enkripsi tingkat tinggi..."
    
    # Generate high entropy random strings
    SECURE_NEXTAUTH_SECRET=$(openssl rand -base64 32)
    SECURE_DB_PASS=$(openssl rand -hex 16)
    SECURE_VPN_PSK=$(openssl rand -hex 24)
    SECURE_VPN_PASS=$(openssl rand -hex 12)
    
    cat <<EOF > .env
# Database - Secure MySQL Credentials
DB_USER="root"
DB_PASSWORD="${SECURE_DB_PASS}"
DB_NAME="aibill_radius"
DATABASE_URL="mysql://root:${SECURE_DB_PASS}@db:3306/aibill_radius?connection_limit=250&pool_timeout=40"

# Timezone
TZ="Asia/Jakarta"
NEXT_PUBLIC_TIMEZONE="Asia/Jakarta"

# App Configuration
NEXT_PUBLIC_APP_NAME="AIBILL RADIUS ISP"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# NextAuth Security Token (Randomized)
NEXTAUTH_SECRET="${SECURE_NEXTAUTH_SECRET}"
NEXTAUTH_URL="http://localhost:3000"

# VPN Secrets (Randomized)
VPN_IPSEC_PSK="${SECURE_VPN_PSK}"
VPN_USER="admin"
VPN_PASSWORD="${SECURE_VPN_PASS}"
EOF
    echo "✅ File .env berhasil di-generate dengan kredensial secure!"
else
    echo "✅ Konfigurasi .env sudah ada, skip generate."
fi

# 4. Hapus environment lama (membersihkan iptables & rule lama)
echo "🧹 [3/4] Menghentikan kontainer yang sedang berjalan..."
docker-compose down

# 5. Bangun ulang struktur container tanpa cache (memastikan package.json & library baru terinstall)
echo "🏗️ [4/4] Membangun ulan dan menyalakan server (Build & Run)..."
docker-compose up -d --build --remove-orphans

# 5. Selesai
echo "============================================"
echo "✅ Deployment Berhasil!"
echo "📡 Cek status VPN: docker ps"
echo "📜 Lihat log VPN: docker logs aibill-vpn --tail 50"
echo "📜 Lihat log Panel: docker logs aibill-app --tail 50"
echo "============================================"

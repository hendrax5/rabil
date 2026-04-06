#!/bin/bash

# =========================================================
# NexaRadius - High-End Production Deployment Script
# Supports: Automatic OS Detection, Package Installs,
# SSL/HTTPS Automation (Caddy Let's Encrypt), and .env Management
# =========================================================

# Menghentikan script jika ada perintah yang gagal
set -e

# Warna untuk output bash
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}====================================================${NC}"
echo -e "${CYAN}🚀 Memulai Deployment NexaRadius (HTTPS Supported)${NC}"
echo -e "${CYAN}====================================================${NC}"

# ==========================================
# 0. Check Root Privileges
# ==========================================
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}❌ Script ini harus dijalankan sebagai root (gunakan sudo ./deploy.sh)${NC}"
  exit 1
fi

# ==========================================
# 1. Deteksi Sistem Operasi
# ==========================================
echo -e "\n${YELLOW}🔍 [1/6] Mendeteksi Sistem Operasi...${NC}"

if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VERSION_ID=$VERSION_ID
    echo -e "${GREEN}✅ Sistem terdeteksi: $NAME ($VERSION_ID)${NC}"
else
    echo -e "${RED}❌ Tidak dapat mendeteksi sistem operasi!${NC}"
    exit 1
fi

# ==========================================
# 2. Instalasi Dependensi Secara Otomatis
# ==========================================
echo -e "\n${YELLOW}📦 [2/6] Memeriksa & Menginstal Dependensi Sistem...${NC}"

install_packages() {
    local packages=("$@")
    if [ "$OS" == "ubuntu" ] || [ "$OS" == "debian" ]; then
        apt-get update -y
        apt-get install -y "${packages[@]}"
    elif [ "$OS" == "centos" ] || [ "$OS" == "rhel" ] || [ "$OS" == "almalinux" ] || [ "$OS" == "rocky" ]; then
        yum install -y epel-release || true
        yum install -y "${packages[@]}"
    else
        echo -e "${YELLOW}⚠️ OS $OS tidak dikenali / didukung secara otomatis untuk instalasi package.${NC}"
        echo "Harap pastikan packages ini terinstall: ${packages[*]}"
    fi
}

PACKAGES_NEEDED=("curl" "git" "openssl" "iptables" "lsof" "wget")
install_packages "${PACKAGES_NEEDED[@]}"

# Instalasi Docker & Docker Compose jika belum ada
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}🐳 Docker belum terinstal. Menginstal Docker...${NC}"
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    systemctl enable --now docker
else
    echo -e "${GREEN}✅ Docker sudah terinstal.${NC}"
fi

if command -v docker-compose &> /dev/null; then
    DOCKER_CMD="docker-compose"
elif docker --help | grep -q "compose"; then
    DOCKER_CMD="docker compose"
else
    echo -e "${YELLOW}🐳 Menginstal Docker Compose plugin...${NC}"
    if [ "$OS" == "ubuntu" ] || [ "$OS" == "debian" ]; then
        apt-get install -y docker-compose-plugin
    elif [ "$OS" == "centos" ] || [ "$OS" == "rhel" ] || [ "$OS" == "almalinux" ] || [ "$OS" == "rocky" ]; then
        yum install -y docker-compose-plugin
    fi
    DOCKER_CMD="docker compose"
fi
echo -e "${GREEN}✅ Menggunakan perintah Docker: $DOCKER_CMD${NC}"


# ==========================================
# 3. Sinkronisasi Source Code Terbaru
# ==========================================
echo -e "\n${YELLOW}📥 [3/6] Mengambil source code terbaru dari Repositori...${NC}"
git fetch origin
git reset --hard origin/master || git reset --hard origin/main

# ==========================================
# 4. Interactive Configuration & SSL (HTTPS)
# ==========================================
echo -e "\n${YELLOW}🔐 [4/6] Konfigurasi Environment & HTTPS...${NC}"

# Nilai default
APP_DOMAIN="localhost"
SSL_EMAIL="admin@localhost"

# Prompt ke user
echo -e "Untuk menggunakan HTTPS, Anda perlu mengatur nama domain yang sudah ditargetkan (A Record) ke IP Server ini."
read -p "Masukkan nama Domain Anda (contoh: billing.nexa.net) [Kosongkan jika hanya akses via IP Lokal]: " input_domain

if [ -n "$input_domain" ]; then
    APP_DOMAIN=$input_domain
    echo -e "Sertifikat SSL Let's Encrypt membutuhkan alamat email untuk registrasi/notifikasi renewal."
    read -p "Masukkan alamat Email Anda (contoh: admin@nexa.net): " input_email
    if [ -n "$input_email" ]; then
        SSL_EMAIL=$input_email
    fi
    echo -e "${GREEN}✅ HTTPS/SSL akan diaktifkan untuk domain: $APP_DOMAIN${NC}"
else
    echo -e "${YELLOW}⚠️ Tidak ada domain yang dimasukkan. HTTPS otomatis tidak berfungsi maksimal, sistem berjalan di HTTP localhost / IP saja.${NC}"
fi


if [ ! -f .env ]; then
    echo -e "${YELLOW}⚙️ File .env tidak ditemukan! Membuat konfigurasi .env aman baru...${NC}"
    
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

# Web SSL & Domain Configuration (Digunakan oleh Caddy Proxy)
APP_DOMAIN="${APP_DOMAIN}"
SSL_EMAIL="${SSL_EMAIL}"

# App Configuration
NEXT_PUBLIC_APP_NAME="NexaRadius ISP"
NEXT_PUBLIC_APP_URL="https://${APP_DOMAIN}"

# NextAuth Security Token
NEXTAUTH_SECRET="${SECURE_NEXTAUTH_SECRET}"
NEXTAUTH_URL="https://${APP_DOMAIN}"

# VPN Secrets (Randomized)
VPN_IPSEC_PSK="${SECURE_VPN_PSK}"
VPN_USER="admin"
VPN_PASSWORD="${SECURE_VPN_PASS}"
EOF
    echo -e "${GREEN}✅ File .env berhasil di-generate!${NC}"
else
    echo -e "${GREEN}✅ File .env sudah ada. Mengupdate konfigurasi Domain HTTPS...${NC}"
    # Hapus konfigurasi lama jika ada dan tambah baru
    sed -i '/APP_DOMAIN=/d' .env
    sed -i '/SSL_EMAIL=/d' .env
    echo "APP_DOMAIN=\"${APP_DOMAIN}\"" >> .env
    echo "SSL_EMAIL=\"${SSL_EMAIL}\"" >> .env
fi

# ==========================================
# 5. Build dan Deployment
# ==========================================
echo -e "\n${YELLOW}🧹 [5/6] Menghentikan & Membersihkan kontainer yang sedang berjalan...${NC}"
$DOCKER_CMD down || true

echo -e "\n${YELLOW}🏗️ Membangun ulang dan menyalakan server (Docker Compose Build)...${NC}"
$DOCKER_CMD --env-file .env up -d --build --remove-orphans

# ==========================================
# 6. Post-Deployment (VPN Routing)
# ==========================================
echo -e "\n${YELLOW}🌐 [6/6] Menyinkronkan Routing VPN ke Host OS Linux...${NC}"
sleep 5
L2TP_IP=$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' aibill-l2tp 2>/dev/null || echo "")
if [ -n "$L2TP_IP" ]; then
    ip route add 172.26.0.0/24 via "$L2TP_IP" 2>/dev/null || true
    ip route replace 172.26.0.0/24 via "$L2TP_IP" 2>/dev/null || true
    echo -e "${GREEN}✅ Routing 172.26.0.0/24 -> $L2TP_IP berhasil ditambahkan!${NC}"
else
    echo -e "${RED}⚠️ Gagal mendeteksi IP Container L2TP. (Pastikan container aibill-l2tp berjalan)${NC}"
fi

echo -e "\n${CYAN}====================================================${NC}"
echo -e "${GREEN}🎉 Deployment NexaRadius Telah Selesai!${NC}"
if [ "$APP_DOMAIN" != "localhost" ]; then
    echo -e "${GREEN}🌐 Akses Web Panel : https://${APP_DOMAIN}${NC}"
else
    echo -e "${GREEN}🌐 Akses Web Panel : Cek IP Server Anda${NC}"
fi
echo -e "${CYAN}====================================================${NC}"
echo -e "Untuk Cek Log Container Aplikasi:"
echo -e "  docker logs aibill-app --tail 50"
echo -e "Untuk Cek Info Sertifikat SSL Caddy:"
echo -e "  docker logs aibill-caddy --tail 50"
echo -e "${CYAN}====================================================${NC}"

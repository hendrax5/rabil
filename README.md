# AIBILL RADIUS - Billing System for ISP/RTRW.NET

Modern, full-stack billing system for ISP/RTRW.NET with FreeRADIUS integration supporting both **PPPoE** and **Hotspot** authentication.

> **Latest Update**: December 6, 2025 - Session Timeout Auto-Logout, Network Map Router GPS, OLT Uplink Configuration

## 🎯 Key Features

### Core Features
- ✅ **FreeRADIUS Integration** - Full RADIUS support for PPPoE and Hotspot
- ✅ **RADIUS CoA Support** - Real-time speed changes & disconnect without reconnection
- ✅ **Multi-Router/NAS Support** - Manage multiple MikroTik routers
- ✅ **PPPoE Management** - Customer accounts with profile-based bandwidth
- ✅ **Sync PPPoE MikroTik** - Import PPPoE secrets dari MikroTik ke database
- ✅ **Hotspot Voucher System** - Advanced voucher with router assignment
- ✅ **Agent/Reseller System** - Balance-based voucher generation
- ✅ **Payment Gateway** - Midtrans, Xendit, Duitku integration
- ✅ **WhatsApp Integration** - Automated notifications & reminders
- ✅ **Role-Based Permissions** - 53 permissions, 6 role templates
- ✅ **Financial Reporting** - Income/expense tracking with categories
- ✅ **WIB Timezone** - Proper Western Indonesia Time handling

### FTTH Network Features
- 📡 **OLT Management** - Kelola Optical Line Terminal dengan router uplink
- 📦 **ODC Management** - Kelola Optical Distribution Cabinet
- 📍 **ODP Management** - Kelola Optical Distribution Point
- 👥 **Customer Assignment** - Assign pelanggan ke port ODP
- 🗺️ **Network Map** - Visualisasi interaktif jaringan FTTH
- 📏 **Distance Calculation** - Hitung jarak pelanggan ke ODP terdekat

### Router/NAS Features (NEW!)
- 🛰️ **GPS Coordinates** - Set lokasi router dengan Map Picker
- 🔗 **OLT Uplink Config** - Konfigurasi uplink dari router ke OLT
- 📊 **Interface Detection** - Auto-detect interface MikroTik
- 🌐 **Auto IP Detection** - Detect public IP otomatis

### Security Features (NEW!)
- ⏱️ **Session Timeout** - Auto logout setelah 30 menit tidak aktif
- ⚠️ **Idle Warning** - Popup warning 1 menit sebelum logout
- 🔄 **Stay Logged In** - Opsi perpanjang sesi dari popup warning
- 🔐 **Session Max Age** - Maksimal session 1 hari

### Technical Features
- 🎨 **Premium UI** - Mobile-first responsive design with dark mode
- ⚡ **Modern Stack** - Next.js 16, TypeScript, Tailwind CSS, Prisma
- 🔐 **Secure** - Built-in authentication with role-based permissions
- 📱 **SPA Experience** - Fast, smooth navigation without page reloads
- 🌍 **Multi-language** - Indonesian & English support

## 🚀 Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | MySQL 8.0 with Prisma ORM |
| RADIUS | FreeRADIUS 3.0 with MySQL backend |
| Icons | Lucide React |
| Date | date-fns with timezone support |
| Maps | Leaflet / OpenStreetMap |

## 📁 Project Structure

```
AIBILL-RADIUS/
├── src/
│   ├── app/
│   │   ├── admin/          # Admin panel pages
│   │   ├── agent/          # Agent portal
│   │   ├── api/            # API routes
│   │   ├── customer/       # Customer portal
│   │   └── page.tsx        # Landing/redirect
│   ├── components/         # React components
│   ├── hooks/              # Custom hooks
│   └── lib/                # Utilities & services
├── prisma/
│   ├── schema.prisma       # Database schema
│   ├── seed.ts             # Main seed file
│   └── seeds/              # Individual seed scripts
├── freeradius-config/      # FreeRADIUS configuration backup
│   ├── sites-enabled-default
│   ├── mods-enabled-sql
│   ├── mods-enabled-rest
│   └── clients.conf
├── backup/                 # Database backups
└── docs/                   # Documentation
```

## 🛠️ Installation

### Quick Start (New VPS)

**Option 1: VPS dengan Root Access**
```bash
# 1. Upload project to VPS
scp -r AIBILL-RADIUS-main root@YOUR_VPS_IP:/root/

# 2. SSH to VPS and run installer
ssh root@YOUR_VPS_IP
cd /root/AIBILL-RADIUS-main
chmod +x vps-install.sh
./vps-install.sh
```

**Option 2: VPS Lokal / Tanpa Root Access (Proxmox, LXC, etc)**
```bash
# 1. Upload project to VPS
scp -P PORT -r AIBILL-RADIUS-main user@YOUR_VPS_IP:~/

# 2. SSH to VPS and run local installer
ssh -p PORT user@YOUR_VPS_IP
cd ~/AIBILL-RADIUS-main
chmod +x vps-install-local.sh
./vps-install-local.sh
```

The installer will:
- Install Node.js 20, MySQL 8.0, FreeRADIUS 3.0, Nginx, PM2
- Configure database and create tables
- Setup FreeRADIUS with MySQL backend
- Configure session timeout (30 min idle, 1 day max)
- Build and start the application

### Manual Installation

See [docs/INSTALLATION-GUIDE.md](docs/INSTALLATION-GUIDE.md) for detailed manual setup.

### GenieACS TR-069 Integration

See [docs/GENIEACS-GUIDE.md](docs/GENIEACS-GUIDE.md) for complete setup and usage guide.

### Default Credentials

After installation:
- **Admin Login**: http://YOUR_VPS_IP/admin/login
- **Username**: `superadmin`
- **Password**: `admin123`

⚠️ **Change password immediately after first login!**

## 🔌 FreeRADIUS Configuration

### Key Configuration Files

Located in `/etc/freeradius/3.0/`:

| File | Purpose |
|------|---------|
| `mods-enabled/sql` | MySQL connection for user auth |
| `mods-enabled/rest` | REST API for voucher management |
| `sites-enabled/default` | Main authentication logic |
| `clients.conf` | NAS/router clients |

### Important Settings

**1. Disable filter_username** (line ~293 in default):
```
#filter_username   # DISABLED - allows username@realm format for PPPoE
```

**2. Conditional REST for Vouchers** (in post-auth section):
```
# Only call REST API for vouchers (username without @)
if (!("%{User-Name}" =~ /@/)) {
    rest.post-auth
}
```

**3. SQL Client Loading** (in mods-enabled/sql):
```
read_clients = yes
client_table = "nas"
```

### Backup FreeRADIUS Config

Backup files included in `freeradius-config/` directory:
- `sites-enabled-default` - Main site configuration
- `mods-enabled-sql` - SQL module config
- `mods-enabled-rest` - REST module config
- `clients.conf` - Client/NAS configuration
- `freeradius-config-backup.tar.gz` - Complete backup archive

To restore on new VPS:
```bash
# Extract backup
cd /tmp
tar -xzf /path/to/freeradius-config-backup.tar.gz

# Copy files
cp freeradius-backup/sites-enabled/* /etc/freeradius/3.0/sites-enabled/
cp freeradius-backup/mods-enabled/* /etc/freeradius/3.0/mods-enabled/
cp freeradius-backup/clients.conf /etc/freeradius/3.0/

# Update SQL credentials in mods-enabled/sql
# Update REST URL in mods-enabled/rest

# Test and restart
freeradius -XC
systemctl restart freeradius
```

## 🌐 RADIUS Authentication Flow

### PPPoE Users
```
MikroTik → FreeRADIUS → MySQL (radcheck/radusergroup/radgroupreply)
                     ↓
              Access-Accept with:
              - Mikrotik-Group (profile name)
              - Mikrotik-Rate-Limit (bandwidth)
```

### Hotspot Vouchers
```
MikroTik → FreeRADIUS → MySQL (radcheck/radusergroup/radgroupreply)
                     ↓
                REST API (/api/radius/post-auth)
                     ↓
              - Set firstLoginAt & expiresAt
              - Sync to Keuangan (income)
              - Track agent commission
```

### Database Tables (RADIUS)

| Table | Purpose |
|-------|---------|
| `radcheck` | User credentials (Cleartext-Password, NAS-IP-Address) |
| `radreply` | User-specific reply attributes |
| `radusergroup` | User → Group mapping |
| `radgroupcheck` | Group check attributes |
| `radgroupreply` | Group reply (Mikrotik-Rate-Limit, Session-Timeout) |
| `radacct` | Accounting/session data |
| `radpostauth` | Authentication logs |
| `nas` | NAS/Router clients |

## 📋 Features Overview

### Admin Panel Modules

1. **Dashboard** - Overview with stats and real-time data
2. **PPPoE Management** - Users and profiles with RADIUS sync
3. **Hotspot Management**
   - Multi-router/NAS support
   - Agent-based distribution
   - 8 code type combinations
   - Print templates
   - WhatsApp delivery
4. **Agent Management** - Balance, commission, sales tracking
5. **Invoices** - Billing with auto-reminder
6. **Payment Gateway** - Midtrans, Xendit, Duitku
7. **Keuangan** - Financial reporting
8. **Sessions** - Active connections monitoring
9. **WhatsApp** - Automated notifications
10. **Network** - Router/NAS, OLT, ODC, ODP
11. **GenieACS** - TR-069 CPE management ([Complete Guide](docs/GENIEACS-GUIDE.md))
    - Device list with real-time status
    - WiFi configuration (SSID, password, security)
    - Task monitoring with auto-refresh
    - Connection request trigger
    - Device details (uptime, RX power, clients)
12. **Settings** - Company, cron, backup

### Hotspot Voucher Code Types

| Type | Example | Characters |
|------|---------|------------|
| alpha-upper | ABCDEFGH | A-Z (no I,O) |
| alpha-lower | abcdefgh | a-z (no i,o) |
| alpha-mixed | AbCdEfGh | Mixed case |
| alpha-camel | aBcDeFgH | CamelCase |
| numeric | 12345678 | 1-9 only |
| alphanumeric-lower | abc12345 | a-z + 1-9 |
| alphanumeric-upper | ABC12345 | A-Z + 1-9 |
| alphanumeric-mixed | aBc12345 | Mixed + 1-9 |

### Admin Roles

| Role | Description |
|------|-------------|
| SUPER_ADMIN | Full access to all features |
| FINANCE | Invoices, payments, reports |
| CUSTOMER_SERVICE | User management, support |
| TECHNICIAN | Network, router, sessions |
| MARKETING | Reports, customer data |
| VIEWER | Read-only access |

## 🔧 Useful Commands

### Application Management
```bash
pm2 status                    # Check status
pm2 logs aibill-radius        # View logs
pm2 restart aibill-radius     # Restart app
pm2 stop aibill-radius        # Stop app
```

### FreeRADIUS Management
```bash
systemctl status freeradius   # Check status
systemctl restart freeradius  # Restart
freeradius -X                 # Debug mode (stop service first)
freeradius -XC                # Test configuration
```

### RADIUS Testing
```bash
# Test PPPoE user
radtest 'user@realm' 'password' 127.0.0.1 0 testing123

# Test Hotspot voucher
radtest 'vouchercode' 'password' 127.0.0.1 0 testing123
```

### Database Management
```bash
# Connect to database
mysql -u aibill_user -paibillradius123 aibill_radius

# Backup database
mysqldump -u aibill_user -paibillradius123 aibill_radius > backup.sql

# Restore database
mysql -u aibill_user -paibillradius123 aibill_radius < backup.sql
```

## 🔐 Security

### Best Practices
1. Change default admin password immediately
2. Change MySQL passwords
3. Setup SSL certificate (Let's Encrypt)
4. Configure firewall (ufw)
5. Regular database backups
6. Monitor application logs

### Firewall Rules
```bash
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 1812/udp  # RADIUS Auth
ufw allow 1813/udp  # RADIUS Accounting
ufw allow 3799/udp  # RADIUS CoA
```

## 📡 RADIUS CoA (Change of Authorization)

CoA allows real-time changes to active PPPoE sessions without disconnecting users.

### Features
- **Speed Change** - Update bandwidth instantly via CoA
- **Session Disconnect** - Terminate sessions remotely
- **Profile Sync** - Auto-apply profile changes to all active sessions
- **Direct to NAS** - CoA sent directly to MikroTik, not via FreeRADIUS

### MikroTik Requirements
```
/radius incoming set accept=yes port=3799
```

### API Endpoints

**Check CoA Status:**
```bash
GET /api/radius/coa
```

**Disconnect User:**
```bash
POST /api/radius/coa
{
  "action": "disconnect",
  "username": "user@realm"
}
```

**Update Speed:**
```bash
POST /api/radius/coa
{
  "action": "update",
  "username": "user@realm",
  "attributes": {
    "downloadSpeed": 20,
    "uploadSpeed": 10
  }
}
```

**Sync Profile to All Sessions:**
```bash
POST /api/radius/coa
{
  "action": "sync-profile",
  "profileId": "profile-uuid"
}
```

**Test CoA Connection:**
```bash
POST /api/radius/coa
{
  "action": "test",
  "host": "103.191.165.156"
}
```

### Auto-Sync on Profile Edit
When you edit a PPPoE profile's speed, the system automatically:
1. Updates radgroupreply in database
2. Finds all active sessions using that profile
3. Sends CoA to each MikroTik NAS
4. Speed changes instantly without disconnect

### Troubleshooting CoA
```bash
# Test radclient
radtest testuser password 127.0.0.1 0 testing123

# Check if radclient installed
which radclient

# Install if missing
apt install freeradius-utils

# Debug CoA
echo "User-Name=testuser" | radclient -x 103.191.165.156:3799 coa secret123
```

### WhatsApp Providers Configuration

| Provider | Base URL | API Key Format |
|----------|----------|----------------|
| **Fonnte** | `https://api.fonnte.com/send` | Token from Fonnte dashboard |
| **WAHA** | `http://IP:PORT` (e.g., `http://10.0.0.1:3000`) | WAHA API Key |
| **GOWA** | `http://IP:PORT` (e.g., `http://10.0.0.1:2451`) | `username:password` |
| **MPWA** | `http://IP:PORT` | MPWA API Key |
| **Wablas** | `https://pati.wablas.com` | Wablas Token |

## 📊 Database Backup

Latest backup: `backup/aibill_radius_backup_20251204.sql`

To restore:
```bash
mysql -u aibill_user -paibillradius123 aibill_radius < backup/aibill_radius_backup_20251204.sql
```

## 📝 Changelog

### December 6, 2025 (v2.3) - Session & Network Improvements
- ✅ **Session Timeout** - Auto logout setelah 30 menit tidak aktif
- ✅ **Idle Warning Popup** - Warning 1 menit sebelum logout dengan countdown
- ✅ **Stay Logged In** - Tombol perpanjang sesi dari warning popup
- ✅ **Fix Logout Redirect** - Gunakan `redirect: false` + manual redirect untuk hindari NEXTAUTH_URL issue
- ✅ **Router GPS** - Tambah koordinat GPS untuk router/NAS dengan Map Picker
- ✅ **Auto GPS** - Deteksi lokasi otomatis dari browser (HTTPS required)
- ✅ **OLT Uplink Config** - Konfigurasi uplink dari router ke OLT dengan interface dropdown
- ✅ **MikroTik Interfaces API** - Endpoint baru untuk fetch interface dari router
- ✅ **Network Map Enhancement** - Tampilkan uplink info di popup router
- ✅ **Fix Layout Loading** - Perbaiki sidebar tidak muncul saat pertama login
- ✅ **Installer Baru** - `vps-install-local.sh` untuk VPS tanpa root access

### December 5, 2025 (v2.2) - FTTH Network Management
- ✅ **Network Map** - Visualisasi interaktif jaringan FTTH di peta
- ✅ **OLT Management** - CRUD OLT dengan assignment router
- ✅ **ODC Management** - CRUD ODC terhubung ke OLT  
- ✅ **ODP Management** - CRUD ODP dengan parent ODC/ODP
- ✅ **Customer Assignment** - Assign pelanggan ke port ODP
- ✅ **Sync PPPoE MikroTik** - Import PPPoE secrets dari MikroTik
- ✅ **WhatsApp Maintenance Template** - Template gangguan/maintenance
- ✅ **FreeRADIUS BOM Fix** - Auto remove UTF-16 BOM dari config files

### December 4, 2025 (v2.2) - System Improvements
- ✅ **Admin Management** - Fixed permission checkboxes not showing
- ✅ **Settings/Cron** - Complete page rewrite with teal theme
- ✅ **Settings/Database** - Complete page rewrite with Telegram backup
- ✅ **Agent Dashboard** - Fixed API paths, Router column added to voucher table
- ✅ **Payment Gateway** - Added validation for deposit (show error if not configured)
- ✅ **WhatsApp Providers** - Multi-provider support (Fonnte, WAHA, GOWA, MPWA, Wablas)
- ✅ **FreeRADIUS Config** - Updated backup configs from production
- ✅ **Install Wizard** - Added FreeRADIUS config restore option
- ✅ **vps-install.sh** - Updated with FreeRADIUS config restore

### December 4, 2025 (v2.1) - GenieACS WiFi Management
- ✅ **GenieACS TR-069 Integration** - Complete CPE management via Web UI
- ✅ **WiFi Configuration** - Edit SSID, password, security mode (WPA/WPA2/Open)
- ✅ **Real-time Updates** - Changes applied instantly without waiting periodic inform
- ✅ **Task Monitoring** - Track all TR-069 tasks with auto-refresh
- ✅ **Multi-WLAN Support** - Manage WiFi 2.4GHz, 5GHz, and Guest networks
- ✅ **Force Sync** - Manual connection request trigger
- ✅ **Device Details** - View ONT info, uptime, RX power, WiFi clients
- ✅ Fixed GenieACS menu structure (separate from Settings)

### December 3, 2025 (v2.0)
- ✅ **RADIUS CoA Support** - Real-time speed changes & disconnect
- ✅ CoA sent directly to MikroTik NAS (not FreeRADIUS)
- ✅ Auto-sync profile changes to active sessions
- ✅ `/api/radius/coa` endpoint for CoA operations
- ✅ Router secret from database for CoA authentication
- ✅ Fixed FreeRADIUS PPPoE authentication
- ✅ Disabled `filter_username` policy for realm-style usernames
- ✅ Added conditional REST for voucher-only post-auth
- ✅ Fixed post-auth API to allow unmanaged vouchers
- ✅ Added NAS-IP-Address sync for PPPoE users
- ✅ Updated FreeRADIUS config backup

### December 2, 2025
- ✅ Agent voucher system with balance management
- ✅ Router/NAS assignment for vouchers
- ✅ Fixed generate-voucher routerId handling
- ✅ Multi-router support improvements

### Previous Updates
- Agent deposit system with payment gateway
- GenieACS integration for TR-069
- Real-time bandwidth monitoring
- Session disconnect via MikroTik API

## 📚 Documentation

| File | Description |
|------|-------------|
| [docs/INSTALLATION-GUIDE.md](docs/INSTALLATION-GUIDE.md) | Complete VPS installation |
| [docs/GENIEACS-GUIDE.md](docs/GENIEACS-GUIDE.md) | GenieACS TR-069 setup & WiFi management |
| [docs/AGENT_DEPOSIT_SYSTEM.md](docs/AGENT_DEPOSIT_SYSTEM.md) | Agent balance & deposit |
| [docs/RADIUS-CONNECTIVITY.md](docs/RADIUS-CONNECTIVITY.md) | RADIUS architecture |
| [docs/FREERADIUS-SETUP.md](docs/FREERADIUS-SETUP.md) | FreeRADIUS configuration guide |

## 📝 License

MIT License - Free for commercial and personal use

## 👨‍💻 Development

Built with ❤️ for Indonesian ISPs

**Important**: Always use `formatWIB()` and `toWIB()` functions when displaying dates to users.

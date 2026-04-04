# Changelog

All notable changes to AIBILL RADIUS will be documented in this file.

## [2.3.0] - 2025-12-06

### 🔒 Security & Session Management

#### 1. Session Timeout / Auto Logout
- **Idle Detection:** Auto logout setelah 30 menit tidak aktif
- **Warning Modal:** Peringatan 60 detik sebelum logout dengan countdown timer
- **Activity Tracking:** Mouse move, keypress, scroll, click, touch reset timer
- **Tab Visibility:** Timer pause saat tab tidak aktif, resume saat aktif kembali
- **Session Max Age:** Dikurangi dari 30 hari ke 1 hari untuk keamanan

**Files:**
- `src/hooks/useIdleTimeout.ts` (NEW) - Hook untuk idle detection
- `src/app/admin/layout.tsx` (UPDATED) - Integrasi idle timeout + warning modal
- `src/app/admin/login/page.tsx` (UPDATED) - Tampilkan pesan jika logout karena idle
- `src/lib/auth.ts` (UPDATED) - Session maxAge=1 hari, updateAge=1 jam

#### 2. Fix Logout Redirect ke Localhost
- **Problem:** Logout redirect ke localhost:3000 bukan server IP
- **Root Cause:** NEXTAUTH_URL masih localhost di .env
- **Solution:** Gunakan `signOut({ redirect: false })` + `window.location.href`

#### 3. Fix Layout Tidak Muncul Saat Login
- **Problem:** Menu/sidebar kadang tidak muncul setelah login
- **Solution:** Tambah loading state, pisahkan useEffects, proper redirect handling

### 📍 Router GPS Tracking

#### 4. Router GPS Coordinates
- Tambah kolom latitude/longitude di tabel router
- Map picker untuk memilih lokasi router
- Location search dengan autocomplete
- Tampilkan router di Network Map

**Files:**
- `prisma/schema.prisma` (UPDATED) - latitude, longitude di model router
- `src/app/admin/network/routers/page.tsx` (UPDATED) - Form GPS + Map
- `src/components/MapPicker.tsx` (UPDATED) - Support router locations

### 🔌 Network Enhancements

#### 5. OLT Uplink Configuration
- Konfigurasi uplink dari router ke OLT
- Fetch interface list dari MikroTik router
- Pilih port yang digunakan untuk uplink

**Files:**
- `src/app/api/network/routers/[id]/interfaces/route.ts` (NEW) - Fetch interfaces
- `src/app/api/network/routers/[id]/uplinks/route.ts` (UPDATED) - CRUD uplinks
- `src/app/admin/network/routers/page.tsx` (UPDATED) - Modal OLT Uplink

#### 6. Network Map Enhancement
- Tampilkan uplink info di popup router
- Marker untuk router dengan GPS coordinates
- Connection lines dari router ke OLT via uplinks

#### 7. Fix DELETE API untuk OLT/ODC/ODP
- Accept `id` dari body JSON sebagai fallback (sebelumnya hanya query param)

### 📦 Installer Scripts

#### 8. vps-install-local.sh (NEW)
- Installer untuk VPS tanpa akses root langsung (pakai sudo)
- Cocok untuk: Proxmox VM, LXC Container, Local Server
- Sama fiturnya dengan vps-install.sh

### 📚 Documentation Updates
- README.md - Fitur baru, changelog v2.3
- CHAT_MEMORY.md - Session timeout, logout fix, GPS tracking
- install-wizard.html - Session security, dual installer options

---

## [1.4.1] - 2025-12-06

### 🚀 New Features

#### 1. Network Map Page
- Visualisasi semua OLT, ODC, ODP di peta interaktif
- Filter berdasarkan OLT dan ODC
- Toggle visibility untuk setiap layer (OLT, ODC, ODP, Pelanggan, Koneksi)
- Garis koneksi antar perangkat (OLT-ODC, ODC-ODP)
- Statistik total perangkat dan port
- Legenda warna untuk setiap tipe perangkat

**Files:**
- `src/app/admin/network/map/page.tsx` (NEW)
- `src/app/admin/layout.tsx` (UPDATED - added Network Map menu)
- `src/locales/id.json` (UPDATED)
- `src/locales/en.json` (UPDATED)

### 🐛 Bug Fixes

#### 2. FreeRADIUS BOM (Byte Order Mark) Issue
- Fixed UTF-16 BOM detection and removal in config files
- Added `freeradius-rest` package to installation
- Updated REST module pool settings for lazy connection (start=0)
- Improved `remove_bom()` function to handle UTF-16 LE/BE encoding

**Files:**
- `vps-install.sh` (UPDATED)
- `freeradius-config/mods-enabled-rest` (UPDATED)
- `docs/install-wizard.html` (UPDATED - added BOM troubleshooting)

**Problem:** FreeRADIUS config files (especially clients.conf) might have UTF-16 BOM when uploaded from Windows, causing silent parse failure.

**Solution:** Enhanced installer to detect and convert UTF-16 to UTF-8, and remove all types of BOM markers.

---

## [1.4.0] - 2025-12-05

### 🚀 New Features

#### 1. Sync PPPoE Users dari MikroTik
- Import PPPoE secrets dari MikroTik router ke database
- Preview user sebelum import
- Pilih user yang ingin di-import
- Hitung jarak GPS untuk setiap user
- Sinkronisasi otomatis ke tabel RADIUS (radcheck, radusergroup, radreply)

**Files:**
- `src/app/api/pppoe/users/sync-mikrotik/route.ts` (NEW)
- `src/app/admin/pppoe/users/page.tsx` (UPDATED)

#### 2. WhatsApp Template Gangguan (Maintenance-Outage)
- Tambah template baru untuk notifikasi gangguan jaringan
- Auto-create missing templates
- Variables: `{{issueType}}`, `{{affectedArea}}`, `{{description}}`, `{{estimatedTime}}`

**Files:**
- `src/app/api/whatsapp/templates/route.ts` (UPDATED)

#### 3. FTTH Network Management
- **OLT Management** (`/admin/network/olts`)
  - CRUD OLT (Optical Line Terminal)
  - Assignment ke multiple router
  - GPS location dengan Map picker
  
- **ODC Management** (`/admin/network/odcs`)
  - CRUD ODC (Optical Distribution Cabinet)
  - Link ke OLT dengan PON port
  - Filter berdasarkan OLT
  
- **ODP Management** (`/admin/network/odps`)
  - CRUD ODP (Optical Distribution Point)
  - Connect ke ODC atau Parent ODP
  - Konfigurasi port count
  
- **Customer Assignment** (`/admin/network/customers`)
  - Assign pelanggan ke port ODP
  - Pencarian nearest ODP dengan perhitungan jarak
  - Lihat port yang tersedia

**Files:**
- `src/app/admin/network/olts/page.tsx` (NEW)
- `src/app/admin/network/odcs/page.tsx` (NEW)
- `src/app/admin/network/odps/page.tsx` (NEW)
- `src/app/admin/network/customers/page.tsx` (NEW)
- `src/app/admin/layout.tsx` (UPDATED - menu)
- `src/locales/id.json` (UPDATED - translations)
- `src/locales/en.json` (UPDATED - translations)

### 🔧 Improvements

#### Auto GPS Error Handling
- Pesan error spesifik untuk setiap jenis error GPS
- Feedback sukses saat GPS berhasil
- Timeout ditingkatkan ke 15 detik

**Files:**
- `src/app/admin/network/olts/page.tsx`
- `src/app/admin/network/odcs/page.tsx`
- `src/app/admin/network/odps/page.tsx`

---

## [1.3.1] - 2025-01-06

### 🔧 Fix: FreeRADIUS Config BOM Issue

#### Problem
- FreeRADIUS tidak binding ke port 1812/1813 pada instalasi fresh di Proxmox VPS
- SQL module menampilkan "Ignoring sql" dan tidak loading
- REST module tidak loading

#### Root Cause
- File konfigurasi FreeRADIUS memiliki UTF-16 BOM (Byte Order Mark) character di awal file
- BOM (0xFFFE) menyebabkan FreeRADIUS silent fail saat parsing config
- Ini terjadi jika file di-edit di Windows atau dengan editor yang menyimpan UTF-8/16 BOM

#### Solution
1. **Added BOM removal function** di `vps-install.sh`
   ```bash
   remove_bom() {
       sed -i '1s/^\xEF\xBB\xBF//' "$1"
   }
   ```

2. **Updated install-wizard.html** dengan instruksi BOM removal
3. **Updated FREERADIUS-SETUP.md** dengan troubleshooting guide
4. **Synced freeradius-config/** folder dari VPS production yang sudah berjalan

#### Files Changed
- `vps-install.sh` - Added BOM removal after copying config files
- `docs/install-wizard.html` - Added BOM warning and removal commands
- `docs/FREERADIUS-SETUP.md` - Added BOM troubleshooting section
- `freeradius-config/sites-enabled-default` - Updated from working VPS

#### Verification
```bash
# Check if file has BOM
xxd /etc/freeradius/3.0/mods-available/sql | head -1
# Good: starts with "7371 6c" (sql)
# Bad: starts with "fffe" or "efbb bf" (BOM)

# Verify FreeRADIUS binding
ss -tulnp | grep radiusd
# Should show ports 1812, 1813, 3799
```

---

## [1.3.0] - 2025-12-03

### 🎯 Major Fix: FreeRADIUS PPPoE & Hotspot Coexistence

#### Problem
- PPPoE users with `username@realm` format were getting Access-Reject
- REST API post-auth was failing for PPPoE users (voucher not found)

#### Solution
1. **Disabled `filter_username` policy** in FreeRADIUS
   - Location: `/etc/freeradius/3.0/sites-enabled/default` line ~293
   - Changed: `filter_username` → `#filter_username`
   - Reason: Policy was rejecting realm-style usernames without proper domain

2. **Added conditional REST for vouchers only**
   - Only call REST API for usernames WITHOUT `@`
   - PPPoE users (with `@`) skip REST and get authenticated via SQL only
   ```
   if (!("%{User-Name}" =~ /@/)) {
       rest.post-auth
   }
   ```

3. **Fixed post-auth API**
   - Return success for unmanaged vouchers (backward compatibility)
   - Only process vouchers that exist in `hotspotVoucher` table

#### Files Changed
- `/etc/freeradius/3.0/sites-enabled/default` - Disabled filter_username, added conditional REST
- `src/app/api/radius/post-auth/route.ts` - Return success for unmanaged vouchers

#### Testing
```bash
# PPPoE user (with @) - should get Access-Accept
radtest 'user@realm' 'password' 127.0.0.1 0 testing123

# Hotspot voucher (without @) - should get Access-Accept
radtest 'VOUCHERCODE' 'password' 127.0.0.1 0 testing123
```

### 📦 Project Updates
- Added `freeradius-config/` directory with configuration backups
- Updated `vps-install.sh` with proper FreeRADIUS setup
- Added `docs/FREERADIUS-SETUP.md` documentation
- Updated `README.md` with comprehensive documentation
- Fresh database backup: `backup/aibill_radius_backup_20251203.sql`

---

## [1.2.0] - 2025-12-03

### 🎯 Major Features

#### Agent Deposit & Balance System
- **Deposit System**: Agent can now top up balance via payment gateway (Midtrans/Xendit/Duitku)
- **Balance Management**: Agent balance is tracked and required before generating vouchers
- **Auto Deduction**: Voucher generation automatically deducts balance based on costPrice
- **Minimum Balance**: Admin can set minimum balance requirement per agent
- **Payment Tracking**: Track agent sales with payment status (PAID/UNPAID)

**Technical Details:**
- New table: `agent_deposits` for tracking deposits via payment gateway
- New fields: `agent.balance`, `agent.minBalance`
- Generate voucher checks balance before creating vouchers
- Webhook endpoint processes payment callbacks and updates balance
- Sales tracking includes payment status for admin reconciliation

**Workflow:**
1. Agent deposits via payment gateway → Balance increases
2. Agent generates vouchers → Balance deducted (costPrice × quantity)
3. Customer uses voucher → Commission recorded as UNPAID
4. Admin marks sales as PAID after agent payment

**Files Changed:**
- `prisma/schema.prisma` - Added agent deposit tables and balance fields
- `src/app/api/agent/deposit/create/route.ts` - NEW: Create deposit payment
- `src/app/api/agent/deposit/webhook/route.ts` - NEW: Handle payment callbacks
- `src/app/api/agent/generate-voucher/route.ts` - Added balance check and deduction
- `docs/AGENT_DEPOSIT_SYSTEM.md` - NEW: Complete implementation guide

**Database Changes:**
```sql
-- Add balance fields to agents
ALTER TABLE agents ADD balance INT DEFAULT 0;
ALTER TABLE agents ADD minBalance INT DEFAULT 0;

-- Create deposits table
CREATE TABLE agent_deposits (...);

-- Add payment tracking to sales
ALTER TABLE agent_sales ADD paymentStatus VARCHAR(191) DEFAULT 'UNPAID';
ALTER TABLE agent_sales ADD paymentDate DATETIME;
ALTER TABLE agent_sales ADD paymentMethod VARCHAR(191);
```

## [1.1.0] - 2025-12-03

### 🎯 Major Features

#### Sessions & Bandwidth Monitoring
- **Real-time Bandwidth**: Sessions page now fetches live bandwidth data directly from MikroTik API instead of relying on RADIUS interim-updates (which weren't being sent)
- **Session Disconnect**: Fixed disconnect functionality to use MikroTik API directly instead of CoA/radclient
- **Port Configuration**: Uses `router.port` field for MikroTik API connection (the forwarded port)

**Technical Details:**
- Hotspot: Uses `/ip/hotspot/active/print` for sessions, `/ip/hotspot/active/remove` for disconnect
- PPPoE: Uses `/ppp/active/print` for sessions, `/ppp/active/remove` for disconnect
- Traffic: Real-time bytes from `bytes-in` and `bytes-out` fields

**Files Changed:**
- `src/app/api/sessions/route.ts` - Added real-time bandwidth fetching
- `src/app/api/sessions/disconnect/route.ts` - Replaced CoA with MikroTik API

#### GenieACS Integration
- **Device Parsing**: Fixed GenieACS device data parsing to correctly extract device information
- **Virtual Parameters**: Properly reads VirtualParameters with `_value` property
- **Debug Endpoint**: Added `/api/settings/genieacs/debug` for troubleshooting

**Technical Details:**
- Device ID fields use underscore prefix: `_deviceId._Manufacturer`, `_deviceId._SerialNumber`
- Virtual Parameters format: `VirtualParameters.rxPower._value`, `VirtualParameters.ponMode._value`
- OUI extraction from device ID format: `DEVICE_ID-ProductClass-OUI-SerialNumber`

**Files Changed:**
- `src/app/api/settings/genieacs/devices/route.ts` - Fixed data extraction
- `src/app/api/settings/genieacs/debug/route.ts` - New debug endpoint

### 🐛 Bug Fixes

1. **Sessions Page**
   - Fixed: Bandwidth showing "0 B" for active sessions
   - Fixed: Disconnect button showing success but not actually disconnecting
   - Root cause: Using wrong port field (`apiPort` instead of `port`)

2. **GenieACS Page**
   - Fixed: Table columns showing empty/undefined values
   - Fixed: Device manufacturer, model, serial number not displaying
   - Root cause: Wrong path for accessing device properties

3. **Agent Voucher Generation**
   - Fixed: Vouchers not linked to agent account
   - Root cause: `agentId` not being saved when creating voucher
   - Impact: Agent sales tracking now works correctly

4. **GPS Auto Location**
   - Fixed: GPS Auto error on HTTP sites
   - Added: HTTPS requirement check with friendly error message
   - Added: Better error handling for permission denied, timeout, etc.
   - Files: `src/app/admin/pppoe/users/page.tsx`, `src/components/UserDetailModal.tsx`

### 📁 File Structure

```
Changes in this release:
├── src/app/api/sessions/
│   ├── route.ts              # Updated - real-time bandwidth
│   └── disconnect/route.ts   # Updated - MikroTik API disconnect
├── src/app/api/settings/genieacs/
│   ├── devices/route.ts      # Updated - device data parsing
│   └── debug/route.ts        # New - debug endpoint
└── README.md                 # Updated - changelog section
```

### 🔧 Configuration Notes

**Router Configuration:**
- `port` field: Used for MikroTik API connection (forwarded port, e.g., 44039)
- `apiPort` field: Legacy, not used for direct API calls
- `ipAddress` field: Public IP for API connection
- `nasname` field: Used for RADIUS NAS identification

**MikroTik Setup:**
- Ensure API service is enabled on router
- Forward API port (8728) to public IP if needed
- API user must have read/write permissions

---

## [1.0.0] - 2025-12-01

### Initial Release
- Full billing system for RTRW.NET ISP
- FreeRADIUS integration (PPPoE & Hotspot)
- Multi-router/NAS support
- Payment gateway integration (Midtrans, Xendit, Duitku)
- WhatsApp notifications
- Network mapping (OLT, ODC, ODP)
- Agent/reseller management
- Role-based permissions (53 permissions, 6 roles)

<p align="center">
  <h1 align="center">NexaRadius</h1>
  <p align="center">
    <strong>All-in-One ISP Billing & Network Management Platform</strong>
  </p>
  <p align="center">
    Modern full-stack billing system for ISP / RTRW.NET with a premium Enterprise SaaS UI, FreeRADIUS, FTTH network mapping, Zero-Touch Provisioning, and integrated payment gateway.
  </p>
  <p align="center">
    <a href="#-quick-start">Quick Start</a> •
    <a href="#-features">Features</a> •
    <a href="#-architecture">Architecture</a> •
    <a href="#-api-reference">API</a> •
    <a href="#-deployment">Deployment</a>
  </p>
</p>

---

## 🚀 Quick Start

```bash
git clone https://github.com/hendrax5/rabil.git
cd rabil
sudo ./deploy.sh
```

The deploy script will:
1. Detect your OS and install Docker & Docker Compose automatically
2. Prompt for domain name & SSL email (optional — skip for local/IP access)
3. Generate a secure `.env` with random credentials
4. Build and start all 9 services via `docker compose up -d --build`
5. Configure VPN routing on the host

**Access the admin panel** at `https://YOUR_DOMAIN/admin/login` or `http://YOUR_IP/admin/login`.

### Default Credentials

| Portal | URL | Username | Password |
|--------|-----|----------|----------|
| Admin | `/admin/login` | `superadmin` | `admin123` |

> [!CAUTION]
> Change the default password immediately after first login.

### Update Existing Installation

```bash
cd rabil
git pull origin master
sudo ./deploy.sh
```

---

## ✨ Features

### Core Billing

| Feature | Description |
|---------|-------------|
| **PPPoE Management** | Customer accounts with profile-based bandwidth, RADIUS sync, CoA live speed changes |
| **Hotspot Voucher System** | 8 code types, multi-router assignment, batch generation, print templates |
| **Agent / Reseller** | Balance-based voucher generation, commission tracking, deposit via payment gateway |
| **Invoicing** | Auto-generate monthly invoices, payment tracking, overdue reminders |
| **Payment Gateway** | Midtrans, Xendit, Duitku integration with webhook processing |
| **Financial Reporting** | Income/expense tracking with categories, transaction history |

### FTTH Network Management

| Feature | Description |
|---------|-------------|
| **OLT Management** | CRUD with SSH/Telnet connectivity, auto-discovery of unconfigured ONUs |
| **ODC / ODP Management** | Hierarchical fiber topology with port tracking |
| **Network Map** | Interactive Leaflet map with OLT → ODC → ODP → Customer visualization |
| **Customer Assignment** | Assign subscribers to ODP ports with distance calculation |
| **Zero-Touch Provisioning** | Automated ONU discovery → bind → register pipeline for ZTE OLTs |

### Operations & Support

| Feature | Description |
|---------|-------------|
| **Ticketing System** | Customer support tickets with categories, priority, assignment |
| **Technician Portal** | Dedicated mobile UI with OTP login, work orders, KPI tracking |
| **Inventory Management** | SKU-based stock tracking, movements (IN/OUT/ADJUSTMENT), supplier management |
| **Work Orders** | Create, assign, schedule, and track field work |

### Infrastructure & Integrations

| Feature | Description |
|---------|-------------|
| **FreeRADIUS** | Full RADIUS server with MySQL backend for PPPoE & Hotspot auth |
| **RADIUS CoA** | Real-time speed changes & disconnect without user reconnection |
| **GenieACS TR-069** | CPE management — WiFi config, firmware, device monitoring |
| **WhatsApp Notifications** | Multi-provider (Fonnte, WAHA, GOWA, MPWA, Wablas, Baileys local engine) |
| **Telegram Backup** | Scheduled database backups sent to Telegram |
| **VPN Access** | Built-in WireGuard + L2TP/IPSec for secure router management |
| **Multi-language** | Indonesian & English with `next-intl` |

### Security

| Feature | Description |
|---------|-------------|
| **Role-Based Access** | 8 roles (Super Admin, Finance, CS, Technician, Marketing, Sales, Sales Manager, Viewer) |
| **53 Granular Permissions** | Per-user permission overrides on top of role templates |
| **Session Timeout** | 30-min idle auto-logout with 60s warning popup |
| **HTTPS** | Automatic SSL via Caddy reverse proxy + Let's Encrypt |

---

## 🏗️ Architecture

### System Overview

```mermaid
graph TB
    subgraph Internet
        CUSTOMER[Customer Browser]
        MIKROTIK[MikroTik Routers]
        ONT[ONT/CPE Devices]
    end

    subgraph Docker["Docker Compose Stack"]
        CADDY[Caddy Reverse Proxy<br/>:80 :443]
        APP[Next.js App<br/>:3000]
        DB[(MySQL 8.0<br/>:3306)]
        FR[FreeRADIUS 3.0<br/>:1812/1813 UDP]
        GENIE[GenieACS<br/>:7547 TR-069]
        MONGO[(MongoDB 4.4)]
        WA[WA Engine<br/>:3006]
        WG[WireGuard<br/>:51820 UDP]
        L2TP[L2TP/IPSec<br/>:500/4500 UDP]
    end

    CUSTOMER -->|HTTPS| CADDY
    CADDY -->|proxy| APP
    APP -->|Prisma ORM| DB
    FR -->|SQL auth| DB
    FR -->|REST post-auth| APP
    MIKROTIK -->|RADIUS| FR
    MIKROTIK <-->|RouterOS API| APP
    APP -->|CoA :3799| MIKROTIK
    ONT -->|TR-069 :7547| GENIE
    GENIE --> MONGO
    APP -->|NBI API :7557| GENIE
    WA -->|Prisma| DB
    APP -->|Queue| WA

    style CADDY fill:#22c55e,color:#fff
    style APP fill:#3b82f6,color:#fff
    style DB fill:#f59e0b,color:#fff
    style FR fill:#ef4444,color:#fff
    style GENIE fill:#8b5cf6,color:#fff
```

### RADIUS Authentication Flow

```mermaid
sequenceDiagram
    participant MK as MikroTik
    participant FR as FreeRADIUS
    participant DB as MySQL
    participant API as Next.js API

    Note over MK,API: PPPoE Authentication (username@realm)
    MK->>FR: Access-Request (user@realm)
    FR->>DB: SQL lookup (radcheck + radusergroup)
    DB-->>FR: Credentials + Group
    FR->>DB: SQL lookup (radgroupreply)
    DB-->>FR: Mikrotik-Rate-Limit, Session-Timeout
    FR-->>MK: Access-Accept

    Note over MK,API: Hotspot Voucher (no @ in username)
    MK->>FR: Access-Request (VOUCHERCODE)
    FR->>DB: SQL lookup
    DB-->>FR: Credentials + Group
    FR->>API: REST post-auth (voucher tracking)
    API->>DB: Set firstLoginAt, expiresAt, sync income
    API-->>FR: 200 OK
    FR-->>MK: Access-Accept
```

### Zero-Touch Provisioning (ZTP) Pipeline

```mermaid
stateDiagram-v2
    [*] --> DISCOVERED: Cron discovers uncfg ONU
    DISCOVERED --> READY: Admin binds via UI<br/>(sets VLAN, mode, PPPoE)
    READY --> PROVISIONING: ZTP Orchestrator picks up
    PROVISIONING --> SUCCESS: ONU registered on OLT
    PROVISIONING --> FAILED: CLI error / timeout
    FAILED --> READY: Admin retries
    SUCCESS --> [*]
```

### Data Model (Key Entities)

```mermaid
erDiagram
    router ||--o{ pppoeUser : "has subscribers"
    router ||--o{ hotspotVoucher : "serves"
    router ||--o{ agent : "assigned"
    pppoeProfile ||--o{ pppoeUser : "defines speed"
    hotspotProfile ||--o{ hotspotVoucher : "defines plan"
    agent ||--o{ hotspotVoucher : "generates"
    agent ||--o{ agentSale : "tracks sales"
    pppoeUser ||--o{ invoice : "billed"
    invoice ||--o{ payment : "paid via"
    paymentGateway ||--o{ payment : "processes"
    networkOLT ||--o{ networkODC : "feeds"
    networkODC ||--o{ networkODP : "distributes"
    networkODP ||--o{ odpCustomerAssignment : "connects"
    pppoeUser ||--o{ odpCustomerAssignment : "assigned port"
    networkOLT ||--o{ discovered_onu : "discovers"
    ticket ||--o{ ticketMessage : "has messages"
    inventoryItem ||--o{ inventoryMovement : "stock changes"
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 16 (App Router, Turbopack, React 19) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS v4, GSAP animations |
| **Database** | MySQL 8.0 via Prisma ORM (1306-line schema, 50+ models) |
| **Auth** | NextAuth.js with role-based sessions |
| **RADIUS** | FreeRADIUS 3.0 with SQL + REST modules |
| **Maps** | Leaflet / OpenStreetMap with OSRM routing |
| **Payments** | Midtrans, Xendit, Duitku SDKs |
| **CPE Management** | GenieACS 1.2.9 (TR-069) |
| **WhatsApp** | Multi-provider + local Baileys engine |
| **Charts** | Recharts |
| **PDF** | jsPDF + AutoTable |
| **VPN** | WireGuard (wg-easy) + L2TP/IPSec |
| **Reverse Proxy** | Caddy 2 (auto HTTPS) |
| **CI/CD** | GitHub Actions (lint → build → Docker check) |

---

## 📁 Project Structure

```
rabil/
├── src/
│   ├── app/
│   │   ├── admin/              # Admin panel (17 modules)
│   │   │   ├── genieacs/       # TR-069 CPE management
│   │   │   ├── hotspot/        # Voucher management
│   │   │   ├── inventory/      # Stock management
│   │   │   ├── invoices/       # Billing
│   │   │   ├── keuangan/       # Financial reporting
│   │   │   ├── management/     # Admin user management
│   │   │   ├── network/        # OLT/ODC/ODP/Map/Routers
│   │   │   ├── notifications/  # In-app notifications
│   │   │   ├── pppoe/          # PPPoE users & profiles
│   │   │   ├── sessions/       # Active session monitoring
│   │   │   ├── settings/       # System settings, cron, backup
│   │   │   ├── technicians/    # Technician management
│   │   │   ├── tickets/        # Support ticketing
│   │   │   └── whatsapp/       # WA provider config
│   │   ├── agent/              # Agent/reseller portal
│   │   ├── api/                # 31 API route groups
│   │   │   ├── network/        # OLT/ODC/ODP/ZTP/Router APIs
│   │   │   ├── radius/         # RADIUS post-auth & CoA
│   │   │   ├── pppoe/          # PPPoE CRUD & sync
│   │   │   ├── hotspot/        # Voucher generation
│   │   │   ├── invoices/       # Invoice lifecycle
│   │   │   ├── payment/        # Gateway webhooks
│   │   │   └── ...
│   │   ├── customer/           # Customer self-service portal
│   │   ├── daftar/             # Public registration form
│   │   ├── evoucher/           # E-voucher purchase portal
│   │   ├── technician/         # Technician mobile portal
│   │   └── pay/                # Payment pages
│   ├── components/             # Reusable React components
│   │   ├── ui/                 # shadcn/ui primitives
│   │   ├── network/            # Network map components
│   │   ├── charts/             # Chart components
│   │   └── cyberpunk/          # Themed UI components
│   ├── hooks/                  # Custom React hooks
│   ├── lib/                    # Business logic & utilities
│   │   ├── oltAuth/            # OLT drivers (ZTE SSH/Telnet)
│   │   ├── ztp/                # ZTP orchestrator
│   │   ├── services/           # CoA service
│   │   ├── cron/               # Scheduled jobs
│   │   └── payment/            # Payment gateway adapters
│   ├── locales/                # i18n (id.json, en.json)
│   └── microservices/
│       └── whatsapp-engine/    # Standalone Baileys WA service
├── prisma/
│   ├── schema.prisma           # 50+ models, 1300+ lines
│   └── seeds/                  # Database seed scripts
├── freeradius-config/          # FreeRADIUS config backups
├── .github/workflows/ci.yml   # CI pipeline
├── docker-compose.yml          # 8-service stack
├── deploy.sh                   # One-click production deploy
├── Dockerfile                  # Multi-stage Node.js build
└── Dockerfile.freeradius       # FreeRADIUS container
```

---

## 📡 API Reference

### RADIUS CoA (Change of Authorization)

Real-time session control without disconnecting users.

```bash
# Check CoA status
GET /api/radius/coa

# Disconnect user
POST /api/radius/coa
{ "action": "disconnect", "username": "user@realm" }

# Update speed live
POST /api/radius/coa
{ "action": "update", "username": "user@realm",
  "attributes": { "downloadSpeed": 20, "uploadSpeed": 10 } }

# Sync profile to all active sessions
POST /api/radius/coa
{ "action": "sync-profile", "profileId": "profile-uuid" }
```

> **MikroTik requirement**: `/radius incoming set accept=yes port=3799`

### Key API Groups

| Group | Endpoints | Purpose |
|-------|-----------|---------|
| `/api/pppoe` | users, profiles, sync-mikrotik | PPPoE subscriber management |
| `/api/hotspot` | vouchers, profiles, generate | Hotspot voucher lifecycle |
| `/api/invoices` | CRUD, send, remind | Invoice management |
| `/api/network` | olts, odcs, odps, routers, ztp | FTTH network & provisioning |
| `/api/radius` | post-auth, coa | RADIUS integration |
| `/api/sessions` | list, disconnect | Active session control |
| `/api/genieacs` | devices, tasks, wifi | TR-069 CPE management |
| `/api/payment` | midtrans, xendit, duitku webhooks | Payment processing |
| `/api/whatsapp` | send, templates, providers | Notification engine |
| `/api/cron` | trigger | Scheduled job runner |

---

## 🐳 Deployment

### Docker Compose Services

| Service | Container | Ports | Purpose |
|---------|-----------|-------|---------|
| `app` | aibill-app | 3000 (internal) | Next.js application |
| `db` | aibill-db | 3306 | MySQL 8.0 database |
| `freeradius` | aibill-freeradius | 1812/1813 UDP | RADIUS server |
| `genieacs` | aibill-genieacs | 3005, 7547, 7557 | TR-069 ACS |
| `mongo-acs` | aibill-mongo-acs | — | GenieACS database |
| `wa-engine` | aibill-wa-engine | 3006 | WhatsApp engine |
| `wg-easy` | aibill-vpn | 51820 UDP, 51821 | WireGuard VPN |
| `l2tp-vpn` | aibill-l2tp | 500, 4500, 1701 UDP | L2TP/IPSec VPN |
| `caddy` | aibill-caddy | 80, 443 | Reverse proxy + SSL |

### Environment Variables

```bash
# Database
DATABASE_URL="mysql://user:pass@localhost:3306/dbname"

# Timezone (critical for WIB)
TZ="Asia/Jakarta"
NEXT_PUBLIC_TIMEZONE="Asia/Jakarta"

# Application
NEXT_PUBLIC_APP_NAME="Your ISP Name"
NEXT_PUBLIC_APP_URL="https://your-domain.com"

# Auth
NEXTAUTH_SECRET=<openssl rand -base64 32>
NEXTAUTH_URL="https://your-domain.com"

# Optional: Force RADIUS server IP
# RADIUS_SERVER_IP="YOUR_VPS_PUBLIC_IP"
```

### Firewall Rules

```bash
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 1812/udp  # RADIUS Auth
ufw allow 1813/udp  # RADIUS Accounting
ufw allow 3799/udp  # RADIUS CoA
ufw allow 7547/tcp  # TR-069 CPE
ufw allow 51820/udp # WireGuard
```

---

## 🔧 Operations

All services run inside Docker. Use these commands from the project directory.

### Application

```bash
# View logs
docker logs aibill-app --tail 100 -f

# Restart app only
docker compose restart app

# Full rebuild & restart
docker compose down
docker compose up -d --build

# Check all container status
docker compose ps
```

### FreeRADIUS

```bash
# View RADIUS logs
docker logs aibill-freeradius --tail 50 -f

# Test configuration inside container
docker exec aibill-freeradius freeradius -XC

# Debug mode (stop container first, then run foreground)
docker compose stop freeradius
docker compose run --rm freeradius freeradius -X

# Test authentication
docker exec aibill-freeradius radtest 'user@realm' 'password' 127.0.0.1 0 testing123
docker exec aibill-freeradius radtest 'VOUCHERCODE' 'password' 127.0.0.1 0 testing123
```

### Database

```bash
# Apply schema changes
docker exec aibill-app npx prisma db push

# Seed initial data
docker exec aibill-app npm run db:seed

# Backup
docker exec aibill-db mysqldump -u root -p"$DB_PASSWORD" aibill_radius > backup.sql

# Restore
docker exec -i aibill-db mysql -u root -p"$DB_PASSWORD" aibill_radius < backup.sql

# Interactive MySQL shell
docker exec -it aibill-db mysql -u root -p"$DB_PASSWORD" aibill_radius
```

---

## 🔐 Security Best Practices

1. **Change default passwords** — admin, MySQL, VPN
2. **Generate strong secrets** — `openssl rand -base64 32` for NEXTAUTH_SECRET
3. **Enable HTTPS** — set domain in deploy script for auto Let's Encrypt
4. **Configure firewall** — only open required ports
5. **Schedule backups** — enable Telegram backup in Settings
6. **Monitor logs** — `docker logs aibill-app --tail 100 -f`
7. **Update regularly** — `git pull origin master && sudo ./deploy.sh`

---

## 👥 Admin Roles

| Role | Access Level |
|------|-------------|
| **SUPER_ADMIN** | Full access to all features |
| **FINANCE** | Invoices, payments, financial reports |
| **CUSTOMER_SERVICE** | User management, tickets, support |
| **TECHNICIAN** | Network, routers, sessions, work orders |
| **MARKETING** | Reports, customer data, analytics |
| **SALES** | Customer onboarding, registrations |
| **SALES_MANAGER** | Sales oversight + team management |
| **VIEWER** | Read-only access to all modules |

Each role has a default permission template (53 permissions across 12 categories). Admins can override individual permissions per user.

---

## 📊 WhatsApp Providers

| Provider | Type | Base URL |
|----------|------|----------|
| **Fonnte** | Cloud API | `https://api.fonnte.com/send` |
| **WAHA** | Self-hosted | `http://IP:PORT` |
| **GOWA** | Self-hosted | `http://IP:PORT` |
| **MPWA** | Self-hosted | `http://IP:PORT` |
| **Wablas** | Cloud API | `https://pati.wablas.com` |
| **Baileys Local** | Built-in microservice | `http://wa-engine:3006` |

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [CHANGELOG.md](CHANGELOG.md) | Version history with detailed changes |
| [docs/INSTALLATION-GUIDE.md](docs/INSTALLATION-GUIDE.md) | Manual VPS installation |
| [docs/GENIEACS-GUIDE.md](docs/GENIEACS-GUIDE.md) | TR-069 setup & WiFi management |
| [docs/AGENT_DEPOSIT_SYSTEM.md](docs/AGENT_DEPOSIT_SYSTEM.md) | Agent balance & deposit workflow |
| [docs/RADIUS-CONNECTIVITY.md](docs/RADIUS-CONNECTIVITY.md) | RADIUS architecture deep-dive |
| [docs/FREERADIUS-SETUP.md](docs/FREERADIUS-SETUP.md) | FreeRADIUS configuration guide |
| [docs/01-plan/](docs/01-plan/) | Feature planning documents |

---

## 🧑‍💻 Development

### Prerequisites

- Docker & Docker Compose
- Git

### Key Conventions

- **Timezone**: Always use `formatWIB()` and `toWIB()` for user-facing dates
- **API Auth**: Use `apiAuth()` wrapper in API routes for session validation
- **Permissions**: Check with `hasPermission(session, 'module.action')`
- **OLT Commands**: Use `ZteEngine` class for all OLT CLI interactions
- **Database**: Prisma schema is the single source of truth — use `npx prisma db push`

### CI/CD Pipeline

```
Push to main/master → Lint → Build Next.js → Docker Build Check
```

---

## 📝 License

MIT License — Free for commercial and personal use.

---

<p align="center">Built with ❤️ for Indonesian ISPs</p>

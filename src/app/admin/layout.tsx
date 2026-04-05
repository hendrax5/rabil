'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut, SessionProvider } from 'next-auth/react';
import {
  LayoutDashboard,
  Users,
  Wifi,
  Receipt,
  CreditCard,
  Wallet,
  Clock,
  MessageSquare,
  Network,
  Settings,
  Menu,
  X,
  ChevronDown,
  Shield,
  Search,
  LogOut,
  Sun,
  Moon,
  Router,
  AlertTriangle,
  Timer,
  Package,
  Headset,
  Wrench,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import NotificationDropdown from '@/components/NotificationDropdown';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useTranslation } from '@/hooks/useTranslation';
import { useIdleTimeout } from '@/hooks/useIdleTimeout';

interface MenuItem {
  titleKey: string;
  icon: React.ReactNode;
  href?: string;
  children?: { titleKey: string; href: string; badge?: string; requiredPermission?: string }[];
  badge?: string;
  requiredPermission?: string;
}

const menuItems: MenuItem[] = [
  {
    titleKey: 'nav.dashboard',
    icon: <LayoutDashboard className="w-4 h-4" />,
    href: '/admin',
    requiredPermission: 'dashboard.view',
  },
  {
    titleKey: 'nav.pppoe',
    icon: <Users className="w-4 h-4" />,
    requiredPermission: 'customers.view',
    children: [
      { titleKey: 'nav.users', href: '/admin/pppoe/users', requiredPermission: 'customers.view' },
      { titleKey: 'nav.profiles', href: '/admin/pppoe/profiles', requiredPermission: 'customers.view' },
      { titleKey: 'nav.registrations', href: '/admin/pppoe/registrations', badge: 'pending', requiredPermission: 'registrations.view' },
    ],
  },
  {
    titleKey: 'nav.hotspot',
    icon: <Wifi className="w-4 h-4" />,
    requiredPermission: 'hotspot.view',
    children: [
      { titleKey: 'nav.voucher', href: '/admin/hotspot/voucher', requiredPermission: 'vouchers.view' },
      { titleKey: 'nav.profile', href: '/admin/hotspot/profile', requiredPermission: 'hotspot.view' },
      { titleKey: 'nav.template', href: '/admin/hotspot/template', requiredPermission: 'hotspot.view' },
      { titleKey: 'nav.agent', href: '/admin/hotspot/agent', requiredPermission: 'hotspot.view' },
      { titleKey: 'nav.evoucher', href: '/admin/hotspot/evoucher', requiredPermission: 'vouchers.view' },
    ],
  },
  {
    titleKey: 'nav.invoices',
    icon: <Receipt className="w-4 h-4" />,
    href: '/admin/invoices',
    requiredPermission: 'invoices.view',
  },
  {
    titleKey: 'nav.payment',
    icon: <CreditCard className="w-4 h-4" />,
    href: '/admin/payment-gateway',
    requiredPermission: 'settings.payment',
  },
  {
    titleKey: 'nav.keuangan',
    icon: <Wallet className="w-4 h-4" />,
    href: '/admin/keuangan',
    requiredPermission: 'keuangan.view',
  },
  {
    titleKey: 'nav.sessions',
    icon: <Clock className="w-4 h-4" />,
    href: '/admin/sessions',
    requiredPermission: 'sessions.view',
  },
  {
    titleKey: 'nav.whatsapp',
    icon: <MessageSquare className="w-4 h-4" />,
    requiredPermission: 'whatsapp.view',
    children: [
      { titleKey: 'nav.providers', href: '/admin/whatsapp/providers', requiredPermission: 'whatsapp.providers' },
      { titleKey: 'nav.templates', href: '/admin/whatsapp/templates', requiredPermission: 'whatsapp.templates' },
      { titleKey: 'nav.settings', href: '/admin/whatsapp/notifications', requiredPermission: 'notifications.manage' },
      { titleKey: 'nav.history', href: '/admin/whatsapp/history', requiredPermission: 'whatsapp.view' },
      { titleKey: 'nav.send', href: '/admin/whatsapp/send', requiredPermission: 'whatsapp.send' },
    ],
  },
  {
    titleKey: 'nav.network',
    icon: <Network className="w-4 h-4" />,
    requiredPermission: 'network.view',
    children: [
      { titleKey: 'nav.networkMap', href: '/admin/network/map', requiredPermission: 'network.view' },
      { titleKey: 'nav.router', href: '/admin/network/routers', requiredPermission: 'routers.view' },
      { titleKey: 'nav.olt', href: '/admin/network/olts', requiredPermission: 'network.view' },
      { titleKey: 'nav.odc', href: '/admin/network/odcs', requiredPermission: 'network.view' },
      { titleKey: 'nav.odp', href: '/admin/network/odps', requiredPermission: 'network.view' },
      { titleKey: 'nav.odpCustomer', href: '/admin/network/customers', requiredPermission: 'network.view' },
      { titleKey: 'nav.vpn', href: '/admin/network/vpn', requiredPermission: 'network.view' },
    ],
  },
  {
    titleKey: 'nav.genieacs',
    icon: <Router className="w-4 h-4" />,
    requiredPermission: 'settings.genieacs',
    children: [
      { titleKey: 'nav.devices', href: '/admin/genieacs/devices', requiredPermission: 'settings.genieacs' },
      { titleKey: 'nav.tasks', href: '/admin/genieacs/tasks', requiredPermission: 'settings.genieacs' },
    ],
  },
  {
    titleKey: 'nav.management',
    icon: <Shield className="w-4 h-4" />,
    href: '/admin/management',
    requiredPermission: 'users.view',
  },
  {
    titleKey: 'Inventory',
    icon: <Package className="w-4 h-4" />,
    requiredPermission: 'network.view',
    children: [
      { titleKey: 'Items', href: '/admin/inventory/items', requiredPermission: 'network.view' },
      { titleKey: 'Movements', href: '/admin/inventory/movements', requiredPermission: 'network.view' },
      { titleKey: 'Categories', href: '/admin/inventory/categories', requiredPermission: 'network.view' },
      { titleKey: 'Suppliers', href: '/admin/inventory/suppliers', requiredPermission: 'network.view' },
    ],
  },
  {
    titleKey: 'Tickets',
    icon: <Headset className="w-4 h-4" />,
    requiredPermission: 'customers.view',
    children: [
      { titleKey: 'All Tickets', href: '/admin/tickets', requiredPermission: 'customers.view' },
      { titleKey: 'Categories', href: '/admin/tickets/categories', requiredPermission: 'customers.view' },
      { titleKey: 'System Categories', href: '/admin/tickets/system-categories', requiredPermission: 'customers.view' },
    ],
  },
  {
    titleKey: 'Technicians',
    icon: <Wrench className="w-4 h-4" />,
    href: '/admin/technicians',
    requiredPermission: 'network.view',
  },
  {
    titleKey: 'nav.settingsMenu',
    icon: <Settings className="w-4 h-4" />,
    requiredPermission: 'settings.view',
    children: [
      { titleKey: 'nav.company', href: '/admin/settings/company', requiredPermission: 'settings.company' },
      { titleKey: 'nav.database', href: '/admin/settings/database', requiredPermission: 'settings.view' },
      { titleKey: 'nav.cronJobs', href: '/admin/settings/cron', requiredPermission: 'settings.cron' },
      { titleKey: 'nav.genieacs', href: '/admin/settings/genieacs', requiredPermission: 'settings.genieacs' },
      { titleKey: 'nav.systemLogs', href: '/admin/settings/logs', requiredPermission: 'settings.view' },
    ],
  },
];

function NavItem({ item, pendingCount, collapsed, t, onNavigate }: { item: MenuItem; pendingCount: number; collapsed?: boolean; t: (key: string, params?: Record<string, string | number>) => string; onNavigate?: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const isActive = item.href === pathname || item.children?.some(c => c.href === pathname);

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'w-full flex items-center gap-2.5 px-2.5 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 group',
            isActive
              ? 'text-cyan-400 bg-cyan-500/10 border border-cyan-400/30 shadow-[0_0_15px_rgba(0,255,255,0.15),inset_0_1px_0_rgba(255,255,255,0.05)]'
              : 'text-muted-foreground hover:text-foreground hover:bg-primary/10 border border-transparent hover:border-primary/20',
          )}
        >
          <span className={cn(
            'flex-shrink-0 p-1.5 rounded-lg transition-all duration-300',
            isActive ? 'text-cyan-400 bg-cyan-500/10 drop-shadow-[0_0_8px_rgba(0,255,255,0.8)]' : 'text-muted-foreground group-hover:text-cyan-400'
          )}>
            {item.icon}
          </span>
          {!collapsed && (
            <>
              <span className="flex-1 text-left truncate tracking-wide">{t(item.titleKey)}</span>
              <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-300', isOpen && 'rotate-180')} />
            </>
          )}
        </button>
        {!collapsed && (
          <div className={cn(
            'overflow-hidden transition-all duration-300 ease-in-out',
            isOpen ? 'max-h-96 opacity-100 mt-1' : 'max-h-0 opacity-0'
          )}>
            <div className="ml-4 pl-3 border-l-2 border-cyan-500/20 space-y-1">
              {item.children.map((child) => (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-all duration-200 group/item',
                    pathname === child.href
                      ? 'text-cyan-400 bg-cyan-500/10 border border-cyan-400/20 shadow-[0_0_10px_rgba(0,255,255,0.1)]'
                      : 'text-muted-foreground hover:text-foreground hover:bg-primary/10'
                  )}
                >
                  <span className="tracking-wide">{t(child.titleKey)}</span>
                  {child.badge === 'pending' && pendingCount > 0 && (
                    <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-md font-bold min-w-[18px] text-center shadow-[0_0_8px_rgba(255,0,0,0.5)] animate-pulse">
                      {pendingCount}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href!}
      onClick={onNavigate}
      className={cn(
        'flex items-center gap-2.5 px-2.5 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 group',
        pathname === item.href
          ? 'text-cyan-400 bg-cyan-500/10 border border-cyan-400/30 shadow-[0_0_15px_rgba(0,255,255,0.15),inset_0_1px_0_rgba(255,255,255,0.05)]'
          : 'text-muted-foreground hover:text-foreground hover:bg-primary/10 border border-transparent hover:border-primary/20',
      )}
    >
      <span className={cn(
        'flex-shrink-0 p-1.5 rounded-lg transition-all duration-300',
        pathname === item.href ? 'text-cyan-400 bg-cyan-500/10 drop-shadow-[0_0_8px_rgba(0,255,255,0.8)]' : 'text-muted-foreground group-hover:text-cyan-400'
      )}>
        {item.icon}
      </span>
      {!collapsed && (
        <span className="truncate tracking-wide">{t(item.titleKey)}</span>
      )}
    </Link>
  );
}

function AdminLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pendingRegistrations, setPendingRegistrations] = useState(0);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [darkMode, setDarkMode] = useState(false);
  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const [idleCountdown, setIdleCountdown] = useState(60);
  const { company, setCompany } = useAppStore();
  const { t } = useTranslation();
  
  const isLoginPage = pathname === '/admin/login';

  // Idle timeout - 30 minutes with 1 minute warning
  const { extendSession } = useIdleTimeout({
    timeout: 30 * 60 * 1000, // 30 minutes
    warningTime: 60 * 1000, // 1 minute warning
    enabled: !isLoginPage && status === 'authenticated',
    onWarning: () => {
      setShowIdleWarning(true);
      setIdleCountdown(60);
    },
  });

  // Countdown timer for idle warning
  useEffect(() => {
    if (!showIdleWarning) return;
    
    const interval = setInterval(() => {
      setIdleCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showIdleWarning]);

  // Handle stay logged in
  const handleStayLoggedIn = useCallback(() => {
    setShowIdleWarning(false);
    setIdleCountdown(60);
    extendSession();
  }, [extendSession]);

  // Handle logout - use redirect: false to avoid NEXTAUTH_URL issues
  const handleLogout = useCallback(async () => {
    await signOut({ redirect: false });
    // Manual redirect to current origin
    window.location.href = `${window.location.origin}/admin/login`;
  }, []);

  useEffect(() => {
    setMounted(true);
    
    // Check dark mode
    const isDark = document.documentElement.classList.contains('dark');
    setDarkMode(isDark);
  }, []);

  // Load user permissions when session is available
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user) return;
    
    const userId = (session.user as any).id;
    if (userId) {
      fetch(`/api/admin/users/${userId}/permissions`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setUserPermissions(data.permissions);
          }
        })
        .catch(console.error);
    }
  }, [session, status]);

  // Load company data
  useEffect(() => {
    fetch('/api/company')
      .then((res) => res.json())
      .then((data) => {
        if (data.name) {
          setCompany({
            name: data.name,
            email: data.email,
            phone: data.phone,
            address: data.address,
            baseUrl: data.baseUrl || window.location.origin,
            adminPhone: data.phone,
          });
        }
      })
      .catch(console.error);
  }, [setCompany]);

  // Load pending registrations
  useEffect(() => {
    if (status !== 'authenticated') return;

    const loadPending = () => {
      fetch('/api/admin/registrations?status=PENDING')
        .then((res) => res.json())
        .then((data) => {
          if (data.stats) setPendingRegistrations(data.stats.pending || 0);
        })
        .catch(console.error);
    };

    loadPending();
    const interval = setInterval(loadPending, 30000);
    return () => clearInterval(interval);
  }, [status]);

  const toggleDarkMode = () => {
    const newDark = !darkMode;
    setDarkMode(newDark);
    document.documentElement.classList.toggle('dark', newDark);
  };

  // Show login page without layout
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Show loading while checking session
  if (status === 'loading' || !mounted) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Memuat...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (status === 'unauthenticated') {
    if (typeof window !== 'undefined') {
      window.location.href = `${window.location.origin}/admin/login`;
    }
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Mengalihkan ke halaman login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Cyberpunk Background Effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-500/5 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-pink-500/5 rounded-full blur-[100px] animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] bg-purple-500/3 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,255,255,0.01)_2px,rgba(0,255,255,0.01)_4px)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px]" />
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Cyberpunk */}
      <aside className={cn(
        'fixed top-0 left-0 z-50 h-[100dvh] w-[280px] sm:w-64 transition-transform duration-300 ease-out',
        'bg-background/95 backdrop-blur-xl',
        'border-r border-cyan-500/20',
        'shadow-[5px_0_30px_rgba(0,255,255,0.1),inset_-1px_0_0_rgba(255,255,255,0.05)]',
        'lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Top neon line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />

        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 border-b border-cyan-500/20 bg-gradient-to-r from-cyan-500/5 via-transparent to-pink-500/5">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-400 flex items-center justify-center border border-cyan-400/50 shadow-[0_0_20px_rgba(0,255,255,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] animate-pulse">
                <span className="text-black font-black text-xs sm:text-sm">{company.name.charAt(0)}</span>
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-[11px] sm:text-xs font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-cyan-300 to-pink-400 drop-shadow-[0_0_10px_rgba(0,255,255,0.5)] truncate max-w-[130px] sm:max-w-[110px]">
                  {company.name}
                </h1>
                <p className="text-[9px] sm:text-[10px] text-cyan-400/60 tracking-[0.15em] sm:tracking-[0.2em] uppercase font-medium">Billing System</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 sm:p-1.5 hover:bg-primary/20 rounded-lg sm:rounded-md text-muted-foreground hover:text-primary transition-colors border border-transparent hover:border-primary/30 active:scale-95"
            >
              <X className="w-5 h-5 sm:w-4 sm:h-4" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {menuItems
              .filter((item) => {
                if (!item.requiredPermission) return true;
                return userPermissions.includes(item.requiredPermission);
              })
              .map((item) => {
                const filteredItem = {
                  ...item,
                  children: item.children?.filter((child) => {
                    if (!child.requiredPermission) return true;
                    return userPermissions.includes(child.requiredPermission);
                  }),
                };
                
                if (filteredItem.children && filteredItem.children.length === 0) {
                  return null;
                }
                
                return (
                  <NavItem 
                    key={item.titleKey} 
                    item={filteredItem} 
                    pendingCount={pendingRegistrations} 
                    t={t}
                    onNavigate={() => setSidebarOpen(false)}
                  />
                );
              })}
          </nav>

          {/* User */}
          <div className="p-2 border-t border-gray-100 dark:border-gray-800">
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="w-7 h-7 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-md flex items-center justify-center text-white text-xs font-semibold">
                  {session?.user?.name?.charAt(0).toUpperCase() || 'A'}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                    {session?.user?.name || 'Admin'}
                  </p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                    {(session?.user as any)?.role || 'admin'}
                  </p>
                </div>
                <ChevronDown className={cn('w-3.5 h-3.5 text-gray-400 transition-transform', showUserMenu && 'rotate-180')} />
              </button>
              
              {showUserMenu && (
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden fade-in">
                  <div className="p-2 border-b border-gray-100 dark:border-gray-700">
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('auth.signedInAs')}</p>
                    <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                      {(session?.user as any)?.username}
                    </p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    {t('auth.signOut')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="lg:pl-64 min-h-screen flex flex-col transition-all duration-300">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-800/50 shadow-sm">
          <div className="flex items-center gap-2 px-3 py-2">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
            >
              <Menu className="w-4 h-4" />
            </button>
            
            {/* Search */}
            <div className="hidden sm:flex flex-1 max-w-xs">
              <div className="relative w-full">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder={t('common.search')}
                  className="w-full pl-8 pr-3 py-1.5 bg-gray-100 dark:bg-gray-800 border-0 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
            
            <div className="flex-1" />
            
            {/* Actions */}
            <div className="flex items-center gap-1">
              <button
                onClick={toggleDarkMode}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
                title={t('common.toggleTheme')}
              >
                {darkMode ? <Sun className="w-4 h-4 text-gray-500" /> : <Moon className="w-4 h-4 text-gray-500" />}
              </button>
              
              <NotificationDropdown />
              
              <LanguageSwitcher variant="compact" />
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-3 sm:p-4 fade-in">{children}</main>
      </div>

      {/* Idle Timeout Warning Modal */}
      {showIdleWarning && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                <Timer className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Sesi Tidak Aktif
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Session Timeout
                </p>
              </div>
            </div>
            
            <div className="mb-6">
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                Anda akan otomatis logout karena tidak ada aktivitas.
              </p>
              <div className="flex items-center justify-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {idleCountdown}
                </span>
                <span className="text-sm text-amber-600 dark:text-amber-400">detik</span>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={handleLogout}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                Logout Sekarang
              </button>
              <button
                onClick={handleStayLoggedIn}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
              >
                Tetap Login
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      }>
        <AdminLayoutContent>{children}</AdminLayoutContent>
      </Suspense>
    </SessionProvider>
  );
}

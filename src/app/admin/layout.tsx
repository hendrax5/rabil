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
    titleKey: 'nav.technicians',
    icon: <Wrench className="w-4 h-4" />,
    requiredPermission: 'network.view',
    children: [
      { titleKey: 'nav.technicianList', href: '/admin/technicians', requiredPermission: 'network.view' },
      { titleKey: 'nav.workOrders', href: '/admin/technicians/work-orders', requiredPermission: 'network.view' },
    ],
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

const groupedItems: Record<string, string[]> = {
  Overview: ['nav.dashboard', 'Tickets'],
  Services: ['nav.pppoe', 'nav.hotspot'],
  Network: ['nav.network', 'nav.genieacs', 'Inventory', 'nav.technicians'],
  Finance: ['nav.invoices', 'nav.payment', 'nav.keuangan'],
  System: ['nav.whatsapp', 'nav.management', 'nav.sessions', 'nav.settingsMenu']
};

function NavItem({ item, pendingCount, collapsed, t, onNavigate }: { item: MenuItem; pendingCount: number; collapsed?: boolean; t: (key: string, params?: Record<string, string | number>) => string; onNavigate?: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const isActive = item.href === pathname || item.children?.some(c => c.href === pathname);

  if (item.children) {
    return (
      <div className="mb-0.5">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-all duration-200 group relative outline-none',
            isActive
              ? 'text-zinc-900 dark:text-zinc-100 font-medium bg-zinc-50 dark:bg-zinc-800/50'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
          )}
        >
          {isActive && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-zinc-900 dark:bg-zinc-100 rounded-r-full" />
          )}
          <span className={cn(
            'flex-shrink-0 transition-colors duration-200',
            isActive ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-zinc-100'
          )}>
            {item.icon}
          </span>
          {!collapsed && (
            <>
              <span className="flex-1 text-left truncate tracking-tight">{t(item.titleKey)}</span>
              <ChevronDown className={cn('w-4 h-4 text-zinc-400 transition-transform duration-200', isOpen && 'rotate-180')} />
            </>
          )}
        </button>
        {!collapsed && (
          <div className={cn(
            'overflow-hidden transition-all duration-300 ease-in-out',
            isOpen ? 'max-h-96 opacity-100 mt-1' : 'max-h-0 opacity-0'
          )}>
            <div className="ml-9 border-l border-zinc-200 dark:border-zinc-800 space-y-0.5 pl-3 py-1">
              {item.children.map((child) => (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center justify-between px-3 py-1.5 text-xs rounded-md transition-colors duration-200',
                    pathname === child.href
                      ? 'text-zinc-900 dark:text-zinc-100 font-medium bg-zinc-100 dark:bg-zinc-800'
                      : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                  )}
                >
                  <span className="tracking-tight">{t(child.titleKey)}</span>
                  {child.badge === 'pending' && pendingCount > 0 && (
                    <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium min-w-[20px] text-center">
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
        'flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-all duration-200 group relative mb-0.5 outline-none',
        pathname === item.href
          ? 'text-zinc-900 dark:text-zinc-100 font-medium bg-zinc-50 dark:bg-zinc-800/50'
          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
      )}
    >
      {pathname === item.href && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-zinc-900 dark:bg-zinc-100 rounded-r-full" />
      )}
      <span className={cn(
        'flex-shrink-0 transition-colors duration-200',
        pathname === item.href ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-zinc-100'
      )}>
        {item.icon}
      </span>
      {!collapsed && (
        <span className="truncate tracking-tight">{t(item.titleKey)}</span>
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
    document.documentElement.dataset.theme = newDark ? 'dark' : 'light';
    localStorage.setItem('theme', newDark ? 'dark' : 'light');
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
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 relative overflow-hidden text-zinc-900 dark:text-zinc-100">

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Minimalist Premium */}
      <aside className={cn(
        'fixed top-0 left-0 z-50 h-[100dvh] w-[280px] sm:w-[260px] transition-transform duration-300 ease-out',
        'bg-white dark:bg-zinc-900',
        'border-r border-zinc-200 dark:border-zinc-800',
        'lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center justify-between px-6 py-5 border-b border-zinc-100 dark:border-zinc-800/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-white flex items-center justify-center">
                <span className="text-white dark:text-zinc-900 font-bold text-sm">{company.name.charAt(0)}</span>
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                  {company.name}
                </h1>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium tracking-wide">
                  BILLING SYSTEM
                </p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md text-zinc-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
            {Object.entries(groupedItems).map(([groupName, itemKeys]) => {
              const groupItems = menuItems.filter(item => itemKeys.includes(item.titleKey) && (!item.requiredPermission || userPermissions.includes(item.requiredPermission)));
              
              if (groupItems.length === 0) return null;

              return (
                <div key={groupName}>
                  <h4 className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-2 px-1">
                    {groupName}
                  </h4>
                  <div className="space-y-0.5">
                    {groupItems.map((item) => {
                      const filteredItem = {
                        ...item,
                        children: item.children?.filter((child) => {
                          if (!child.requiredPermission) return true;
                          return userPermissions.includes(child.requiredPermission);
                        }),
                      };
                      
                      if (filteredItem.children && filteredItem.children.length === 0) return null;
                      
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
                  </div>
                </div>
              );
            })}
          </nav>

          {/* User */}
          <div className="p-4 border-t border-zinc-100 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-900/50">
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors outline-none"
              >
                <div className="w-8 h-8 bg-zinc-900 dark:bg-white rounded-full flex items-center justify-center text-white dark:text-zinc-900 text-xs font-bold">
                  {session?.user?.name?.charAt(0).toUpperCase() || 'A'}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                    {session?.user?.name || 'Admin'}
                  </p>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate capitalize tracking-wide">
                    {(session?.user as any)?.role || 'admin'}
                  </p>
                </div>
                <ChevronDown className={cn('w-4 h-4 text-zinc-400 transition-transform duration-200', showUserMenu && 'rotate-180')} />
              </button>
              
              {showUserMenu && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-zinc-900 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] border border-zinc-200 dark:border-zinc-800 overflow-hidden fade-in z-50">
                  <div className="p-3 border-b border-zinc-100 dark:border-zinc-800">
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wide">{t('auth.signedInAs')}</p>
                    <p className="text-sm font-medium text-zinc-900 dark:text-white truncate mt-0.5">
                      {(session?.user as any)?.username}
                    </p>
                  </div>
                  <div className="p-1">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      {t('auth.signOut')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="lg:pl-[260px] min-h-screen flex flex-col transition-all duration-300">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200/50 dark:border-zinc-800/50">
          <div className="flex items-center gap-3 px-4 h-14">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <Menu className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
            </button>
            
            {/* Search */}
            <div className="hidden sm:flex flex-1 max-w-sm">
              <div className="relative w-full group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-zinc-900 dark:group-focus-within:text-zinc-100 transition-colors" />
                <input
                  type="text"
                  placeholder={t('common.search')}
                  className="w-full pl-9 pr-4 py-2 bg-zinc-100/50 hover:bg-zinc-100 focus:bg-white dark:bg-zinc-900/50 dark:hover:bg-zinc-900 dark:focus:bg-zinc-900 border border-transparent focus:border-zinc-300 dark:focus:border-zinc-700 rounded-xl text-sm transition-all outline-none"
                />
              </div>
            </div>
            
            <div className="flex-1" />
            
            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleDarkMode}
                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                title={t('common.toggleTheme')}
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              
              <NotificationDropdown />
              
              <LanguageSwitcher variant="compact" />
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 sm:p-6 fade-in">{children}</main>
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

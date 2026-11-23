import React, { useMemo, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Search,
  Sparkles,
  Send,
  Wallet,
  ShoppingCart,
  Repeat,
  LogOut,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@client/src/hooks/useAuth';
import { useRechargeStats } from '@client/src/api/media-wallet';
import { USER_ROLE_LABELS } from '@shared/api.interface';
import { prefetchRoute, canPrefetchRoute } from '@client/src/lib/prefetch';
import { useQueryClient } from '@tanstack/react-query';
import BrandLogo from './BrandLogo';
import { UniversalLink } from '@lark-apaas/client-toolkit/components/UniversalLink';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
  roles?: string[];
  matchPrefixes?: string[];
  badge?: number;
  activeSearch?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export const allNavGroups: NavGroup[] = [
  {
    label: '概览',
    items: [
      { to: '/workbench', label: '工作台', icon: LayoutDashboard, end: false },
      { to: '/clients?tab=leads', label: '客户', icon: Users, matchPrefixes: ['/leads', '/customers', '/contracts', '/reports', '/commitment/management'] },
    ],
  },
  {
    label: 'GEO 闭环',
    items: [
      { to: '/geo-loop', label: 'GEO 闭环', icon: Repeat, matchPrefixes: ['/geo-loop', '/diagnosis'] },
      { to: '/keywords?tab=pool', label: '关键词', icon: Search, matchPrefixes: ['/keywords'] },
    ],
  },
  {
    label: '内容与分发',
    items: [
      { to: '/creation?tab=write', label: '创作', icon: Sparkles, matchPrefixes: ['/creation'] },
      { to: '/publish?tab=records', label: '发布', icon: Send, matchPrefixes: ['/publish/records', '/publish/queue', '/publish/auto', '/publish/ledger', '/publish/submission-channels', '/publish/submission-queue', '/publish/sites', '/publish/accounts', '/publish/channels', '/publish/client'] },
      { to: '/media-market?tab=market', label: '媒体商城', icon: ShoppingCart, matchPrefixes: ['/media-market'] },
    ],
  },
  {
    label: '账号',
    items: [
      { to: '/accounts?tab=accounts', label: '站点与账号', icon: Settings, matchPrefixes: ['/accounts', '/sites', '/website', '/settings/knowledge'] },
    ],
  },
  {
    label: '系统',
    items: [
      { to: '/billing?tab=billing', label: '系统', icon: Wallet, roles: ['admin', 'operator', 'client'], matchPrefixes: ['/creation/my-plan', '/settings/credits', '/settings/ai-keys', '/admin/plans', '/admin/credit', '/billing'] },
    ],
  },
];

const CLIENT_VISIBLE_LABELS = ['工作台', '客户', 'GEO 闭环', '关键词', '创作', '发布', '媒体商城', '站点与账号', '系统'];

export function isPathActive(item: NavItem, path: string, search = ''): boolean {
  if (item.activeSearch && !search.includes(item.activeSearch)) return false;
  if (item.end) return path === item.to.split('?')[0];
  const basePath = item.to.split('?')[0];
  if (path === basePath) return true;
  if (item.matchPrefixes) {
    for (const prefix of item.matchPrefixes) {
      if (path.startsWith(prefix)) {
        const next = path.charAt(prefix.length);
        if (next === '' || next === '/') return true;
      }
    }
  }
  return false;
}

export function filterNavGroupsByRole(role: string | undefined): NavGroup[] {
  return allNavGroups
    .map((group: NavGroup): NavGroup => ({
      ...group,
      items: group.items.filter((item: NavItem) => !item.roles || (role && item.roles.includes(role))),
    }))
    .map((group: NavGroup): NavGroup => {
      if (role !== 'client') return group;
      return {
        ...group,
        items: group.items.filter((item: NavItem) => CLIENT_VISIBLE_LABELS.includes(item.label)),
      };
    })
    .filter((group: NavGroup) => group.items.length > 0);
}

interface SidebarProps {
  onNavigate?: () => void;
  collapsed?: boolean;
  onItemClick?: () => void;
}

const Sidebar = ({ onNavigate, collapsed = false, onItemClick }: SidebarProps) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const displayName = user?.displayName || user?.username || '未登录';
  const roleLabel = user?.role ? USER_ROLE_LABELS[user.role] : '';
  const userRole = user?.role || '';
  const prefetchTimersRef = useRef<Map<string, number>>(new Map());
  const queryClient = useQueryClient();

  const handleNavHoverEnter = (path: string, isActive: boolean) => {
    const cleanPath = path.split('?')[0];
    if (!userRole || !canPrefetchRoute(cleanPath, userRole) || isActive) return;
    const existing = prefetchTimersRef.current.get(path);
    if (existing) return;
    const t = window.setTimeout(() => {
      prefetchRoute(queryClient, cleanPath);
      prefetchTimersRef.current.delete(path);
    }, 120);
    prefetchTimersRef.current.set(path, t);
  };

  const handleNavHoverLeave = (path: string) => {
    const t = prefetchTimersRef.current.get(path);
    if (t) {
      clearTimeout(t);
      prefetchTimersRef.current.delete(path);
    }
  };

  useEffect(() => {
    if (!userRole) return;
    const topPaths = ['/clients', '/publish'];
    let delay = 1000;
    const timers: number[] = [];
    topPaths.forEach((path: string, idx: number) => {
      if (!canPrefetchRoute(path, userRole)) return;
      const t = window.setTimeout(() => {
        prefetchRoute(queryClient, path);
      }, delay + idx * 500);
      timers.push(t);
    });
    return () => {
      timers.forEach((t: number) => clearTimeout(t));
    };
  }, [userRole, queryClient]);

  const navGroups = filterNavGroupsByRole(user?.role);

  const { data: rechargeStats } = useRechargeStats(
    user?.role === 'admin' || user?.role === 'operator',
  );

  const navGroupsWithBadges = useMemo(() => {
    if (!rechargeStats?.pendingCount) return navGroups;
    return navGroups.map((group: NavGroup) => ({
      ...group,
      items: group.items.map((item: NavItem) => {
        if (item.to === '/media-market?tab=market') {
          return { ...item, badge: rechargeStats.pendingCount };
        }
        return item;
      }),
    }));
  }, [navGroups, rechargeStats]);

  const activeItem = useMemo(() => {
    const path = location.pathname;
    const search = location.search;
    for (const group of navGroups) {
      for (const item of group.items) {
        if (isPathActive(item, path, search)) return item;
      }
    }
    return null;
  }, [location.pathname, location.search, navGroups]);

  const handleItemClick = (itemTo: string): void => {
    navigate(itemTo);
    onNavigate?.();
    onItemClick?.();
  };

  const widthStyle = collapsed ? { width: '64px' } : { width: '216px' };

  return (
    <div
      className={cn('flex h-full flex-col border-r transition-all duration-150')}
      style={{ ...widthStyle, backgroundColor: '#FAFBFC', borderColor: '#E6EAF2' }}
    >
      <div
        className={cn('flex h-14 items-center border-b transition-all duration-150', collapsed ? 'justify-center px-0' : 'px-5')}
        style={{ borderColor: '#E6EAF2' }}
      >
        <BrandLogo size={collapsed ? 26 : 30} withText={!collapsed} textSize={15} />
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto">
        {collapsed ? (
          <div className="flex flex-col items-center gap-1 py-4">
            {navGroupsWithBadges.flatMap((group: NavGroup) => group.items).map((item: NavItem) => {
              const Icon = item.icon;
              const isActive = activeItem?.to === item.to;
              return (
                <UniversalLink
                  key={item.to}
                  to={item.to}
                  onMouseEnter={() => handleNavHoverEnter(item.to, isActive)}
                  onMouseLeave={() => handleNavHoverLeave(item.to)}
                  onPointerEnter={() => handleNavHoverEnter(item.to, isActive)}
                  onPointerLeave={() => handleNavHoverLeave(item.to)}
                  onFocus={() => handleNavHoverEnter(item.to, isActive)}
                  onBlur={() => handleNavHoverLeave(item.to)}
                  onClick={(e: React.MouseEvent) => {
                    e.preventDefault();
                    handleItemClick(item.to);
                  }}
                  aria-current={isActive ? 'page' : undefined}
                  title={item.label}
                  aria-label={item.label}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-[6px] transition-colors',
                    isActive
                      ? 'bg-[#EAF2FF] text-[#2E7DFF]'
                      : 'text-[#5B6B85] hover:bg-[#F1F5F9]',
                  )}
                >
                  <Icon className="size-[18px] shrink-0" />
                </UniversalLink>
              );
            })}
          </div>
        ) : (
          <div>
            {navGroupsWithBadges.map((group: NavGroup, groupIndex: number) => (
              <div key={group.label}>
                <div
                  className="text-[11px] font-medium uppercase tracking-[0.05em]"
                  style={{
                    color: '#94A3B8',
                    paddingLeft: '12px',
                    paddingTop: groupIndex === 0 ? '0px' : '16px',
                    paddingBottom: '6px',
                    fontWeight: 500,
                  }}
                >
                  {group.label}
                </div>
                <div className="flex flex-col gap-0.5 px-1.5">
                  {group.items.map((item: NavItem) => {
                    const Icon = item.icon;
                    const isActive = activeItem?.to === item.to;
                    return (
                      <UniversalLink
                        key={item.to}
                        to={item.to}
                        onMouseEnter={() => handleNavHoverEnter(item.to, isActive)}
                        onMouseLeave={() => handleNavHoverLeave(item.to)}
                        onPointerEnter={() => handleNavHoverEnter(item.to, isActive)}
                        onPointerLeave={() => handleNavHoverLeave(item.to)}
                        onFocus={() => handleNavHoverEnter(item.to, isActive)}
                        onBlur={() => handleNavHoverLeave(item.to)}
                        onClick={(e: React.MouseEvent) => {
                          e.preventDefault();
                          handleItemClick(item.to);
                        }}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'relative flex h-10 items-center gap-3 rounded-[6px] px-3 text-[13px] transition-colors',
                          isActive
                            ? 'bg-[#EAF2FF] font-semibold text-[#2E7DFF]'
                            : 'text-[#5B6B85] hover:bg-[#F1F5F9]',
                        )}
                      >
                        {isActive && (
                          <span
                            className="absolute left-0 top-1/2 -translate-y-1/2"
                            style={{ width: '3px', height: '20px', backgroundColor: '#2E7DFF', borderRadius: '0 2px 2px 0' }}
                          />
                        )}
                        <Icon className="size-[18px] shrink-0" />
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge && item.badge > 0 ? (
                          <span
                            className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white"
                            style={{ backgroundColor: '#FF5C5C' }}
                          >
                            {item.badge > 99 ? '99+' : item.badge}
                          </span>
                        ) : null}
                      </UniversalLink>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="h-4" />
          </div>
        )}
      </nav>

      {!collapsed && (
        <div className="border-t p-3" style={{ borderColor: '#E6EAF2' }}>
          <div className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-[#F1F5F9]">
            <div
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-medium text-white"
              style={{ backgroundColor: '#2E7DFF' }}
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <div
                className="truncate text-sm font-medium leading-tight"
                style={{ color: '#0F172A', maxWidth: 120 }}
                title={displayName}
              >
                {displayName}
              </div>
              {roleLabel && (
                <div
                  className="truncate text-xs leading-tight"
                  style={{ color: '#94A3B8', maxWidth: 120 }}
                  title={roleLabel}
                >
                  {roleLabel}
                </div>
              )}
            </div>
            <button
              onClick={logout}
              className="shrink-0 rounded-md p-1.5 hover:bg-slate-200/60"
              style={{ color: '#64748b' }}
              aria-label="退出登录"
              type="button"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;

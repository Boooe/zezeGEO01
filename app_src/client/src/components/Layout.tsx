import { useState, useEffect, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useIsMobile } from '@client/src/hooks/use-mobile';
import {
  Sheet,
  SheetContent,
} from '@client/src/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useAuth } from '@client/src/hooks/useAuth';
import { warmupIdlePrefetch } from '@client/src/lib/prefetch';
import { useQueryClient } from '@tanstack/react-query';

const COLLAPSED_KEY = 'geo:sidebar:collapsed';

function useIsTablet(): boolean {
  const [isTablet, setIsTablet] = useState<boolean>(false);
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 1023px) and (min-width: 768px)');
    const onChange = (): void => setIsTablet(mql.matches);
    mql.addEventListener('change', onChange);
    onChange();
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return isTablet;
}

const Layout = () => {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (isTablet && !sidebarCollapsed) {
      setSidebarCollapsed(true);
    }
  }, [isTablet, sidebarCollapsed]);

  const toggleSidebarCollapse = useCallback(() => {
    setSidebarCollapsed((prev: boolean) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const handleSidebarItemClick = useCallback(() => {
    if (sidebarCollapsed && !isMobile) {
      setSidebarCollapsed(false);
      try {
        window.localStorage.setItem(COLLAPSED_KEY, '0');
      } catch {
        // ignore
      }
    }
  }, [sidebarCollapsed, isMobile]);

  useEffect(() => {
    const targetTitle = '星河GEO';
    document.title = targetTitle;

    let lastSet = targetTitle;
    const checkTitle = (): void => {
      if (document.title !== lastSet) {
        document.title = targetTitle;
        lastSet = targetTitle;
      }
    };

    const timers: number[] = [];
    [50, 200, 800, 2000].forEach((delay: number) => {
      timers.push(window.setTimeout(checkTitle, delay));
    });

    const observer = new MutationObserver(checkTitle);
    observer.observe(document.querySelector('head > title') ?? document.head, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      timers.forEach((t: number) => window.clearTimeout(t));
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (user?.role) {
      warmupIdlePrefetch(queryClient, user.role);
    }
  }, [user?.role, queryClient]);

  const handleCloseSidebar = (): void => {
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* 桌面端/平板：固定侧边栏（支持收起为图标轨道） */}
      {!isMobile && (
        <aside className="hidden shrink-0 md:block">
          <Sidebar
            collapsed={sidebarCollapsed}
            onItemClick={handleSidebarItemClick}
          />
        </aside>
      )}

      {/* 移动端：抽屉式侧边栏 */}
      {isMobile && (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent
            side="left"
            className={cn('!w-[232px] !p-0 border-r-0',
              '[&_[data-slot=sheet-close]]:hidden')}
            style={{ backgroundColor: '#FFFFFF', borderRightColor: '#E8EDF5' }}
          >
            <Sidebar onNavigate={handleCloseSidebar} />
          </SheetContent>
        </Sheet>
      )}

      {/* 主内容区 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          onToggleSidebar={() => setSidebarOpen(true)}
          showMenuButton={isMobile}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebarCollapse={toggleSidebarCollapse}
          showCollapseButton={!isMobile}
        />
        <main
          className="flex-1 overflow-auto"
          style={{ backgroundColor: '#F6F8FC', minHeight: 'calc(100vh - 56px)' }}
        >
          <div className="mx-auto max-w-[1440px] py-6 px-6 md:px-6 px-4">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;

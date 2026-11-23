import { useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, LogOut, PanelLeftClose, PanelLeftOpen, Bell, Search, UserCircle2, Building2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@client/src/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@client/src/components/ui/avatar';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { useAuth } from '@client/src/hooks/useAuth';
import { useBrand } from '@client/src/hooks/useBrandContext';
import { USER_ROLE_LABELS } from '@shared/api.interface';
import { useNavigate } from 'react-router-dom';
import { allNavGroups, filterNavGroupsByRole, isPathActive } from './Sidebar';

/* ========== 品牌选择器 ========== */
const BrandSelector: React.FC = () => {
  const { brands, selectedBrandId, setSelectedBrandId, isLoading } = useBrand();
  const { hasRole } = useAuth();
  const canSwitch = hasRole('admin') || hasRole('operator');

  if (!canSwitch) return null;
  if (isLoading) {
    return (
      <div className="w-[160px] h-8 rounded-[6px] bg-[#F7F9FC] animate-pulse" />
    );
  }
  if (brands.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <Building2 className="size-4 text-[#94A3B8] shrink-0" />
      <Select
        value={selectedBrandId ?? 'all'}
        onValueChange={(val: string) => {
          setSelectedBrandId(val === 'all' ? null : val);
        }}
      >
        <SelectTrigger
          size="sm"
          className="w-[160px] h-8 rounded-[6px] bg-[#F7F9FC] border-transparent hover:border-[#2E7DFF] focus:border-[#2E7DFF] text-[13px]"
        >
          <SelectValue placeholder="选择品牌" />
        </SelectTrigger>
        <SelectContent align="end" className="w-[180px]">
          <SelectItem value="all">全部品牌</SelectItem>
          {brands.map((brand) => (
            <SelectItem key={brand.id} value={brand.id}>
              {brand.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

interface HeaderProps {
  onToggleSidebar?: () => void;
  showMenuButton?: boolean;
  sidebarCollapsed?: boolean;
  onToggleSidebarCollapse?: () => void;
  showCollapseButton?: boolean;
}

const Header = ({
  onToggleSidebar,
  showMenuButton = false,
  sidebarCollapsed = false,
  onToggleSidebarCollapse,
  showCollapseButton = false,
}: HeaderProps) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const displayName = user?.displayName || user?.username || '未登录';
  const roleLabel = user?.role ? USER_ROLE_LABELS[user.role] : '';

  const currentModuleName = useMemo(() => {
    const path = location.pathname;
    const navGroups = filterNavGroupsByRole(user?.role);
    for (const group of navGroups) {
      for (const item of group.items) {
        if (isPathActive(item, path)) return item.label;
      }
    }
    return '';
  }, [location.pathname, user?.role]);

  return (
    <header
      className="flex h-14 items-center border-b bg-white"
      style={{ borderColor: '#E6EAF2', height: '56px' }}
    >
      {/* 左侧：菜单按钮 + 品牌名 + 分隔线 + 当前模块 */}
      <div className="flex items-center px-4">
        {showMenuButton && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            aria-label="切换侧边栏"
            className="mr-2"
          >
            <Menu className="size-5" />
          </Button>
        )}
        <span className="text-[16px] font-semibold text-[#0F172A]">星河GEO</span>
        {currentModuleName && (
          <>
            <div className="w-px h-5 bg-[#E6EAF2] mx-3" />
            <span className="text-[14px] text-[#5B6B85]">{currentModuleName}</span>
          </>
        )}
      </div>

      {/* 右侧：搜索 + 品牌切换 + 通知铃 + 折叠按钮 + 用户信息 */}
      <div className="flex items-center gap-3 ml-auto px-4">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-[#94A3B8]" />
          <Input
            type="search"
            placeholder="搜索..."
            className="h-8 pl-8 rounded-[6px] bg-[#F7F9FC] border-transparent focus:border-[#2E7DFF] text-[13px]"
          />
        </div>
        <BrandSelector />
        <Button
          variant="ghost"
          size="icon"
          aria-label="通知"
          className="hover:bg-[#F7F9FC]"
        >
          <Bell className="size-[18px] text-[#5B6B85]" />
        </Button>
        {showCollapseButton && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebarCollapse}
            aria-label={sidebarCollapsed ? '展开侧栏' : '收起侧栏'}
            className="hover:bg-[#F7F9FC]"
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="size-[18px] text-[#5B6B85]" />
            ) : (
              <PanelLeftClose className="size-[18px] text-[#5B6B85]" />
            )}
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 gap-2 px-2 hover:bg-[#F7F9FC]">
              <Avatar className="size-7">
                <AvatarFallback
                  style={{ backgroundColor: '#2E7DFF', color: '#fff' }}
                >
                  {displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-[13px] font-medium text-[#0F172A]">
                {displayName}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{displayName}</span>
                {roleLabel && (
                  <span className="text-xs text-muted-foreground">
                    {roleLabel}
                  </span>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/account')}>
              <UserCircle2 className="size-4" />
              <span>账号信息</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={logout}>
              <LogOut className="size-4" />
              <span>退出登录</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default Header;

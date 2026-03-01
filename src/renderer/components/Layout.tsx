import React, { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Settings, Menu, Video, ArrowLeft, ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '@renderer/lib/utils';
import { Button } from '@renderer/components/ui/button';
import { Separator } from '@renderer/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@renderer/components/ui/sheet';
import {
  MAIN_MENU_ITEMS,
  SETTINGS_SECTIONS,
  type MenuItem,
  type SettingSection,
} from '@renderer/constants/navigation';

interface LayoutProps {
  children: React.ReactNode;
}

// 导航项组件
interface NavItemProps {
  item: MenuItem;
  active: boolean;
  onNavigate?: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ item, active, onNavigate }) => {
  const navigate = useNavigate();
  const Icon = item.icon;

  const handleClick = useCallback(() => {
    navigate(item.path);
    onNavigate?.();
  }, [navigate, item.path, onNavigate]);

  return (
    <button
      onClick={handleClick}
      className={cn(
        'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors w-full text-left',
        active
          ? 'bg-accent text-accent-foreground font-medium'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      )}
    >
      <Icon className={cn('h-4 w-4', active && 'text-primary')} />
      <span>{item.label}</span>
    </button>
  );
};

// 设置分区导航组件
interface SettingsSectionNavProps {
  sections: readonly SettingSection[];
  onNavigate?: () => void;
}

const SettingsSectionNav: React.FC<SettingsSectionNavProps> = ({ sections, onNavigate }) => {
  const scrollToAnchor = useCallback(
    (anchor: string) => {
      const element = document.getElementById(anchor);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
      onNavigate?.();
    },
    [onNavigate]
  );

  return (
    <div className="px-2 space-y-4">
      <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        应用设置
      </div>
      <div className="space-y-6">
        {sections.map((section) => (
          <div key={section.id} className="px-2">
            <button
              onClick={() => scrollToAnchor(section.anchor)}
              className="w-full text-left px-2 py-1.5 text-sm font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1"
            >
              <ChevronRight className="h-3 w-3" />
              {section.label}
            </button>
            {section.items && section.items.length > 0 && (
              <div className="mt-1 ml-4 border-l-2 border-muted pl-2 space-y-1">
                {section.items.map((subItem) => (
                  <button
                    key={subItem.anchor}
                    onClick={() => scrollToAnchor(subItem.anchor)}
                    className="w-full text-left px-2 py-1.5 text-xs text-muted-foreground hover:text-primary hover:bg-accent rounded-sm transition-all block"
                  >
                    {subItem.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// 主菜单导航组件
interface MainMenuNavProps {
  items: readonly MenuItem[];
  currentPath: string;
  onNavigate?: () => void;
}

const MainMenuNav: React.FC<MainMenuNavProps> = ({ items, currentPath, onNavigate }) => {
  return (
    <nav className="flex flex-col gap-1 p-2">
      {items.map((item) => (
        <NavItem
          key={item.path}
          item={item}
          active={currentPath === item.path}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
};

// 底部返回/设置按钮组件
interface SidebarFooterProps {
  isSettingsMode: boolean;
  currentPath: string;
  onNavigate?: () => void;
}

const SidebarFooter: React.FC<SidebarFooterProps> = ({ isSettingsMode, currentPath, onNavigate }) => {
  const navigate = useNavigate();

  if (isSettingsMode) {
    return (
      <button
        onClick={() => {
          navigate('/download');
          onNavigate?.();
        }}
        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors w-full text-left text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>返回主页</span>
      </button>
    );
  }

  return (
    <NavItem
      item={{ id: 'settings', label: '设置', icon: Settings, path: '/settings' }}
      active={currentPath === '/settings'}
      onNavigate={onNavigate}
    />
  );
};

// 侧边栏内容组件（共享逻辑）
interface SidebarContentProps {
  isSettingsMode: boolean;
  currentPath: string;
  onNavigate?: () => void;
}

const SidebarContent: React.FC<SidebarContentProps> = ({ isSettingsMode, currentPath, onNavigate }) => {
  return (
    <>
      <div className="flex-1 overflow-auto py-2">
        {isSettingsMode ? (
          <SettingsSectionNav sections={SETTINGS_SECTIONS} onNavigate={onNavigate} />
        ) : (
          <MainMenuNav items={MAIN_MENU_ITEMS} currentPath={currentPath} onNavigate={onNavigate} />
        )}
      </div>
      <Separator />
      <div className="p-2">
        <SidebarFooter isSettingsMode={isSettingsMode} currentPath={currentPath} onNavigate={onNavigate} />
      </div>
    </>
  );
};

// Logo 组件
interface LogoProps {
  onClick?: () => void;
}

const Logo: React.FC<LogoProps> = ({ onClick }) => {
  return (
    <div
      className={cn('flex h-14 items-center gap-2 px-4', onClick && 'cursor-pointer')}
      onClick={onClick}
    >
      <Video className="h-5 w-5 text-primary" />
      <div className="font-bold text-primary tracking-tight">Video Download</div>
    </div>
  );
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isSettingsMode = location.pathname.startsWith('/settings');
  const currentPath = location.pathname;

  // 获取当前页面标题
  const pageTitle = isSettingsMode
    ? '设置中心'
    : MAIN_MENU_ITEMS.find((i) => i.path === currentPath)?.label || 'Video Download';

  return (
    <div className="flex h-dvh bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r bg-card sm:flex sm:flex-col">
        <Logo onClick={() => navigate('/download')} />
        <Separator />
        <SidebarContent isSettingsMode={isSettingsMode} currentPath={currentPath} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-14 items-center gap-2 border-b bg-card px-3 sm:px-4 shrink-0">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="sm:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 flex flex-col h-full">
              <SheetHeader className="sr-only">
                <SheetTitle>导航菜单</SheetTitle>
                <SheetDescription>选择要打开的页面或设置项</SheetDescription>
              </SheetHeader>
              <Logo />
              <Separator />
              <SidebarContent isSettingsMode={isSettingsMode} currentPath={currentPath} />
            </SheetContent>
          </Sheet>

          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{pageTitle}</div>
          </div>
        </header>

        {/* Page content */}
        <main className="min-h-0 flex-1 overflow-auto bg-muted/5 p-4 sm:p-6 scroll-smooth">
          <div className="mx-auto w-full max-w-5xl h-full">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default Layout;

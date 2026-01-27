import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Download, Settings, ListChecks, Menu, Video, ArrowLeft, ChevronRight, GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { label: '视频下载', icon: Download, path: '/download' },
    { label: '下载队列', icon: ListChecks, path: '/queue' },
    { label: '英语训练', icon: GraduationCap, path: '/learning' },
  ] as const;

  const settingSections = [
    {
      label: '通用设置',
      id: 'general-section',
      items: [
        { label: '依赖检查', anchor: 'binary-status' },
        { label: '下载路径', anchor: 'download-path' },
      ]
    },
    {
      label: 'Cookie 管理',
      id: 'cookie-section',
      items: [
        { label: '功能开关', anchor: 'cookie-switch' },
        { label: '已保存配置', anchor: 'cookie-list' },
        { label: '获取 Cookie', anchor: 'get-cookie' },
      ]
    }
  ] as const;

  const isSettingsMode = location.pathname.startsWith('/settings');

  const scrollToAnchor = (anchor: string) => {
    const element = document.getElementById(anchor);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const NavItem = ({ item, onNavigate }: { item: { label: string, icon: any, path: string }, onNavigate?: () => void }) => {
    const active = location.pathname === item.path;
    const Icon = item.icon;
    return (
      <button
        onClick={() => {
          navigate(item.path);
          onNavigate?.();
        }}
        className={cn(
          'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors w-full text-left',
          active
            ? 'bg-accent text-accent-foreground font-medium'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        )}
      >
        <Icon className={cn("h-4 w-4", active && "text-primary")} />
        <span>{item.label}</span>
      </button>
    );
  };

  return (
    <div className="flex h-dvh bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r bg-card sm:flex sm:flex-col">
        <div className="flex h-14 items-center gap-2 px-4 cursor-pointer" onClick={() => navigate('/download')}>
          <Video className="h-5 w-5 text-primary" />
          <div className="font-bold text-primary tracking-tight">Listen BD</div>
        </div>
        <Separator />
        <div className="flex-1 overflow-auto py-2">
          {!isSettingsMode ? (
            <nav className="flex flex-col gap-1 p-2">
              {menuItems.map((item) => (
                <NavItem key={item.path} item={item} />
              ))}
            </nav>
          ) : (
            <div className="px-2 space-y-4">
              <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                应用设置
              </div>
              <div className="space-y-6">
                {settingSections.map((section) => (
                  <div key={section.id} className="px-2">
                    <button 
                      onClick={() => scrollToAnchor(section.id)}
                      className="w-full text-left px-2 py-1.5 text-sm font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1"
                    >
                      <ChevronRight className="h-3 w-3" />
                      {section.label}
                    </button>
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
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <Separator />
        <div className="p-2">
          {isSettingsMode ? (
            <button
              onClick={() => navigate('/download')}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors w-full text-left text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>返回主页</span>
            </button>
          ) : (
            <NavItem item={{ label: '设置', icon: Settings, path: '/settings' }} />
          )}
        </div>
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
              <div className="flex h-14 items-center gap-2 px-4">
                <Video className="h-5 w-5 text-primary" />
                <div className="font-semibold text-primary">Listen BD</div>
              </div>
              <Separator />
              <div className="flex-1 overflow-auto py-2">
                {!isSettingsMode ? (
                  <nav className="flex flex-col gap-1 p-2">
                    {menuItems.map((item) => (
                      <NavItem key={item.path} item={item} onNavigate={() => {}} />
                    ))}
                  </nav>
                ) : (
                  <div className="px-2 space-y-4">
                    <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      应用设置
                    </div>
                    <div className="space-y-6">
                      {settingSections.map((section) => (
                        <div key={section.id} className="px-2">
                          <button 
                            onClick={() => {
                              scrollToAnchor(section.id);
                              // Close sheet logic would go here if we had state
                            }}
                            className="w-full text-left px-2 py-1.5 text-sm font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1"
                          >
                            <ChevronRight className="h-3 w-3" />
                            {section.label}
                          </button>
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
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <Separator />
              <div className="p-2">
                {isSettingsMode ? (
                  <button
                    onClick={() => {
                      navigate('/download');
                    }}
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors w-full text-left text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>返回主页</span>
                  </button>
                ) : (
                  <NavItem item={{ label: '设置', icon: Settings, path: '/settings' }} onNavigate={() => {}} />
                )}
              </div>
            </SheetContent>
          </Sheet>

          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">
              {isSettingsMode ? '设置中心' : (menuItems.find(i => i.path === location.pathname)?.label || 'Listen BD')}
            </div>
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


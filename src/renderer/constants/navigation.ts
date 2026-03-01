/**
 * 导航配置常量
 * 集中管理菜单配置，避免重复定义
 */

import { Download, ListChecks, Settings, BookOpen, type LucideIcon } from 'lucide-react';

export interface MenuItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
}

export interface SettingSection {
  id: string;
  label: string;
  anchor: string;
  items?: SettingSubItem[];
}

export interface SettingSubItem {
  label: string;
  anchor: string;
}

// 主菜单项
export const MAIN_MENU_ITEMS: MenuItem[] = [
  {
    id: 'download',
    label: '视频下载',
    path: '/download',
    icon: Download,
  },
  {
    id: 'queue',
    label: '下载队列',
    path: '/queue',
    icon: ListChecks,
  },
];

// 设置页面菜单项
export const SETTINGS_MENU_ITEM: MenuItem = {
  id: 'settings',
  label: '设置',
  path: '/settings',
  icon: Settings,
};

// 学习模块菜单项（可选功能）
export const LEARNING_MENU_ITEM: MenuItem = {
  id: 'learning',
  label: '英语学习',
  path: '/learning',
  icon: BookOpen,
};

// 设置页面分区
export const SETTINGS_SECTIONS: SettingSection[] = [
  {
    id: 'general',
    label: '常规设置',
    anchor: 'general-section',
  },
  {
    id: 'ytdlp',
    label: '下载引擎',
    anchor: 'ytdlp-section',
  },
  {
    id: 'cookie',
    label: 'Cookie 管理',
    anchor: 'cookie-section',
    items: [
      { label: '功能开关', anchor: 'cookie-switch' },
      { label: '已保存配置', anchor: 'cookie-list' },
      { label: '添加配置', anchor: 'get-cookie' },
    ],
  },
];

// 获取所有菜单项
export function getAllMenuItems(includeLearning = false): MenuItem[] {
  const items = [...MAIN_MENU_ITEMS, SETTINGS_MENU_ITEM];
  if (includeLearning) {
    items.push(LEARNING_MENU_ITEM);
  }
  return items;
}

// 检查路径是否为设置页面
export function isSettingsPath(path: string): boolean {
  return path === '/settings' || path.startsWith('/settings/');
}

// 根据路径获取菜单项
export function getMenuItemByPath(path: string): MenuItem | undefined {
  return getAllMenuItems(true).find((item) => item.path === path);
}

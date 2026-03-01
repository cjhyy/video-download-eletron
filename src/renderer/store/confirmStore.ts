import { create } from 'zustand';

interface ConfirmOptions {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
}

interface ConfirmState {
  isOpen: boolean;
  options: ConfirmOptions;
  resolve: ((value: boolean) => void) | null;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  close: (value: boolean) => void;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  isOpen: false,
  options: {
    title: '确认',
    description: '确定要执行此操作吗？',
    confirmText: '确定',
    cancelText: '取消',
    variant: 'default',
  },
  resolve: null,
  confirm: (options) => {
    return new Promise((resolve) => {
      set({
        isOpen: true,
        options: {
          confirmText: '确定',
          cancelText: '取消',
          variant: 'default',
          ...options,
        },
        resolve,
      });
    });
  },
  close: (value) => {
    const { resolve } = get();
    if (resolve) resolve(value);
    set({ isOpen: false, resolve: null });
  },
}));



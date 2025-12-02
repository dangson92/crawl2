// Type definitions for Electron APIs exposed via preload

import { Task } from './types';

export interface ElectronAPI {
  platform: string;
  versions: {
    node: string;
    chrome: string;
    electron: string;
  };
  crawler: {
    findChrome: () => Promise<{ success: boolean; path?: string; error?: string }>;
    crawlHotel: (
      taskId: string,
      url: string,
      headless: boolean,
      chromePath?: string | null
    ) => Promise<{ success: boolean; data?: any; error?: string }>;
    stopCrawl: (taskId: string) => Promise<{ success: boolean; error?: string }>;
    onCrawlerLog: (callback: (data: { taskId: string; message: string; type: string }) => void) => () => void;
  };
  db: {
    saveTask: (task: Task) => Promise<{ success: boolean; error?: string }>;
    getAllTasks: (limit?: number, offset?: number) => Promise<{ success: boolean; data?: Task[]; error?: string }>;
    getTask: (taskId: string) => Promise<{ success: boolean; data?: Task; error?: string }>;
    deleteTask: (taskId: string) => Promise<{ success: boolean; deleted?: boolean; error?: string }>;
    deleteAllTasks: () => Promise<{ success: boolean; error?: string }>;
    getStats: () => Promise<{ success: boolean; data?: any; error?: string }>;
  };
}

declare global {
  interface Window {
    electron: ElectronAPI;
    isElectron: boolean;
  }
}

export {};

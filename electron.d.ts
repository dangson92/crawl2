// Type definitions for Electron APIs exposed via preload

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
}

declare global {
  interface Window {
    electron: ElectronAPI;
    isElectron: boolean;
  }
}

export {};

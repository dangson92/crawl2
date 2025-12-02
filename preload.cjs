const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },

  // Crawler APIs
  crawler: {
    // Find Chrome executable path
    findChrome: () => ipcRenderer.invoke('find-chrome'),

    // Start crawling a hotel
    crawlHotel: (taskId, url, headless, chromePath) =>
      ipcRenderer.invoke('crawl-hotel', { taskId, url, headless, chromePath }),

    // Stop a crawl task
    stopCrawl: (taskId) =>
      ipcRenderer.invoke('stop-crawl', { taskId }),

    // Listen to crawler logs
    onCrawlerLog: (callback) => {
      const subscription = (event, data) => callback(data);
      ipcRenderer.on('crawler-log', subscription);
      // Return unsubscribe function
      return () => ipcRenderer.removeListener('crawler-log', subscription);
    },
  },
});

// Indicate that app is running in Electron
contextBridge.exposeInMainWorld('isElectron', true);

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

  // Database APIs
  db: {
    // Save or update a task
    saveTask: (task) => ipcRenderer.invoke('db-save-task', task),

    // Get all tasks
    getAllTasks: (limit = 1000, offset = 0) =>
      ipcRenderer.invoke('db-get-all-tasks', { limit, offset }),

    // Get a single task by ID
    getTask: (taskId) => ipcRenderer.invoke('db-get-task', taskId),

    // Delete a task
    deleteTask: (taskId) => ipcRenderer.invoke('db-delete-task', taskId),

    // Delete all tasks
    deleteAllTasks: () => ipcRenderer.invoke('db-delete-all-tasks'),

    // Get statistics
    getStats: () => ipcRenderer.invoke('db-get-stats'),
  },
});

// Indicate that app is running in Electron
contextBridge.exposeInMainWorld('isElectron', true);

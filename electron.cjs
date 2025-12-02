const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const TaskDatabase = require('./database/taskDatabase.js');

let mainWindow;
let BookingCrawler = null;
let activeCrawlers = new Map(); // Store active crawler instances
let taskDb = null; // Database instance

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
    backgroundColor: '#f9fafb',
    icon: path.join(__dirname, 'icon.png'),
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    // Development mode: load from Vite dev server
    mainWindow.loadURL('http://localhost:3000');
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    // Production mode: load built files
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Setup IPC Handlers for crawler
function setupIpcHandlers() {
  // Find Chrome executable
  ipcMain.handle('find-chrome', async () => {
    try {
      const module = await import('./crawlers/findChrome.js');
      const findChrome = module.default;
      const chromePath = findChrome();
      return { success: true, path: chromePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Start crawling a hotel
  ipcMain.handle('crawl-hotel', async (event, { taskId, url, headless, chromePath }) => {
    try {
      if (!BookingCrawler) {
        throw new Error('BookingCrawler module not loaded');
      }

      // Create crawler instance
      const crawler = new BookingCrawler({
        headless: headless,
        timeout: 60000,
        executablePath: chromePath || null,
      });

      // Store crawler instance
      activeCrawlers.set(taskId, crawler);

      // Send log messages back to renderer
      const sendLog = (message, type = 'info') => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('crawler-log', { taskId, message, type });
        }
      };

      // Initialize browser
      sendLog('Initializing browser context...', 'info');
      await crawler.init();

      sendLog(`Navigating to ${url}...`, 'info');

      // Crawl hotel
      const result = await crawler.crawlHotel(url);

      sendLog(`Crawl completed successfully!`, 'success');

      // Close browser
      await crawler.close();
      activeCrawlers.delete(taskId);

      return { success: true, data: result };
    } catch (error) {
      console.error('Crawl error:', error);

      // Clean up crawler
      const crawler = activeCrawlers.get(taskId);
      if (crawler) {
        try {
          await crawler.close();
        } catch (e) {
          console.error('Error closing crawler:', e);
        }
        activeCrawlers.delete(taskId);
      }

      return { success: false, error: error.message };
    }
  });

  // Stop/cancel a crawl task
  ipcMain.handle('stop-crawl', async (event, { taskId }) => {
    try {
      const crawler = activeCrawlers.get(taskId);
      if (crawler) {
        await crawler.close();
        activeCrawlers.delete(taskId);
        return { success: true };
      }
      return { success: false, error: 'Crawler not found' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Database operations
  ipcMain.handle('db-save-task', async (event, task) => {
    try {
      if (!taskDb) {
        throw new Error('Database not initialized');
      }
      taskDb.saveTask(task);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('db-get-all-tasks', async (event, { limit, offset }) => {
    try {
      if (!taskDb) {
        throw new Error('Database not initialized');
      }
      const tasks = taskDb.getAllTasks(limit, offset);
      return { success: true, data: tasks };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('db-get-task', async (event, taskId) => {
    try {
      if (!taskDb) {
        throw new Error('Database not initialized');
      }
      const task = taskDb.getTask(taskId);
      return { success: true, data: task };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('db-delete-task', async (event, taskId) => {
    try {
      if (!taskDb) {
        throw new Error('Database not initialized');
      }
      const deleted = taskDb.deleteTask(taskId);
      return { success: true, deleted };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('db-delete-all-tasks', async () => {
    try {
      if (!taskDb) {
        throw new Error('Database not initialized');
      }
      taskDb.deleteAllTasks();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('db-get-stats', async () => {
    try {
      if (!taskDb) {
        throw new Error('Database not initialized');
      }
      const stats = taskDb.getStats();
      return { success: true, data: stats };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

app.whenReady().then(async () => {
  // Load BookingCrawler module
  try {
    const module = await import('./crawlers/bookingCrawler.js');
    BookingCrawler = module.default;
    console.log('BookingCrawler module loaded successfully');
  } catch (error) {
    console.error('Failed to load BookingCrawler:', error);
  }

  // Initialize database
  try {
    taskDb = new TaskDatabase();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
  }

  // Setup IPC handlers
  setupIpcHandlers();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Close database connection
  if (taskDb) {
    taskDb.close();
    console.log('Database connection closed');
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle unhandled errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});

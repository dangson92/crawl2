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
  // Add any IPC methods here if needed in the future
  // send: (channel, data) => {
  //   ipcRenderer.send(channel, data);
  // },
  // on: (channel, func) => {
  //   ipcRenderer.on(channel, (event, ...args) => func(...args));
  // },
});

// Indicate that app is running in Electron
contextBridge.exposeInMainWorld('isElectron', true);

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  closeWindow: () => ipcRenderer.send('window-close'),
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  toggleTop: () => ipcRenderer.send('window-toggle-top'),
  onTopStateChanged: (callback) => ipcRenderer.on('top-state-changed', (_, isTop) => callback(isTop)),
  loadNote: () => ipcRenderer.invoke('load-note'),
  saveNote: (content) => ipcRenderer.send('save-note', content)
});

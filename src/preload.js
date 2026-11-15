const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('plannerStore', {
  load: () => ipcRenderer.invoke('load'),
  save: (data) => ipcRenderer.invoke('save', data),
  setOnTop: (onTop) => ipcRenderer.invoke('set-on-top', onTop),
});

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('plannerStore', {
  load: () => ipcRenderer.invoke('load'),
  save: (data) => ipcRenderer.sendSync('save', data),
  setOnTop: (onTop) => ipcRenderer.invoke('set-on-top', onTop),
});

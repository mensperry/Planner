// The "behind the scenes" part of the app: opens the window and saves your tasks.
const { app, BrowserWindow, ipcMain, screen } = require('electron');
const fs = require('fs');
const path = require('path');

const dataFile = () => path.join(app.getPath('userData'), 'planner-data.json');

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(dataFile(), 'utf8'));
  } catch {
    return null; // first run, or file missing
  }
}

function saveData(data) {
  const file = dataFile();
  const tmp = file + '.tmp';
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file); // swap in one step so a crash never leaves a half-written file
}

let win;

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  const width = Math.max(320, Math.round(workArea.width * 0.2));

  win = new BrowserWindow({
    width,
    height: workArea.height,
    x: workArea.x + workArea.width - width,
    y: workArea.y,
    minWidth: 280,
    title: 'Planner',
    backgroundColor: '#11121c',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, 'index.html'));
}

ipcMain.handle('load', () => loadData());
ipcMain.handle('save', (_e, data) => saveData(data));
ipcMain.handle('set-on-top', (_e, onTop) => {
  if (win) win.setAlwaysOnTop(!!onTop);
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

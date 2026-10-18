const { app, BrowserWindow, dialog, shell } = require('electron');
const path = require('path');
const os = require('os');

process.env.PORT = process.env.PORT || '3000';
require('./server.js');

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 900, minHeight: 600,
    title: 'The Rake Unity Edition',
    backgroundColor: '#050705',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  win.loadURL('http://127.0.0.1:' + process.env.PORT);
  win.webContents.setWindowOpenHandler(({url}) => {
    if (url.startsWith('http://127.0.0.1:') || url.startsWith('http://localhost:')) return {action:'allow'};
    shell.openExternal(url); return {action:'deny'};
  });
  win.on('closed', () => { win = null; });
}
app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

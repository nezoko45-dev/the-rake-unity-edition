const { app, BrowserWindow, shell } = require('electron');
const { startServer } = require('./server.js');

let win;
let serverPort;
async function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 900, minHeight: 600,
    title: 'The Rake Unity Edition', backgroundColor: '#050705',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  await win.loadURL('http://127.0.0.1:' + serverPort);
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://127.0.0.1:' + serverPort)) return { action: 'allow' };
    shell.openExternal(url); return { action: 'deny' };
  });
  win.on('closed', () => { win = null; });
}
app.whenReady().then(async () => {
  try {
    serverPort = await startServer(0);
    await createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  } catch (error) {
    console.error('Unable to start the local game server:', error);
    app.quit();
  }
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

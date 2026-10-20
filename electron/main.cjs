const { app, BrowserWindow, dialog, Tray, Menu, shell, session, nativeImage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { LocalServer, externalURL } = require('./runtime.cjs');

app.setName('Hyxware');
if (process.env.HYXWARE_DESKTOP_DATA_DIR) app.setPath('userData', path.resolve(process.env.HYXWARE_DESKTOP_DATA_DIR));
const development = process.argv.includes('--development');
const background = process.argv.includes('--background');
let mainWindow;
let tray;
let server;
let quitting = false;
let shutdownStarted = false;
let shutdownComplete = false;
let origin;

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();
  mainWindow.show();
  mainWindow.focus();
  if (process.platform === 'darwin') app.dock.show();
}

function openExternal(value) {
  if (externalURL(value)) void shell.openExternal(value).catch(() => {});
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1080, height: 760, minWidth: 360, minHeight: 480,
    show: !background, title: 'Hyxware', icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false,
      contextIsolation: true, sandbox: true,
      backgroundThrottling: false,
      additionalArguments: ['--hyxware-data-dir=' + encodeURIComponent(path.join(app.getPath('userData'), 'data'))],
    },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: 'deny' }; });
  mainWindow.webContents.on('will-navigate', (event, value) => {
    try { if (new URL(value).origin === origin) return; } catch {}
    event.preventDefault();
    openExternal(value);
  });
  mainWindow.on('close', (event) => {
    if (quitting || !tray) return;
    event.preventDefault();
    mainWindow.hide();
    if (process.platform === 'darwin') app.dock.hide();
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  void mainWindow.loadURL(origin).catch((error) => fatal(error));
}

async function fatal(error) {
  if (quitting) return;
  const logPath = path.join(app.getPath('logs'), 'hyxware-desktop-error.log');
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(logPath, `${new Date().toISOString()}\n${error.message}\n${server?.logs.join('') || ''}`, { mode: 0o600 });
  const result = await dialog.showMessageBox({ type: 'error', title: 'Hyxware',
    message: 'Hyxware could not continue.', detail: `${error.message}\n\n${logPath}`,
    buttons: ['Quit', 'Open log folder'], defaultId: 0, cancelId: 0 });
  if (result.response === 1) shell.showItemInFolder(logPath);
  app.quit();
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (origin) showWindow(); });
  app.whenReady().then(async () => {
    try {
      if (development) origin = 'http://localhost:5173';
      else {
        const binaryName = process.platform === 'win32' ? 'hyxware.exe' : 'hyxware';
        const binary = path.join(app.isPackaged ? process.resourcesPath : path.resolve(__dirname, '..', '.desktop-build'), app.isPackaged ? 'bin' : '', binaryName);
        server = new LocalServer(binary, path.join(app.getPath('userData'), 'data'));
        server.onUnexpectedExit = fatal;
        origin = await server.start();
      }
      session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
      session.defaultSession.setPermissionCheckHandler(() => false);
      Menu.setApplicationMenu(Menu.buildFromTemplate([
        { label: 'Hyxware', submenu: [
          { label: 'Show Hyxware', click: showWindow },
          { label: 'Open data folder', click: () => shell.openPath(path.join(app.getPath('userData'), 'data')) },
          { type: 'separator' }, { role: 'quit' },
        ] },
        { role: 'editMenu' },
        { label: 'View', submenu: [{ role: 'reload' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }] },
      ]));
      try {
        tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'icon.png')).resize({ width: 20, height: 20 }));
        tray.setToolTip('Hyxware');
        tray.setContextMenu(Menu.buildFromTemplate([{ label: 'Show Hyxware', click: showWindow }, { label: 'Quit', click: () => app.quit() }]));
        tray.on('click', showWindow);
      } catch { tray = null; }
      createWindow();
    } catch (error) { await fatal(error); }
  });
  app.on('activate', () => { if (origin) showWindow(); });
  app.on('window-all-closed', () => { if (!tray) app.quit(); });
  app.on('before-quit', (event) => {
    quitting = true;
    if (shutdownComplete || !server) return;
    event.preventDefault();
    if (shutdownStarted) return;
    shutdownStarted = true;
    void server.stop().finally(async () => {
      await session.defaultSession.cookies.flushStore().catch(() => {});
      session.defaultSession.flushStorageData();
      tray?.destroy();
      shutdownComplete = true;
      app.quit();
    });
  });
}

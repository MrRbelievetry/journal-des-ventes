const path = require('path');
const { app, BrowserWindow, Menu, dialog, shell, session } = require('electron');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    title: 'Journal des ventes',
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) event.preventDefault();
  });
}

function configureDownloads() {
  session.defaultSession.on('will-download', (event, item) => {
    const savePath = dialog.showSaveDialogSync(mainWindow, {
      title: 'Enregistrer le fichier',
      defaultPath: item.getFilename()
    });
    if (!savePath) {
      item.cancel();
      return;
    }
    item.setSavePath(savePath);
  });
}

function createMenu() {
  const template = [
    {
      label: 'Fichier',
      submenu: [
        { role: 'quit', label: 'Quitter' }
      ]
    },
    {
      label: 'Aide',
      submenu: [
        {
          label: 'A propos',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'A propos',
              message: 'Journal des ventes',
              detail: 'Version 1.0.0\nApplication locale sans telemetrie.'
            });
          }
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  configureDownloads();
  createMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

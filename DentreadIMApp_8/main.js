const { app, BrowserWindow, Menu, ipcMain,dialog } = require('electron');
const path = require('node:path');
const rimraf = require('rimraf');
const fs = require('fs');
const url = require('url');
const { autoUpdater } = require("electron-updater")
autoUpdater.autoDownload = false;
autoUpdater.updateConfigPath = path.join(__dirname, 'update.yml');

autoUpdater.on('update-available', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Available',
    message: 'A new version is available. Do you want to update now?',
    buttons: ['Yes', 'No'],
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.downloadUpdate();
    }
  }),
  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Downloaded',
      message: 'The update has been downloaded. Do you want to install it now?',
      buttons: ['Yes', 'No'],
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  })
});

app.on('ready', () => {
  autoUpdater.checkForUpdates();
});

let mainWindow;
let customDialog;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    icon: path.join(__dirname, 'images/Fav.png'),
    title: 'Dentread',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      
    },
  });

  mainWindow.loadFile('contents/login_dentread.html');
  mainWindow.once('ready-to-show', () => {
    // Check for updates and notify
    autoUpdater.checkForUpdatesAndNotify();
  });
  //mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  ipcMain.handle('ping', () => 'pong');
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  const menuTemplate = [
    {
      label: 'Menu',
      submenu: [
        {
          label: 'Exit',
          click() {
            app.quit();
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(null);
});

function createCustomDialog() {
  customDialog = new BrowserWindow({
    width: 450,
    height: 420,
    parent: mainWindow,
    modal: true,
    show: false,
    minimizable: false,
    maximizable: false,
    icon: path.join(__dirname, 'images/MySettings.png'),
    title: 'Settings',
  });

  customDialog.loadURL(url.format({
    pathname: path.join(__dirname, 'contents/settings.html'),
    protocol: 'file:',
    slashes: true,
  }));

  customDialog.setMenu(null);

  customDialog.once('ready-to-show', () => {
    customDialog.show();
  });

  customDialog.on('closed', () => {
    customDialog = null;
  });
}

ipcMain.handle('open-settings', () => {
  if (!customDialog) {
    createCustomDialog();
  }

  return true;
});

app.on('window-all-closed', () => {
  const projectPath = './';
  const directoryPath = path.join(projectPath, 'Dentread');

  if (fs.existsSync(directoryPath)) {
    rimraf.sync(directoryPath);
    console.log(`Directory deleted: ${directoryPath}`);
  } else {
    console.log('Directory does not exist');
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

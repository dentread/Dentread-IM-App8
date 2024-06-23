const { app, BrowserWindow, Menu, ipcMain, dialog, Tray  } = require('electron');
const path = require('node:path');
const fs = require('fs');
const url = require('url');
const notifier = require('node-notifier');
const cron = require('node-cron');
const { exec } = require('child_process');

let tray;


let isUpdateInProgress = false;



const { autoUpdater,AppUpdater } = require("electron-updater");


autoUpdater.autoDownload = false;


const pidFilePath = './notificationProcess.pid';

let notificationProcess = null;




app.on('ready', () => {
  autoUpdater.checkForUpdates();

  autoUpdater.on('update-available', () => {
    isUpdateInProgress = true;
    autoUpdater.downloadUpdate();

    autoUpdater.on('update-downloaded', () => {
      console.log('Update downloaded. Ready to install.');
      app.removeAllListeners('before-quit');
      autoUpdater.quitAndInstall();
    });
  });

  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for update...');
  });

  autoUpdater.on('update-not-available', () => {
    console.log('Update not available.');
  });

  autoUpdater.on('error', (err) => {
    console.error('Error in auto-updater:', err);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    console.log(`Download speed: ${progressObj.bytesPerSecond}`);
    console.log(`Downloaded ${progressObj.percent}%`);
  });

  tray = new Tray(path.join(__dirname, 'images/LogoDentread.png'));




});



function retrieveNotificationProcess() {
  if (fs.existsSync(pidFilePath)) {
    const pid = parseInt(fs.readFileSync(pidFilePath, 'utf8'));
    try {
      process.kill(pid, 0); 
      notificationProcess = pid;
    } catch (error) {
      fs.unlinkSync(pidFilePath);
    }
  }
}


function stopNotificationProcess() {
  if (notificationProcess) {
    try {

      process.kill(notificationProcess);
      notificationProcess = null;
      fs.unlinkSync(pidFilePath);
    } catch (error) {
      console.error(`Error killing notification process: ${error}`);
    }
  }
}

let mainWindow;
let customDialog;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    icon: path.join(__dirname, 'images/LogoDentread.png'),
    title: 'Dentread',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
    },
  });


  mainWindow.loadFile('contents/login_dentread.html');
  retrieveNotificationProcess();

  stopNotificationProcess();

  function sendTestNotification() {
    setTimeout(function() {
      notifier.notify({
        title: 'IM App Session Expiry',
        message: 'Your IM App session will expire soon please logout and login again',
        sound: true,
        wait: true,
        icon: path.join(__dirname, 'images/LogoDentread.png'),

      });
    }, 2147483647);
  }
  sendTestNotification();

  function preventClose(event) {
    event.preventDefault();
  
    try {
      const { dialog } = require('electron');
      dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: 'Warning',
        message: 'Closing the window is not allowed while auto sync is on.',
        buttons: ['OK']
      });
    } catch (error) {
      console.error('Error showing warning dialog:', error);
    }
  }
  mainWindow.once('ready-to-show', () => {
    autoUpdater.checkForUpdatesAndNotify();

    ipcMain.on('toggle-auto-sync', (event, status, syncedFoldersJSON) => {
      if (status) {
        mainWindow.hide();

          mainWindow.on('close', preventClose);

          const contextMenu = Menu.buildFromTemplate([
            { label: 'Open', click: () => mainWindow.show() },
            { type: 'separator' },
            { label: 'Quit', role: 'quit' }
          ]);
        
          tray.setContextMenu(contextMenu);
        
          tray.on('click', () => {
            if (!mainWindow.isVisible()) {
              mainWindow.show();
            } else {
              mainWindow.focus();
            }
          });
  
          function updateNotification() {
              const syncedFoldersArray = JSON.parse(syncedFoldersJSON);
              console.log(syncedFoldersArray, "syncedFoldersArray");
  
              if (Array.isArray(syncedFoldersArray)) {
                  const totalCount = syncedFoldersArray.length;
  
                  notifier.notify({
                      title: 'Dentraed IM App Sync Update',
                      message: `Total Synced ${totalCount} Scans.`,
                      sound: true,
                      wait: true,
                      icon: path.join(__dirname, 'images/LogoDentread.png'),

                  });
              } else {
                  console.error('Synced folders array not found in local storage.');
              }
          }
       
        try {
          const intervalId = setInterval(updateNotification, 2 * 60 * 60 * 1000);}
          catch (error) {
            console.error('Error in auto-update process:', error);
          }

      } else {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.removeListener('close', preventClose);
      }
     
    });
  });


  mainWindow.on('close', async(event) => {
    if (isUpdateInProgress) {
      return;
    }
    const choice = require('electron').dialog.showMessageBoxSync(mainWindow, {
      type: 'question',
      buttons: ['Yes', 'No'],
      title: 'Confirm',
      message: 'Are you sure you want to close the application?'

      
    })


    if (choice === 0) {
      const response = await mainWindow.webContents.executeJavaScript(`window.versions.deleteDirectory()`);
    }
    else {
      event.preventDefault();
    }
    
  })

  
  // mainWindow.webContents.openDevTools();

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
    width: 600,
    height: 450,
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

let customlog;
function createcustomlog() {
  customlog = new BrowserWindow({
    width: 500,
    height: 500,
    parent: mainWindow,
    modal: true,
    show: false,
    minimizable: false,
    maximizable: false,
    icon: path.join(__dirname, 'images/PlusFolder.png'),
    title: 'Log',
  });


  customlog.loadURL(url.format({
    pathname: path.join(__dirname, 'contents/log.html'),
    protocol: 'file:',
    slashes: true,
  }));

  customlog.setMenu(null);

  customlog.once('ready-to-show', () => {
    customlog.show();
  });

  customlog.on('closed', () => {
    customlog = null;
  });
}

ipcMain.handle('open-logs', () => {
  if (!customlog) {
    createcustomlog();
    
  }


  return true;
});


ipcMain.on('logInfo', (event, message) => {
  const logWindow = BrowserWindow.getAllWindows().find(window => window.getTitle() === 'Log');
  if (logWindow) {
    logWindow.webContents.send('logInfo', message);
  }
});

ipcMain.on('logError', (event, error) => {
  const logWindow = BrowserWindow.getAllWindows().find(window => window.getTitle() === 'Log');
  if (logWindow) {
    logWindow.webContents.send('logError', error);
  }
});



app.on('before-quit', () => {
  function startNotificationProcess() {
    const { spawn } = require('child_process');
    const nodePath = process.execPath;
    const notificationProcess = spawn(nodePath, ['notification.js'], {
      detached: true,
      stdio: ['ignore', 'ignore', 'ignore'],
    });

    notificationProcess.unref();

    notificationProcess.on('error', (error) => {
      console.error(`Error starting notification process: ${error}`);
    });

    notificationProcess.on('exit', (code) => {
      console.log(`Notification process exited with code ${code}`);
      fs.unlinkSync(pidFilePath);
    });

    notificationProcess.on('spawn', () => {
      fs.writeFileSync(pidFilePath, notificationProcess.pid.toString());
    });
  }

  startNotificationProcess();
});

let customSchedule;
function createCustomScheduler() {
  customSchedule = new BrowserWindow({
    width: 520,
    height: 420,
    parent: mainWindow,
    modal: true,
    show: false,
    minimizable: false,
    maximizable: false,
    icon: path.join(__dirname, 'images/MySettings.png'),
    title: 'Scheduler',
  });


  customSchedule.loadURL(url.format({
    pathname: path.join(__dirname, 'contents/Scheduler.html'),
    protocol: 'file:',
    slashes: true,
  }));

  customSchedule.setMenu(null);

  customSchedule.once('ready-to-show', () => {
    customSchedule.show();
  });

  customSchedule.on('closed', () => {
    customSchedule = null;
    mainWindow.reload();
  });
}

ipcMain.handle('open-scheduler', () => {
  if (!customSchedule) {
    createCustomScheduler();
  }
  return true;


});



ipcMain.handle('open-reload-manual', () => {
  mainWindow.reload();
  return true;

});

// app.on('window-all-closed', () => {
//   const projectPath = './';
//   const directoryPath = path.join(projectPath, 'Dentread');

//   if (fs.existsSync(directoryPath)) {
//     rimraf.sync(directoryPath);
//     console.log(`Directory deleted: ${directoryPath}`);
//   } else {
//     console.log('Directory does not exist');
//   }

//   if (process.platform !== 'darwin') {
//     app.quit();
//   }
// });
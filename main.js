const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-gpu-rasterization');
app.commandLine.appendSwitch('in-process-gpu');

let mainWindow = null;
let tray = null;
let isQuitting = false;

const appName = '桌面便签';
const userDataPath = app.isPackaged
  ? path.join(path.dirname(app.getPath('exe')), 'user-data')
  : path.join(__dirname, '.user-data');

app.setPath('userData', userDataPath);

const dataPath = path.join(app.getPath('userData'), 'note.txt');
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

function readSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }

  return {};
}

function writeSettings(nextSettings) {
  try {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(nextSettings, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  const settings = readSettings();
  settings.bounds = mainWindow.getBounds();
  settings.alwaysOnTop = mainWindow.isAlwaysOnTop();
  writeSettings(settings);
}

function getInitialBounds(settings) {
  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
  const defaults = {
    width: 320,
    height: 420,
    x: screenWidth - 340,
    y: 80,
  };

  return {
    ...defaults,
    ...(settings.bounds || {}),
  };
}

function createTray() {
  const iconPath = path.join(__dirname, 'build', 'icon.png');
  const fallbackIcon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAIRJREFUOE9jZKAQMFKon2HUAIb/MOoARnCAIb3EoGsgbgwMDP9jYGBg+M/AwMBwDYjAqIBpIDYQG4jNw8DAwPD/NhCbC0TPgAmgGohaS4G4DEQnCDYQG4hNhqIhGxgYGBh+MDAw/GeAYf4HZM8A0TMAiWAyR6IhG0iOqEwAAAk/IswUealVAAAAAElFTkSuQmCC';
  const icon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
    : nativeImage.createFromDataURL(fallbackIcon);

  tray = new Tray(icon);
  tray.setToolTip(appName);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示便签', click: () => mainWindow?.show() },
    { label: '隐藏便签', click: () => mainWindow?.hide() },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]));

  tray.on('click', () => {
    if (!mainWindow) {
      return;
    }

    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  const settings = readSettings();
  const bounds = getInitialBounds(settings);

  mainWindow = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    alwaysOnTop: settings.alwaysOnTop ?? true,
    resizable: true,
    skipTaskbar: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setMinimumSize(260, 260);
  mainWindow.loadFile('index.html');

  mainWindow.on('close', (event) => {
    saveWindowState();

    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('moved', saveWindowState);
  mainWindow.on('resized', saveWindowState);

  if (!tray) {
    createTray();
  }
}

ipcMain.handle('load-note', () => {
  try {
    if (fs.existsSync(dataPath)) {
      return fs.readFileSync(dataPath, 'utf-8');
    }
  } catch (error) {
    console.error('Failed to load note:', error);
  }

  return '';
});

ipcMain.on('save-note', (_event, content) => {
  try {
    fs.mkdirSync(path.dirname(dataPath), { recursive: true });
    fs.writeFileSync(dataPath, content, 'utf-8');
  } catch (error) {
    console.error('Failed to save note:', error);
  }
});

ipcMain.on('window-close', () => {
  mainWindow?.close();
});

ipcMain.on('window-minimize', () => {
  mainWindow?.minimize();
});

ipcMain.on('window-toggle-top', () => {
  if (!mainWindow) {
    return;
  }

  const nextState = !mainWindow.isAlwaysOnTop();
  mainWindow.setAlwaysOnTop(nextState);
  saveWindowState();
  mainWindow.webContents.send('top-state-changed', nextState);
});

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(createWindow);
}

app.on('before-quit', () => {
  isQuitting = true;
  saveWindowState();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    mainWindow?.show();
  }
});

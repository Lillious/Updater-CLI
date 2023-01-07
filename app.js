const { app, BrowserWindow, ipcMain } = require('electron');
const crash = (err) => { console.error(`\x1b[31m${err}\x1b[0m`); process.exit(1); };
const path = require('path');
const fs = require('fs');
const url = app.commandLine.getSwitchValue("url");
const installPath = app.commandLine.getSwitchValue("install");
const executablePath = app.commandLine.getSwitchValue("executablepath");
const executable = app.commandLine.getSwitchValue("executable");
const appname = app.commandLine.getSwitchValue("appname");
const { exec } = require('child_process');
const os = require('os');

// Kill app if it's already running
if (appname) {
    exec(`taskkill /f /im ${appname}`, (err, stdout, stderr) => {
        if (err) {
            console.log(err);
        }
    });
}

// Delete temp config file if it exists
if (fs.existsSync (path.join(__dirname, 'config.json'), (err) => { crash(err); })) {
    fs.unlinkSync(path.join(__dirname, 'config.json'));
}

// Create temp config file with arguments
const config = {
    "url": url,
    "installPath": installPath,
    "tempPath": os.tmpdir(),
    "executablePath": executablePath,
    "executable": executable
};

// Write config file
fs.writeFileSync(path.join(__dirname, 'config.json'), JSON.stringify(config), (err) => {crash(err); });

// Attempt to delete temp config file on exit
process.on('exit', () => {
    fs.unlinkSync(path.join(__dirname, 'config.json'));
});

// If the app crashes, delete the temp config file
process.on('uncaughtException', (err) => {
    fs.unlinkSync(path.join(__dirname, 'config.json'));
    crash(err);
});

const createWindow = () => {
    const win = new BrowserWindow({
        width: 600,
        minWidth: 600,
        maxWidth: 600,
        height: 250,
        minHeight: 250,
        maxHeight: 250,
        frame: false,
        darkTheme: true,
        resizable: true,
        webPreferences: {
            nodeIntegration: true,
            nodeIntegrationInWorker: true,
            contextIsolation: false,
            sandbox: false,
            spellcheck: false,
            enableRemoteModule: true,
        }
    });
    win.loadFile(`./src/index.html`)
    .catch((err) => { crash(err); });
}

app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
})
.catch((err) => { crash(err); });

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

ipcMain.on('close', () => {
    app.quit();
});

ipcMain.on('minimize', () => {
    BrowserWindow.getAllWindows()[0].minimize();
});
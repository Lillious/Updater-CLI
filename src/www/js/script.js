const { ipcRenderer } = require('electron');
const close = document.getElementById('close');
const minimize = document.getElementById('minimize');
const path = require('path');
const request = require('request');
const unzipper = require('unzipper');
const fs = require('fs');

close.addEventListener('click', () => {
    ipcRenderer.send('close');
});

minimize.addEventListener('click', () => {
    ipcRenderer.send('minimize');
});

// Read config file
const config = require(path.join(__dirname, '../config.json'));
const url = config.url;
const installPath = config.installPath;
const executablePath = config.executablePath;
const executable = config.executable;
const tempPath = config.tempPath;

// Check if url is a valid link
if (url) {
    // Check if url ends in .zip or .exe
    if (url.endsWith('.zip') || url.endsWith('.exe')) {
            // Download file if url is valid
            getInstallerFile(url).then(() => {
                // Extract package.zip file to installPath location
                extractFiles(path.join(tempPath, 'package.zip'), path.join(installPath)).then(() => {
                    showToast('success', 'Successfully installed package');
                    document.getElementById('toast').innerHTML = "";
                    // delete package.zip file
                    fs.unlinkSync(path.join(tempPath, 'package.zip'), (err) => {
                        if (err) {
                            console.log(err);
                            showToast('error', 'Failed to delete package.zip');
                        }
                    });
                    // Run executable if the option is provided
                    if (executable != '') {
                        showToast('success', `Opening ${executable}`);
                        // Run executable externally and then close the current window
                        require('child_process').exec(`cd "${executablePath}" && start ${executable}`, (err) => {
                            if (err) {
                                console.log(err);
                                showToast('error', `Failed to open ${executable}`);
                            } else {
                                setTimeout(() => {
                                    ipcRenderer.send('close');
                                }, 3000);
                            }
                        });
                        setTimeout(() => {
                            ipcRenderer.send('close');
                        }, 3000);
                    } else {
                        setTimeout(() => {
                            ipcRenderer.send('close');
                        }, 3000);
                    }
                }).catch((err) => {
                    console.log(err);
                    showToast('error', 'Failed to extract installer file');
                });
            }).catch((err) => {
                console.log(err);
                showToast('error', 'Failed to download installer file');
            });
    } else {
        showToast('error', 'URL is not a valid installer file');
    }
} else {
    showToast('error', 'URL was not provided');
}

function showToast (mode, message) {
    const NotificationContainer = document.createElement('div');
    const NotificationContent = document.createElement('div');
    const NotificationClose = document.createElement('div');
    NotificationContainer.classList.add('notification-bar');
    NotificationContent.classList.add('notification-content');
    NotificationContent.innerHTML = message;
    NotificationContainer.appendChild(NotificationContent);
    // Shift the element up by 50px for each notification that isn't on the screen
    NotificationContainer.style.marginTop = `${50 * document.getElementsByClassName('notification-bar').length}px`;
    if (mode === 'success') {
        // Green
        NotificationContainer.style.borderRight = '4px solid #238636';
    } else if (mode === 'error') {
        // Red
        NotificationContainer.style.borderRight = '4px solid #ed6a5e';
    } else if (mode === 'information') {
        // Blue
        NotificationContainer.style.borderRight = '4px solid #2a9d8f';
    }
    document.body.appendChild(NotificationContainer);
    NotificationClose.addEventListener('click', () => {
        document.body.removeChild(NotificationContainer);
    });
    setTimeout(() => {
        document.body.removeChild(NotificationContainer);
    }, 3000);
}

function getInstallerFile (installerfileURL) {
    // split the url into an array of strings using the / as a separator
    const urlArray = installerfileURL.split('/');
    // get the last item in the array
    const filename = urlArray[urlArray.length - 1];
    // Variable to save downloading progress
    var received_bytes = 0;
    var total_bytes = 0;
    // Download to temp folder and save as package.zip
    var outStream = fs.createWriteStream(path.join(tempPath, 'package.zip'));
    // Create new promise with the Promise() constructor;
    return new Promise((resolve, reject) => {
        request
            .get(installerfileURL)
                .on('error', function(err) {
                    console.log(err);
                    reject(err);
                })
                .on('response', function(data) {
                    total_bytes = parseInt(data.headers['content-length']);
                })
                .on('data', function(chunk) {
                    document.getElementById('toast').innerHTML = `Downloading ${filename}`;
                    received_bytes += chunk.length;
                    showDownloadingProgress(received_bytes, total_bytes);
                })
                .on('end', function() {
                    resolve();
                })
                .pipe(outStream);
    })
};

function showDownloadingProgress(received, total) {
    var percentage = ((received * 100) / total).toFixed(1);
    document.getElementById('progress-text').innerHTML = percentage + '%';
    // Set progress bar width to percentage
    document.getElementById('progress').style.width = percentage + '%';
    if (document.getElementById('progress-text').innerHTML == '100.0%') {
        document.getElementById('progress-text').innerHTML = '0%'
        document.getElementById('progress-container').style.display = 'none';
        document.getElementById('toast').innerHTML = '';
    } else {
        document.getElementById('progress-container').style.display = 'block';
    }
}

function extractFiles (file, filePath) {
    return new Promise((resolve, reject) => {
        fs.createReadStream(file)
        .pipe(unzipper.Parse())
        .on('entry', function (entry) {
            const fileName = entry.path;
            const type = entry.type; // 'Directory' or 'File'
            // Ignore the update directory because we don't want to overwrite the current app
            if (type === 'Directory') {
                if (!fileName.startsWith('update')) {
                    if (!fileName.startsWith('locales')) {
                        // Check if directory is called update and ignore it because we don't want to overwrite the current app
                        // Check if directory exists and overwrite if it does
                        if (fs.existsSync(path.join(filePath, fileName))) {
                            fs.rmdirSync(path.join(filePath, fileName), { recursive: true });
                        }
                        fs.mkdir(path.join(filePath, fileName), (err) => {
                            if (err) throw err;
                        });
                    } else {
                        entry.autodrain();
                    }
                } else {
                    entry.autodrain();
                }
            } else {
                // Check if the folder is called update and ignore it because we don't want to overwrite the current app
                if (!fileName.includes('update/') && !fileName.endsWith('.bin') && !fileName.includes('resources.pak')) {
                    document.getElementById('toast').innerHTML = `Extracting ${fileName}`
                    // Check if file exists and overwrite if it does
                    if (fs.existsSync(path.join(filePath, fileName))) {
                        fs.rmSync(path.join(filePath, fileName));
                    }
                    entry.pipe(fs.createWriteStream(path.join(filePath, fileName)));
                } else {
                    entry.autodrain();
                }
            }
        }).on('close', () => {
            resolve();
        }).on('error', (err) => {
            console.log(err);
            reject(err);
        }).on('finish', () => {
            resolve();
        });
    });
}
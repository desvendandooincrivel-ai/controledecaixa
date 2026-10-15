const path = require("node:path");
const fs = require("node:fs");
const { app, BrowserWindow, dialog, shell } = require("electron");

const APP_PORT = process.env.CONTROLE_CAIXA_PORT || "31742";
let mainWindow = null;
let logFile = null;

if (process.env.CONTROLE_CAIXA_USER_DATA_DIR) {
  app.setPath("userData", process.env.CONTROLE_CAIXA_USER_DATA_DIR);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

function writeLog(message, error) {
  const line = `[${new Date().toISOString()}] ${message}${error ? `\n${error.stack || error.message || error}` : ""}\n`;
  console.log(line);

  if (!logFile) return;
  try {
    fs.appendFileSync(logFile, line, "utf8");
  } catch (_) {
    // Logging must never block the app startup.
  }
}

function showStartupError(error) {
  writeLog("Falha ao iniciar o aplicativo.", error);
  dialog.showErrorBox(
    "Controle de Caixa não abriu",
    `O aplicativo encontrou um erro ao iniciar.\n\nDetalhes: ${error.message || error}\n\nLog: ${logFile || "não disponível"}`
  );
}

function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const attempt = async () => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          resolve();
          return;
        }
      } catch (_) {
        // Server is still starting.
      }

      if (Date.now() - start >= timeoutMs) {
        reject(new Error(`Servidor local não respondeu em ${url}`));
        return;
      }

      setTimeout(attempt, 250);
    };

    attempt();
  });
}

function startLocalServer() {
  process.env.NODE_ENV = "production";
  process.env.HOST = "127.0.0.1";
  process.env.PORT = APP_PORT;
  process.env.APP_VERSION = app.getVersion();

  writeLog(`Iniciando servidor local na porta ${APP_PORT} (v${app.getVersion()}).`);
  require(path.join(app.getAppPath(), "dist", "server.cjs"));
}

async function createWindow() {
  logFile = path.join(app.getPath("userData"), "startup.log");
  writeLog("Iniciando Controle de Caixa.");
  startLocalServer();
  const appUrl = `http://127.0.0.1:${APP_PORT}/`;
  await waitForServer(appUrl);
  writeLog(`Servidor local respondeu em ${appUrl}.`);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: "#f8fafc",
    title: "Controle de Caixa",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://accounts.google.com")) {
      return { 
        action: "allow",
        overrideBrowserWindowOptions: {
          width: 500,
          height: 600,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
          }
        }
      };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  await mainWindow.loadURL(appUrl);
}

// Override user agent globally for all windows to bypass Google OAuth embedded browser block
app.on("web-contents-created", (event, contents) => {
  contents.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
});

app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

app.whenReady().then(() => {
  createWindow().catch((error) => {
    showStartupError(error);
    app.quit();
  });
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow().catch((error) => {
      showStartupError(error);
      app.quit();
    });
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

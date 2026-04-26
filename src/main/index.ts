// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

// Fix macOS PATH for packaged apps (must run before any CLI detection)
try {
  const fixPath = require('fix-path');
  fixPath();
} catch {
  // Graceful fallback — append common paths manually including expanded nvm versions
  if (process.platform === 'darwin') {
    const home = process.env.HOME || '';
    const fs = require('fs') as typeof import('fs');

    // Expand nvm node versions so `node` is findable even when fix-path fails
    const nvmBins: string[] = [];
    if (home) {
      const nvmDir = `${home}/.nvm/versions/node`;
      try {
        const versions = fs.readdirSync(nvmDir).sort().reverse(); // latest first
        for (const ver of versions) {
          const bin = `${nvmDir}/${ver}/bin`;
          try { if (fs.statSync(bin).isDirectory()) nvmBins.push(bin); } catch {}
        }
      } catch {}
    }

    const extra = [
      '/usr/local/bin',
      '/opt/homebrew/bin',
      '/usr/local/sbin',
      home ? `${home}/.claude/local` : '',
      home ? `${home}/.npm-global/bin` : '',
      home ? `${home}/.volta/bin` : '',
      ...nvmBins,
    ].filter(Boolean).join(':');
    process.env.PATH = process.env.PATH ? `${process.env.PATH}:${extra}` : extra;
  } else if (process.platform === 'win32') {
    const pf = process.env.ProgramFiles || 'C:\\Program Files';
    const pfx86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const localApp = process.env.LOCALAPPDATA || '';
    const extra = [
      `${pf}\\Google\\Cloud SDK\\google-cloud-sdk\\bin`,
      `${pfx86}\\Google\\Cloud SDK\\google-cloud-sdk\\bin`,
      localApp ? `${localApp}\\Google\\Cloud SDK\\google-cloud-sdk\\bin` : '',
    ].filter(Boolean).join(';');
    process.env.PATH = process.env.PATH ? `${process.env.PATH};${extra}` : extra;
  }
}

import { app, BrowserWindow, session, shell } from 'electron';
import path from 'path';
import { registerIpcHandlers, getMcpClientManager } from './ipc';
import { DatabaseManager } from './database/db-manager';
import { initScheduler, getScheduler } from './scanning/scan-scheduler';
import { getEnvironmentChecker } from './health/environment-checker';
import { setGcloudResolverDB } from './gcp/gcloud-resolver';
import { GCPCredentialManager } from './gcp/credential-manager';
import { getGCPAuthManager } from './gcp/auth-manager';
import { setGCPDbManagerRef, cleanupAllTempCredFiles } from './gcp/auth-factory';

// Suppress EPIPE on stdout/stderr — in packaged macOS apps launched from
// Finder/Dock, these pipes connect to ASL and can break. Without this,
// any console.log() would throw an uncaught EPIPE and crash the app.
process.stdout?.on('error', (err: any) => { if (err?.code !== 'EPIPE') throw err; });
process.stderr?.on('error', (err: any) => { if (err?.code !== 'EPIPE') throw err; });

process.on('uncaughtException', (err) => {
  if ((err as NodeJS.ErrnoException).code === 'EPIPE') return;
  // Use process.stderr.write instead of console.error to avoid recursive EPIPE
  try { process.stderr.write(`[main] Uncaught: ${err.stack || err.message}\n`); } catch {}
});

let mainWindow: BrowserWindow | null = null;
let dbManager: DatabaseManager | null = null;
let ipcRegistered = false;

const isDev = !app.isPackaged;

async function initServices() {
  if (!dbManager) {
    dbManager = new DatabaseManager();
    await dbManager.initialize();
    setGcloudResolverDB(dbManager);
    setGCPDbManagerRef(dbManager);
  }
  if (!ipcRegistered) {
    registerIpcHandlers(dbManager);
    ipcRegistered = true;
    initScheduler(dbManager);

    // Prune old data on startup
    try {
      const pruned = dbManager.pruneOldScans(90, 10);
      const snapshotsPruned = dbManager.pruneOldSnapshots(90);
      const costCachePruned = dbManager.pruneGCPCostCache(90, 20);
      if (pruned > 0 || snapshotsPruned > 0 || costCachePruned > 0) {
        console.log(`[main] Pruned ${pruned} old scans, ${snapshotsPruned} old snapshots, ${costCachePruned} old cost cache entries`);
      }
    } catch (err) {
      console.error('[main] Failed to prune old data:', err);
    }
  }
}

async function createWindow() {
  await initServices();

  // Pre-cache environment health in background (non-blocking)
  getEnvironmentChecker().runAllChecks().catch(() => {});

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  });

  // Attach before loadURL so the event isn't missed
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Content Security Policy
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          isDev
            ? "default-src 'self'; script-src 'self' 'unsafe-inline' http://localhost:5173; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' ws://localhost:5173 http://localhost:5173 https://*.amazonaws.com https://fonts.googleapis.com https://fonts.gstatic.com"
            : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://*.amazonaws.com https://*.googleapis.com https://fonts.googleapis.com https://fonts.gstatic.com",
        ],
      },
    });
  });

  const indexPath = path.join(__dirname, '../renderer/index.html');
  if (isDev) {
    console.log('[main] isDev:', isDev);
    console.log('[main] NODE_ENV:', process.env.NODE_ENV);
    console.log('[main] index.html path:', indexPath);
    console.log('[main] file exists:', require('fs').existsSync(indexPath));
  }

  if (isDev) {
    await mainWindow.loadURL('http://localhost:5173');
  } else {
    await mainWindow.loadFile(indexPath);
  }

  // Open DevTools in dev mode only
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Log renderer errors to main console
  mainWindow.webContents.on('console-message', (_event, level, message) => {
    if (isDev) {
      const prefix = ['LOG', 'WARN', 'ERROR'][level] || 'LOG';
      console.log(`[renderer:${prefix}] ${message}`);
    } else if (level === 2) {
      console.error(`[renderer:ERROR] ${message}`);
    }
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error(`[main] did-fail-load: ${errorCode} ${errorDescription}`);
  });

  // Security: restrict navigation to app origin only
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = isDev ? 'http://localhost:5173' : 'file://';
    if (!url.startsWith(allowed)) {
      event.preventDefault();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  getScheduler()?.stop();
  getMcpClientManager()?.shutdown().catch(() => {});
  cleanupAllTempCredFiles();
  dbManager?.close();
});

// Export for IPC handlers
export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function getDatabaseManager(): DatabaseManager | null {
  return dbManager;
}

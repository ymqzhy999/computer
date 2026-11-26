import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join, dirname } from 'node:path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 捕获未处理的全局异常并弹出提示
process.on('uncaughtException', (error) => {
  console.error('[Main Uncaught Exception]', error)
  dialog.showErrorBox('应用运行异常', `主进程发生未捕获异常:\n${error.stack || error.message}`)
})

process.on('unhandledRejection', (reason) => {
  console.error('[Main Unhandled Rejection]', reason)
})

// 单实例锁：防止多次双击导致多进程冲突
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}

// 启用 GPU 硬件加速开关，确保 Three.js WebGL 与 WebAudio 高性能运行
app.commandLine.appendSwitch('ignore-gpu-blocklist')
app.commandLine.appendSwitch('enable-gpu-rasterization')
app.commandLine.appendSwitch('enable-zero-copy')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
let mainWindow: BrowserWindow | null = null

// 窗口状态记忆
interface WindowState {
  width: number
  height: number
  x?: number
  y?: number
  isMaximized?: boolean
}

function getWindowStatePath(): string {
  const userDir = app.getPath('userData')
  if (!existsSync(userDir)) mkdirSync(userDir, { recursive: true })
  return join(userDir, 'window-state.json')
}

function loadWindowState(): WindowState {
  try {
    const file = getWindowStatePath()
    if (existsSync(file)) {
      return JSON.parse(readFileSync(file, 'utf-8'))
    }
  } catch {}
  return { width: 1440, height: 900 }
}

function saveWindowState(win: BrowserWindow) {
  try {
    const bounds = win.getBounds()
    const isMax = win.isMaximized()
    const state: WindowState = {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized: isMax,
    }
    writeFileSync(getWindowStatePath(), JSON.stringify(state, null, 2), 'utf-8')
  } catch {}
}

function createWindow() {
  const state = loadWindowState()

  mainWindow = new BrowserWindow({
    title: 'PC 装机实验室 // PC FORGE',
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#03070d',
    show: true, // 立即显示深色背景窗口，确保用户双击后立即可见
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  if (state.isMaximized) {
    mainWindow.maximize()
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.focus()
  })

  // 窗口状态保存
  mainWindow.on('close', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      saveWindowState(mainWindow)
    }
  })

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load:', errorCode, errorDescription, validatedURL)
    dialog.showErrorBox('页面加载失败', `无法加载页面: ${validatedURL}\n错误码: ${errorCode} (${errorDescription})`)
  })

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('Render process gone:', details)
    dialog.showErrorBox('渲染进程异常', `渲染进程异常退出: ${details.reason} (代码: ${details.exitCode})`)
  })

  // 链接拦截，外部网页通过系统默认浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    // 生产环境加载 dist/index.html
    const indexPath = join(__dirname, '../dist/index.html')
    mainWindow.loadFile(indexPath).catch((err) => {
      console.error('Failed to load file:', err)
      dialog.showErrorBox('加载错误', `无法加载本地页面: ${err.message}`)
    })
  }
}

// -------------------------------------------------------------
// IPC 通道处理
// -------------------------------------------------------------

// 1. 本地存储适配 (统一指向 app.getPath('userData'))
function getUserDataDir(): string {
  const dir = join(app.getPath('userData'), 'user_data')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

ipcMain.handle('storage:get-path', (_event, filename: string) => {
  return join(getUserDataDir(), filename)
})

ipcMain.handle('storage:read', (_event, filename: string) => {
  try {
    const filePath = join(getUserDataDir(), filename)
    if (existsSync(filePath)) {
      return readFileSync(filePath, 'utf-8')
    }
    return null
  } catch (err: any) {
    return null
  }
})

ipcMain.handle('storage:write', (_event, filename: string, content: string) => {
  try {
    const filePath = join(getUserDataDir(), filename)
    writeFileSync(filePath, content, 'utf-8')
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
})

// 2. 原生系统文件对话框
ipcMain.handle('dialog:show-save-dialog', async (_event, options: Electron.SaveDialogOptions) => {
  if (!mainWindow) return { canceled: true }
  return dialog.showSaveDialog(mainWindow, options)
})

ipcMain.handle('dialog:show-open-dialog', async (_event, options: Electron.OpenDialogOptions) => {
  if (!mainWindow) return { canceled: true }
  return dialog.showOpenDialog(mainWindow, options)
})

ipcMain.handle('fs:write-file', async (_event, filePath: string, base64Content: string) => {
  try {
    const buffer = Buffer.from(base64Content, 'base64')
    writeFileSync(filePath, buffer)
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('fs:read-file', async (_event, filePath: string) => {
  try {
    const content = readFileSync(filePath, 'utf-8')
    return { ok: true, content }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
})

// 3. 价格服务原生平替网关 (无需 Python FastAPI)
ipcMain.handle('price:health', () => {
  return {
    configured: true,
    adapter: 'desktop-embedded',
    message: 'PC 装机实验室桌面端就绪，内置离线硬件数据与本地样本报价。',
    serverTime: new Date().toISOString(),
    liveQuotes: 0,
  }
})

ipcMain.handle('price:quotes', (_event, _productIds: string[]) => {
  return {
    adapter: 'desktop-embedded',
    fetchedAt: new Date().toISOString(),
    quotes: [],
  }
})

// 4. 应用程序基础信息
ipcMain.handle('app:info', () => {
  return {
    name: 'PC 装机实验室',
    version: app.getVersion(),
    userDataPath: app.getPath('userData'),
    isDesktop: true,
  }
})

// 应用生命周期
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

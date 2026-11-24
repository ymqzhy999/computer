import { contextBridge, ipcRenderer } from 'electron'

export interface DesktopElectronAPI {
  isDesktop: boolean
  getAppInfo: () => Promise<{ name: string; version: string; userDataPath: string; isDesktop: boolean }>
  storage: {
    read: (filename: string) => Promise<string | null>
    write: (filename: string, content: string) => Promise<{ ok: boolean; error?: string }>
    getPath: (filename: string) => Promise<string>
  }
  dialog: {
    showSaveDialog: (options: any) => Promise<any>
    showOpenDialog: (options: any) => Promise<any>
  }
  fs: {
    writeFile: (filePath: string, base64Content: string) => Promise<{ ok: boolean; error?: string }>
    readFile: (filePath: string) => Promise<{ ok: boolean; content?: string; error?: string }>
  }
  price: {
    health: () => Promise<any>
    quotes: (productIds: string[]) => Promise<any>
  }
}

const api: DesktopElectronAPI = {
  isDesktop: true,
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  storage: {
    read: (filename: string) => ipcRenderer.invoke('storage:read', filename),
    write: (filename: string, content: string) => ipcRenderer.invoke('storage:write', filename, content),
    getPath: (filename: string) => ipcRenderer.invoke('storage:get-path', filename),
  },
  dialog: {
    showSaveDialog: (options: any) => ipcRenderer.invoke('dialog:show-save-dialog', options),
    showOpenDialog: (options: any) => ipcRenderer.invoke('dialog:show-open-dialog', options),
  },
  fs: {
    writeFile: (filePath: string, base64Content: string) => ipcRenderer.invoke('fs:write-file', filePath, base64Content),
    readFile: (filePath: string) => ipcRenderer.invoke('fs:read-file', filePath),
  },
  price: {
    health: () => ipcRenderer.invoke('price:health'),
    quotes: (productIds: string[]) => ipcRenderer.invoke('price:quotes', productIds),
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)

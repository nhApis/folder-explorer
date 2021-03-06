import fs from 'fs'
import { ipcMain, dialog, BrowserWindow, Notification, shell } from 'electron'
import scan from '../util/scan'

/**
 * 渲染进程请求选择扫描的文件夹
 */
ipcMain.on('IPC_FOLDER_SELECT', async (event, arg) => {
  const window = BrowserWindow.getFocusedWindow()
  const result = await dialog.showOpenDialog(window, {
    properties: [
      'openDirectory',
      'createDirectory'
    ]
  })
  if (result.canceled === false) {
    event.reply('IPC_FOLDER_SELECT_REPLY', result.filePaths[0])
  }
})

/**
 * 渲染进程请求选择保存结果的目录
 */
ipcMain.on('IPC_EXPORT', async (event, {
  name,
  value,
  openAfterExport,
  openFolderAfterExport
}) => {
  const window = BrowserWindow.getFocusedWindow()
  const result = await dialog.showSaveDialog(window, {
    defaultPath: name
  })
  if (result.canceled === false) {
    await fs.writeFileSync(result.filePath, new Uint8Array(Buffer.from(value)))
    if (openAfterExport) {
      shell.openItem(result.filePath)
    } else if (openFolderAfterExport) {
      shell.showItemInFolder(result.filePath)
    }
    event.reply('IPC_EXPORT_REPLY')
  }
})

/**
 * 渲染进程请求扫描文件夹
 */
ipcMain.on('IPC_FOLDER_SCAN', async (event, arg) => {
  event.reply('IPC_FOLDER_SCAN_REPLY', await scan({
    ...arg,
    needCheckIsFolder: true
  }))
})

/**
 * 渲染进程请求发送桌面通知
 */
ipcMain.on('IPC_SEND_NOTIFICATION', async (event, {
  title = 'Folder Explorer',
  body = ''
}) => {
  event.returnValue = Notification.isSupported()
  if (Notification.isSupported()) {
    const notification = new Notification({
      title,
      body
    })
    notification.show()
  }
})

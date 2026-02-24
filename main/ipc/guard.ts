import { ipcMain } from 'electron'
import type { IpcChannel } from '../../shared/ipc'

type IpcHandler = Parameters<typeof ipcMain.handle>[1]

const registeredChannels = new Set<string>()

export const handleOnce = (channel: IpcChannel, listener: IpcHandler) => {
  if (process.env.NODE_ENV !== 'production') {
    if (registeredChannels.has(channel)) {
      throw new Error(`[ipc] duplicate handler registration for channel: ${channel}`)
    }
    registeredChannels.add(channel)
  }

  ipcMain.handle(channel, listener)
}

export const getRegisteredChannelCount = () => registeredChannels.size

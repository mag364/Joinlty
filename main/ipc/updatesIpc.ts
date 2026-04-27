import { IPC_CHANNELS } from '../../shared/ipc'
import { updateService } from '../services/updateService'
import { handleOnce } from './guard'

export const registerUpdatesIpc = () => {
  handleOnce(IPC_CHANNELS.updatesGetStatus, () => updateService.getStatus())
  handleOnce(IPC_CHANNELS.updatesCheck, () => updateService.checkForUpdates())
  handleOnce(IPC_CHANNELS.updatesDownload, () => updateService.downloadUpdate())
  handleOnce(IPC_CHANNELS.updatesInstall, () => updateService.quitAndInstall())
}
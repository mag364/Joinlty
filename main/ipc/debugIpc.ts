import { IPC_CHANNELS } from '../../shared/ipc'
import { debugService } from '../services/debugService'
import { getDeveloperModeEnabled } from '../windowManager'
import { handleOnce } from './guard'

export const registerDebugIpc = () => {
  handleOnce(IPC_CHANNELS.debugEnumInventory, () => {
    if (!getDeveloperModeEnabled()) {
      throw new Error('Developer mode required')
    }

    return debugService.getEnumInventory()
  })

  handleOnce(IPC_CHANNELS.debugDbIntegrityCheck, () => {
    if (!getDeveloperModeEnabled()) {
      throw new Error('Developer mode required')
    }

    return debugService.runDbIntegrityCheck()
  })
}

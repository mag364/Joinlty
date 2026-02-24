import { IPC_CHANNELS } from '../../shared/ipc'
import { fullDataImportSchema, settingSetSchema } from '../../shared/schemas'
import type { FullDataBackupPayload } from '../../shared/preload'
import { settingsService } from '../services/settingsService'
import { validate } from './common'
import { handleOnce } from './guard'

export const registerSettingsIpc = () => {
  handleOnce(IPC_CHANNELS.settingsGet, () => settingsService.getAll())
  handleOnce(IPC_CHANNELS.settingsSet, (_event, payload) => {
    const { key, value } = validate(settingSetSchema, payload)
    return settingsService.set(key, value)
  })
  handleOnce(IPC_CHANNELS.settingsClearAll, () => settingsService.clearAll())
  handleOnce(IPC_CHANNELS.settingsExportAllData, () => settingsService.exportAllData())
  handleOnce(IPC_CHANNELS.settingsImportAllData, (_event, payload) => {
    const validated = validate(fullDataImportSchema, payload)
    return settingsService.importAllData(validated as FullDataBackupPayload)
  })
}

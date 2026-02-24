import { IPC_CHANNELS } from '../../shared/ipc'
import { contributionSettingDeleteSchema, contributionSettingUpsertSchema } from '../../shared/schemas'
import { contributionService } from '../services/contributionService'
import { validate } from './common'
import { handleOnce } from './guard'

export const registerContributionsIpc = () => {
  handleOnce(IPC_CHANNELS.contributionsList, () => contributionService.list())
  handleOnce(IPC_CHANNELS.contributionsUpsert, (_event, payload) => {
    const parsed = validate(contributionSettingUpsertSchema, payload)
    return contributionService.upsert(parsed)
  })
  handleOnce(IPC_CHANNELS.contributionsDelete, (_event, payload) => {
    const parsed = validate(contributionSettingDeleteSchema, payload)
    return contributionService.delete(parsed.id)
  })
}

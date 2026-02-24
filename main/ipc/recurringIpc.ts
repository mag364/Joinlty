import { IPC_CHANNELS } from '../../shared/ipc'
import { recurringRuleDeleteSchema, recurringRuleUpsertSchema } from '../../shared/schemas'
import { recurringService } from '../services/recurringService'
import { validate } from './common'
import { handleOnce } from './guard'

export const registerRecurringIpc = () => {
  handleOnce(IPC_CHANNELS.recurringList, () => recurringService.list())
  handleOnce(IPC_CHANNELS.recurringUpsert, (_event, payload) => {
    const parsed = validate(recurringRuleUpsertSchema, payload)
    return recurringService.upsert(parsed)
  })
  handleOnce(IPC_CHANNELS.recurringDelete, (_event, payload) => {
    const parsed = validate(recurringRuleDeleteSchema, payload)
    return recurringService.delete(parsed.id)
  })
}

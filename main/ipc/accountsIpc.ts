import { IPC_CHANNELS } from '../../shared/ipc'
import { accountDeleteSchema, accountReorderSchema, accountUpsertSchema } from '../../shared/schemas'
import { accountService } from '../services/accountService'
import { validate } from './common'
import { handleOnce } from './guard'

export const registerAccountsIpc = () => {
  handleOnce(IPC_CHANNELS.accountsList, () => accountService.list())
  handleOnce(IPC_CHANNELS.accountsUpsert, (_event, payload) => accountService.upsert(validate(accountUpsertSchema, payload)))
  handleOnce(IPC_CHANNELS.accountsDelete, (_event, payload) => {
    const parsed = validate(accountDeleteSchema, payload)
    return accountService.delete(parsed.id)
  })
  handleOnce(IPC_CHANNELS.accountsReorder, (_event, payload) => {
    const parsed = validate(accountReorderSchema, payload)
    return accountService.reorder(parsed.ids)
  })
}

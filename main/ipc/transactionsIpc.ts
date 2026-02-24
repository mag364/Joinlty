import { IPC_CHANNELS } from '../../shared/ipc'
import { transactionCreateSchema, transactionDeleteSchema, transactionUpdateSchema } from '../../shared/schemas'
import { transactionService } from '../services/transactionService'
import { validate } from './common'
import { handleOnce } from './guard'

export const registerTransactionsIpc = () => {
  handleOnce(IPC_CHANNELS.transactionsList, () => transactionService.list())
  handleOnce(IPC_CHANNELS.transactionsCreate, (_event, payload) =>
    transactionService.create(validate(transactionCreateSchema, payload)),
  )
  handleOnce(IPC_CHANNELS.transactionsUpdate, (_event, payload) => {
    const parsed = validate(transactionUpdateSchema, payload)
    return transactionService.update(parsed.id, parsed.transaction)
  })
  handleOnce(IPC_CHANNELS.transactionsDelete, (_event, payload) => {
    const parsed = validate(transactionDeleteSchema, payload)
    return transactionService.delete(parsed.id)
  })
}

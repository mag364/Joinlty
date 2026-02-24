import { IPC_CHANNELS } from '../../shared/ipc'
import { budgetTargetUpsertSchema } from '../../shared/schemas'
import { budgetService } from '../services/budgetService'
import { validate } from './common'
import { handleOnce } from './guard'

export const registerBudgetIpc = () => {
  handleOnce(IPC_CHANNELS.budgetTargetsList, () => budgetService.list())
  handleOnce(IPC_CHANNELS.budgetTargetsUpsert, (_event, payload) =>
    budgetService.upsert(validate(budgetTargetUpsertSchema, payload)),
  )
}

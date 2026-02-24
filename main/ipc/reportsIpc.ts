import { IPC_CHANNELS } from '../../shared/ipc'
import { monthSchema } from '../../shared/schemas'
import { reportService } from '../services/reportService'
import { validate } from './common'
import { handleOnce } from './guard'

export const registerReportsIpc = () => {
  handleOnce(IPC_CHANNELS.reportsSummary, (_event, month) => reportService.summary(validate(monthSchema, month)))
}

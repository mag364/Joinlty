import { IPC_CHANNELS } from '../../shared/ipc'
import { jointDeleteSchema, jointUpsertSchema } from '../../shared/schemas'
import { jointService } from '../services/jointService'
import { validate } from './common'
import { handleOnce } from './guard'

export const registerJointsIpc = () => {
  handleOnce(IPC_CHANNELS.jointsList, () => jointService.list())
  handleOnce(IPC_CHANNELS.jointsUpsert, (_event, payload) => {
    const parsed = validate(jointUpsertSchema, payload)
    return jointService.upsert(parsed)
  })
  handleOnce(IPC_CHANNELS.jointsDelete, (_event, payload) => {
    const parsed = validate(jointDeleteSchema, payload)
    return jointService.delete(parsed.id)
  })
}

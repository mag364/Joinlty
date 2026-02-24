import { IPC_CHANNELS } from '../../shared/ipc'
import { monthSchema } from '../../shared/schemas'
import { generationService } from '../services/generationService'
import { validate } from './common'
import { handleOnce } from './guard'

export const registerGenerationIpc = () => {
  handleOnce(IPC_CHANNELS.generationPreview, (_event, month) => generationService.preview(validate(monthSchema, month)))
  handleOnce(IPC_CHANNELS.generationCommit, (_event, month) => generationService.commit(validate(monthSchema, month)))
}

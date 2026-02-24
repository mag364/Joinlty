import { IPC_CHANNELS } from '../../shared/ipc'
import { attachmentCreateSchema, attachmentOpenFolderSchema } from '../../shared/schemas'
import { attachmentService } from '../services/attachmentService'
import { validate } from './common'
import { handleOnce } from './guard'

export const registerAttachmentsIpc = () => {
  handleOnce(IPC_CHANNELS.attachmentsList, (_event, transactionId) => attachmentService.list(String(transactionId)))
  handleOnce(IPC_CHANNELS.attachmentsCreate, (_event, payload) =>
    attachmentService.create(validate(attachmentCreateSchema, payload)),
  )
  handleOnce(IPC_CHANNELS.attachmentsOpenFolder, (_event, payload) =>
    attachmentService.openFolder(validate(attachmentOpenFolderSchema, payload).transaction_id),
  )
}

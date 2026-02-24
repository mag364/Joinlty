import { IPC_CHANNELS } from '../../shared/ipc'
import { memberDeleteSchema, memberReorderSchema, memberUpsertSchema } from '../../shared/schemas'
import { memberService } from '../services/memberService'
import { validate } from './common'
import { handleOnce } from './guard'

export const registerMembersIpc = () => {
  handleOnce(IPC_CHANNELS.membersList, () => memberService.list())
  handleOnce(IPC_CHANNELS.membersUpsert, (_event, payload) => memberService.upsert(validate(memberUpsertSchema, payload)))
  handleOnce(IPC_CHANNELS.membersDelete, (_event, payload) => {
    const parsed = validate(memberDeleteSchema, payload)
    return memberService.delete(parsed.id)
  })
  handleOnce(IPC_CHANNELS.membersReorder, (_event, payload) => {
    const parsed = validate(memberReorderSchema, payload)
    return memberService.reorder(parsed.ids)
  })
}

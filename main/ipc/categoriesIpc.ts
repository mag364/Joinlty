import { IPC_CHANNELS } from '../../shared/ipc'
import { categoryCreateSchema, categoryDeleteSchema, categoryUpdateSchema } from '../../shared/schemas'
import { categoryService } from '../services/categoryService'
import { validate } from './common'
import { handleOnce } from './guard'

export const registerCategoriesIpc = () => {
  handleOnce(IPC_CHANNELS.categoriesList, () => categoryService.list())
  handleOnce(IPC_CHANNELS.categoriesCreate, (_event, payload) => categoryService.create(validate(categoryCreateSchema, payload)))
  handleOnce(IPC_CHANNELS.categoriesUpdate, (_event, payload) => categoryService.update(validate(categoryUpdateSchema, payload)))
  handleOnce(IPC_CHANNELS.categoriesDelete, (_event, payload) => categoryService.delete(validate(categoryDeleteSchema, payload)))
}

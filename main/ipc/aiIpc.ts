import { IPC_CHANNELS } from '../../shared/ipc'
import {
  aiDashboardAssistantSchema,
  aiDetectDuplicateTransactionSchema,
  aiExplainMonthSchema,
  aiListModelsSchema,
  aiSuggestTaxWriteOffsSchema,
  aiSuggestTransactionFieldsSchema,
  aiTestConnectionSchema,
} from '../../shared/schemas'
import { aiService } from '../services/aiService'
import { validate } from './common'
import { handleOnce } from './guard'

export const registerAiIpc = () => {
  handleOnce(IPC_CHANNELS.aiTestConnection, (_event, payload) =>
    aiService.testConnection(validate(aiTestConnectionSchema, payload)),
  )

  handleOnce(IPC_CHANNELS.aiListModels, (_event, payload) =>
    aiService.listModels(validate(aiListModelsSchema, payload)),
  )

  handleOnce(IPC_CHANNELS.aiSuggestTransactionFields, (_event, payload) =>
    aiService.suggestTransactionFields(validate(aiSuggestTransactionFieldsSchema, payload)),
  )

  handleOnce(IPC_CHANNELS.aiSuggestTaxWriteOffs, (_event, payload) =>
    aiService.suggestTaxWriteOffs(validate(aiSuggestTaxWriteOffsSchema, payload)),
  )

  handleOnce(IPC_CHANNELS.aiDetectDuplicateTransaction, (_event, payload) =>
    aiService.detectDuplicateTransaction(validate(aiDetectDuplicateTransactionSchema, payload)),
  )

  handleOnce(IPC_CHANNELS.aiExplainMonth, (_event, payload) =>
    aiService.explainMonth(validate(aiExplainMonthSchema, payload)),
  )

  handleOnce(IPC_CHANNELS.aiDashboardAssistant, (_event, payload) =>
    aiService.dashboardAssistant(validate(aiDashboardAssistantSchema, payload)),
  )
}

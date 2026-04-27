import { registerAccountsIpc } from './accountsIpc'
import { registerAiIpc } from './aiIpc'
import { registerAppWindowIpc } from './appWindowIpc'
import { registerAttachmentsIpc } from './attachmentsIpc'
import { registerBudgetIpc } from './budgetIpc'
import { registerCategoriesIpc } from './categoriesIpc'
import { registerContributionsIpc } from './contributionsIpc'
import { registerDebugIpc } from './debugIpc'
import { registerGenerationIpc } from './generationIpc'
import { registerJointsIpc } from './jointsIpc'
import { registerMembersIpc } from './membersIpc'
import { registerRecurringIpc } from './recurringIpc'
import { registerReportsIpc } from './reportsIpc'
import { registerSettingsIpc } from './settingsIpc'
import { registerTransactionsIpc } from './transactionsIpc'
import { registerUpdatesIpc } from './updatesIpc'
import { getRegisteredChannelCount } from './guard'

export const registerIpcHandlers = () => {
  registerAppWindowIpc()
  registerMembersIpc()
  registerJointsIpc()
  registerAccountsIpc()
  registerCategoriesIpc()
  registerTransactionsIpc()
  registerRecurringIpc()
  registerContributionsIpc()
  registerDebugIpc()
  registerGenerationIpc()
  registerAttachmentsIpc()
  registerReportsIpc()
  registerSettingsIpc()
  registerBudgetIpc()
  registerAiIpc()
  registerUpdatesIpc()

  if (process.env.NODE_ENV !== 'production') {
    console.debug(`[ipc] registered channels: ${getRegisteredChannelCount()}`)
  }
}

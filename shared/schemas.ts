import { z } from 'zod'

export const ownerTypeSchema = z.enum(['member', 'joint'])
export const accountTypeSchema = z.enum(['checking', 'savings', 'credit_card'])
export const transactionTypeSchema = z.enum(['expense', 'income', 'transfer'])
export const ruleTypeSchema = z.enum(['expense', 'income', 'contribution'])
export const budgetPeriodSchema = z.enum(['monthly', 'yearly'])
export const contributionMethodSchema = z.enum(['fixed', 'percent_income', 'split'])
export const splitModeSchema = z.enum(['equal', 'weighted'])
export const memberTypeSchema = z.enum(['person', 'property', 'business'])

export const idSchema = z.string().min(1)
export const monthSchema = z.string().regex(/^\d{4}-\d{2}$/)

export const memberUpsertSchema = z.object({
  id: idSchema.optional(),
  name: z.string().min(1),
  member_type: memberTypeSchema.default('person'),
  color: z.string().optional().nullable(),
  avatar: z.string().optional().nullable(),
  active: z.boolean().default(true),
})

export const memberDeleteSchema = z.object({
  id: idSchema,
})

export const memberReorderSchema = z.object({
  ids: z.array(idSchema).min(1),
})

export const jointUpsertSchema = z.object({
  id: idSchema.optional(),
  name: z.string().min(1),
  active: z.boolean().default(true),
})

export const jointDeleteSchema = z.object({
  id: idSchema,
})

export const accountUpsertSchema = z.object({
  id: idSchema.optional(),
  name: z.string().min(1),
  type: accountTypeSchema,
  owner_type: ownerTypeSchema,
  owner_id: idSchema,
  starting_balance: z.number().default(0),
})

export const accountDeleteSchema = z.object({
  id: idSchema,
})

export const accountReorderSchema = z.object({
  ids: z.array(idSchema).min(1),
})

export const transactionCreateSchema = z
  .object({
    date: z.string().min(1),
    amount: z.number().positive(),
    type: transactionTypeSchema,
    category: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    owner_type: ownerTypeSchema,
    owner_id: idSchema,
    account_id: idSchema.optional().nullable(),
    from_account_id: idSchema.optional().nullable(),
    to_account_id: idSchema.optional().nullable(),
    tags: z.array(z.string()).default([]),
    notes: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'transfer') {
      if (!data.from_account_id || !data.to_account_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'transfer requires from_account_id and to_account_id',
        })
      }
      return
    }

    if (!data.account_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'income/expense requires account_id',
      })
    }
  })

export const transactionUpdateSchema = z
  .object({
    id: idSchema,
    transaction: transactionCreateSchema,
  })

export const transactionDeleteSchema = z.object({
  id: idSchema,
})

export const recurringRuleUpsertSchema = z.object({
  id: idSchema.optional(),
  rule_type: ruleTypeSchema,
  name: z.string().min(1),
  amount: z.number().positive(),
  category: z.string().optional().nullable(),
  owner_type: ownerTypeSchema,
  owner_id: idSchema,
  account_id: idSchema.optional().nullable(),
  schedule: z.literal('monthly').default('monthly'),
  day_of_month: z.number().int().min(1).max(31),
  next_run_date: z.string().min(1),
  active: z.boolean().default(true),
})

export const recurringRuleDeleteSchema = z.object({
  id: idSchema,
})

export const contributionSettingUpsertSchema = z.object({
  id: idSchema.optional(),
  member_id: idSchema,
  joint_id: idSchema,
  contributes: z.boolean(),
  method: contributionMethodSchema.optional().nullable(),
  fixed_amount: z.number().positive().optional().nullable(),
  percent_income: z.number().min(0).max(100).optional().nullable(),
  split_mode: splitModeSchema.optional().nullable(),
  weight: z.number().positive().optional().nullable(),
  funding_account_id: idSchema.optional().nullable(),
  active: z.boolean().default(true),
})

export const contributionSettingDeleteSchema = z.object({
  id: idSchema,
})

export const attachmentCreateSchema = z.object({
  transaction_id: idSchema,
  file_path: z.string().min(1),
})

export const attachmentOpenFolderSchema = z.object({
  transaction_id: idSchema,
})

export const aiTestConnectionSchema = z.object({
  provider: z.enum(['none', 'ollama', 'lmstudio']),
  baseUrl: z.string().optional(),
  model: z.string().optional(),
})

export const aiListModelsSchema = z.object({
  provider: z.enum(['none', 'ollama', 'lmstudio']),
  baseUrl: z.string().optional(),
})

const aiTransactionContextItemSchema = z.object({
  id: idSchema,
  date: z.string().min(1),
  amount: z.number().positive(),
  type: transactionTypeSchema,
  category: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  owner_type: ownerTypeSchema,
  owner_id: idSchema,
  account_id: idSchema.optional().nullable(),
  from_account_id: idSchema.optional().nullable(),
  to_account_id: idSchema.optional().nullable(),
  tags: z.array(z.string()).default([]),
})

export const aiSuggestTransactionFieldsSchema = z.object({
  description: z.string().min(1),
  amount: z.number().positive().optional().nullable(),
  date: z.string().optional().nullable(),
  type: transactionTypeSchema.optional().nullable(),
  owner_type: ownerTypeSchema.optional().nullable(),
  owner_id: idSchema.optional().nullable(),
  categories: z.array(z.string()).default([]),
  accounts: z
    .array(
      z.object({
        id: idSchema,
        name: z.string().min(1),
        owner_type: ownerTypeSchema,
        owner_id: idSchema,
        type: accountTypeSchema,
      }),
    )
    .default([]),
  recentTransactions: z.array(aiTransactionContextItemSchema).default([]),
})

export const aiSuggestTaxWriteOffsSchema = z.object({
  member: z.object({
    id: idSchema,
    name: z.string().min(1),
  }),
  accounts: z
    .array(
      z.object({
        id: idSchema,
        name: z.string().min(1),
        type: accountTypeSchema,
      }),
    )
    .default([]),
  transactions: z
    .array(
      z.object({
        id: idSchema,
        date: z.string().min(1),
        amount: z.number().positive(),
        type: transactionTypeSchema,
        category: z.string().optional().nullable(),
        description: z.string().optional().nullable(),
        account_id: idSchema.optional().nullable(),
        from_account_id: idSchema.optional().nullable(),
        to_account_id: idSchema.optional().nullable(),
        tags: z.array(z.string()).default([]),
      }),
    )
    .default([]),
})

export const aiDetectDuplicateTransactionSchema = z.object({
  draft: z.object({
    date: z.string().min(1),
    amount: z.number().positive(),
    type: transactionTypeSchema,
    category: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    owner_type: ownerTypeSchema,
    owner_id: idSchema,
    account_id: idSchema.optional().nullable(),
    from_account_id: idSchema.optional().nullable(),
    to_account_id: idSchema.optional().nullable(),
  }),
  recentTransactions: z.array(aiTransactionContextItemSchema).default([]),
})

export const aiExplainMonthSchema = z.object({
  month: monthSchema,
  summary: z.object({
    income: z.number(),
    expense: z.number(),
    net: z.number(),
  }),
  categoryTotals: z
    .array(
      z.object({
        category: z.string().min(1),
        total: z.number(),
      }),
    )
    .default([]),
  memberTotals: z
    .array(
      z.object({
        member: z.string().min(1),
        total: z.number(),
      }),
    )
    .default([]),
  trendRows: z
    .array(
      z.object({
        month: monthSchema,
        income: z.number(),
        expense: z.number(),
        net: z.number(),
      }),
    )
    .default([]),
})

export const aiDashboardAssistantSchema = z.object({
  question: z.string().min(1),
  month: monthSchema,
  summary: z.object({
    income: z.number(),
    expense: z.number(),
    net: z.number(),
  }),
  accounts: z
    .array(
      z.object({
        name: z.string().min(1),
        balance: z.number(),
        owner_type: ownerTypeSchema,
        type: accountTypeSchema,
      }),
    )
    .default([]),
  categoryTotals: z.array(z.object({ category: z.string().min(1), net: z.number() })).default([]),
  memberTotals: z.array(z.object({ member: z.string().min(1), net: z.number() })).default([]),
  upcomingRecurring: z
    .array(
      z.object({
        date: z.string().min(1),
        description: z.string().min(1),
        amount: z.number().nonnegative(),
        type: z.enum(['income', 'expense']),
      }),
    )
    .default([]),
})

export const settingSetSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
})

export const fullDataImportSchema = z.object({
  format: z.literal('jointly-full-backup-v1'),
  exported_at: z.string().min(1),
  data: z.object({}).passthrough(),
})

export const categoryCreateSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(['income', 'expense']).optional().nullable(),
})

export const categoryUpdateSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  kind: z.enum(['income', 'expense']).optional().nullable(),
  active: z.boolean(),
})

export const categoryDeleteSchema = z.object({
  id: idSchema,
})

export const budgetTargetUpsertSchema = z.object({
  id: idSchema.optional(),
  owner_type: ownerTypeSchema,
  owner_id: idSchema,
  category: z.string().min(1),
  amount: z.number().nonnegative(),
  period: budgetPeriodSchema.default('monthly'),
  active: z.boolean().default(true),
})

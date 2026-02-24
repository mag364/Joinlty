import type {
  AIDashboardAssistantRequest,
  AIDashboardAssistantResult,
  AIModelOption,
  AIDetectDuplicateTransactionRequest,
  AIDetectDuplicateTransactionResult,
  AIExplainMonthRequest,
  AIExplainMonthResult,
  AISuggestTaxWriteOffsRequest,
  AISuggestTaxWriteOffsResult,
  AISuggestTransactionFieldsRequest,
  AISuggestTransactionFieldsResult,
} from '../../shared/preload'
import { settingsService } from './settingsService'

interface AIProvider {
  isAvailable(): Promise<boolean>
  generateJson<T>(prompt: string): Promise<T>
}

const AI_HTTP_TIMEOUT_MS = 15_000
const AI_GENERATION_TIMEOUT_MS = 90_000

const fetchWithTimeout = async (url: string, init?: RequestInit, timeoutMs = AI_HTTP_TIMEOUT_MS) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${Math.ceil(timeoutMs / 1000)}s`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

class OllamaProvider implements AIProvider {
  private readonly baseUrl: string
  private readonly model: string

  constructor(baseUrl: string, model: string) {
    this.baseUrl = baseUrl
    this.model = model
  }

  async isAvailable(): Promise<boolean> {
    const normalizedBase = this.baseUrl.replace(/\/$/, '')
    const tagUrls = normalizedBase.endsWith('/api')
      ? [`${normalizedBase}/tags`]
      : [`${normalizedBase}/api/tags`]

    try {
      for (const url of tagUrls) {
        try {
          const response = await fetchWithTimeout(url)
          if (response.ok) return true
        } catch {
          // try next candidate
        }
      }
      return false
    } catch {
      return false
    }
  }

  async generateJson<T>(prompt: string): Promise<T> {
    const normalizedBase = this.baseUrl.replace(/\/$/, '')
    const chatUrl = normalizedBase.endsWith('/api') ? `${normalizedBase}/chat` : `${normalizedBase}/api/chat`
    const generateUrl = normalizedBase.endsWith('/api') ? `${normalizedBase}/generate` : `${normalizedBase}/api/generate`

    const systemInstruction =
      'You are a budgeting assistant. Reply with valid JSON only. Do not include markdown code fences or extra commentary.'

    const chatResponse = await fetchWithTimeout(chatUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        stream: false,
        format: 'json',
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: prompt },
        ],
      }),
    }, AI_GENERATION_TIMEOUT_MS)

    if (chatResponse.ok) {
      const payload = (await chatResponse.json()) as { message?: { content?: string } }
      const content = payload.message?.content ?? '{}'
      return parseJsonText<T>(content)
    }

    if (chatResponse.status !== 404 && chatResponse.status !== 405) {
      throw new Error(`Ollama request failed (${chatResponse.status})`)
    }

    const generateResponse = await fetchWithTimeout(generateUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        stream: false,
        format: 'json',
        prompt: `${systemInstruction}\n\n${prompt}`,
      }),
    }, AI_GENERATION_TIMEOUT_MS)

    if (!generateResponse.ok) {
      throw new Error(`Ollama request failed (${generateResponse.status})`)
    }

    const payload = (await generateResponse.json()) as { response?: string }
    const content = payload.response ?? '{}'
    return parseJsonText<T>(content)
  }

}

class LMStudioProvider implements AIProvider {
  private readonly baseUrl: string
  private readonly model: string

  constructor(baseUrl: string, model: string) {
    this.baseUrl = baseUrl
    this.model = model
  }

  async isAvailable(): Promise<boolean> {
    try {
      const normalizedBase = this.baseUrl.replace(/\/$/, '')
      const modelsUrl = normalizedBase.endsWith('/v1') ? `${normalizedBase}/models` : `${normalizedBase}/v1/models`
      const response = await fetchWithTimeout(modelsUrl)
      return response.ok
    } catch {
      return false
    }
  }

  async generateJson<T>(prompt: string): Promise<T> {
    const normalizedBase = this.baseUrl.replace(/\/$/, '')
    const chatUrl = normalizedBase.endsWith('/v1') ? `${normalizedBase}/chat/completions` : `${normalizedBase}/v1/chat/completions`

    const response = await fetchWithTimeout(chatUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'You are a budgeting assistant. Reply with valid JSON only. Do not include markdown code fences or extra commentary.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    }, AI_GENERATION_TIMEOUT_MS)

    if (response.ok) {
      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      const content = payload.choices?.[0]?.message?.content ?? '{}'
      return parseJsonText<T>(content)
    }

    if (response.status !== 404 && response.status !== 405) {
      throw new Error(`LM Studio request failed (${response.status})`)
    }

    const responsesUrl = normalizedBase.endsWith('/v1') ? `${normalizedBase}/responses` : `${normalizedBase}/v1/responses`
    const fallbackResponse = await fetchWithTimeout(responsesUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        input: [
          {
            role: 'system',
            content:
              'You are a budgeting assistant. Reply with valid JSON only. Do not include markdown code fences or extra commentary.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    }, AI_GENERATION_TIMEOUT_MS)

    if (!fallbackResponse.ok) {
      throw new Error(`LM Studio request failed (${fallbackResponse.status})`)
    }

    const fallbackPayload = (await fallbackResponse.json()) as {
      output_text?: string
      output?: Array<{ content?: Array<{ text?: string }> }>
    }
    const content =
      fallbackPayload.output_text ?? fallbackPayload.output?.[0]?.content?.[0]?.text ?? '{}'
    return parseJsonText<T>(content)
  }

}

const parseJsonText = <T>(raw: string): T => {
  const trimmed = raw.trim()
  try {
    return JSON.parse(trimmed) as T
  } catch {
    const firstBrace = trimmed.indexOf('{')
    const lastBrace = trimmed.lastIndexOf('}')
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as T
    }
    throw new Error('Invalid JSON response from AI provider')
  }
}

const createProvider = (payload: { provider: 'none' | 'ollama' | 'lmstudio'; baseUrl?: string; model?: string }) => {
  if (payload.provider === 'ollama') {
    return new OllamaProvider(payload.baseUrl ?? 'http://127.0.0.1:11434', payload.model ?? 'llama3')
  }

  if (payload.provider === 'lmstudio') {
    return new LMStudioProvider(payload.baseUrl ?? 'http://127.0.0.1:1234', payload.model ?? 'local-model')
  }

  return null
}

const getConfiguredProvider = () => {
  const settings = settingsService.getAll()
  return createProvider({
    provider: (settings.ai_provider as 'none' | 'ollama' | 'lmstudio') ?? 'none',
    baseUrl: settings.ai_base_url,
    model: settings.ai_model,
  })
}

const similarTextScore = (left?: string | null, right?: string | null) => {
  const a = (left ?? '').trim().toLowerCase()
  const b = (right ?? '').trim().toLowerCase()
  if (!a || !b) return 0
  if (a === b) return 1
  if (a.includes(b) || b.includes(a)) return 0.75
  const aWords = new Set(a.split(/\s+/))
  const bWords = new Set(b.split(/\s+/))
  const overlap = [...aWords].filter((word) => bWords.has(word)).length
  return overlap / Math.max(1, Math.max(aWords.size, bWords.size))
}

const deterministicSuggest = (payload: AISuggestTransactionFieldsRequest): AISuggestTransactionFieldsResult => {
  const description = payload.description.trim().toLowerCase()
  const matched = payload.recentTransactions
    .map((tx) => ({
      tx,
      score: similarTextScore(description, tx.description ?? tx.category ?? ''),
    }))
    .filter((item) => item.score >= 0.5)
    .sort((a, b) => b.score - a.score)

  const best = matched[0]?.tx
  if (!best) {
    return {
      ok: true,
      message: 'No strong historical match found. Add more details for better suggestions.',
      suggestion: {
        category: null,
        tags: [],
        owner_type: payload.owner_type ?? null,
        owner_id: payload.owner_id ?? null,
        account_id: null,
        confidence: 'low',
        reasoning: 'No similar prior transactions were found.',
      },
    }
  }

  return {
    ok: true,
    message: 'Suggestion generated from recent transaction history.',
    suggestion: {
      category: best.category ?? null,
      tags: best.tags,
      owner_type: best.owner_type,
      owner_id: best.owner_id,
      account_id: best.account_id ?? null,
      confidence: matched.length >= 2 ? 'high' : 'medium',
      reasoning: `Matched ${matched.length} similar transaction(s), closest: ${best.description ?? best.category ?? best.id}.`,
    },
  }
}

const deterministicDuplicateCheck = (payload: AIDetectDuplicateTransactionRequest): AIDetectDuplicateTransactionResult => {
  const matched = payload.recentTransactions.filter((tx) => {
    if (tx.type !== payload.draft.type) return false
    if (tx.owner_type !== payload.draft.owner_type || tx.owner_id !== payload.draft.owner_id) return false

    const amountDelta = Math.abs(tx.amount - payload.draft.amount)
    const dateDeltaDays = Math.abs(new Date(tx.date).getTime() - new Date(payload.draft.date).getTime()) / (1000 * 60 * 60 * 24)
    const descScore = similarTextScore(tx.description, payload.draft.description)

    return amountDelta <= 0.01 && dateDeltaDays <= 3 && (descScore >= 0.5 || (tx.category ?? '') === (payload.draft.category ?? ''))
  })

  return {
    ok: true,
    message: matched.length > 0 ? 'Potential duplicate(s) detected.' : 'No likely duplicates detected.',
    result: {
      likelyDuplicate: matched.length > 0,
      confidence: matched.length > 1 ? 'high' : matched.length === 1 ? 'medium' : 'low',
      matchedTransactionIds: matched.map((tx) => tx.id),
      reasoning:
        matched.length > 0
          ? 'Matched by amount, close date range, and similar category/description.'
          : 'No recent transactions matched duplicate criteria.',
    },
  }
}

const runProviderSuggest = async (payload: AISuggestTransactionFieldsRequest): Promise<AISuggestTransactionFieldsResult | null> => {
  const provider = getConfiguredProvider()
  if (!provider) return null

  const prompt = JSON.stringify(
    {
      task: 'Suggest transaction fields based on the transaction description and prior transactions.',
      outputShape: {
        category: 'string|null',
        tags: 'string[]',
        owner_type: "'member'|'joint'|null",
        owner_id: 'string|null',
        account_id: 'string|null',
        confidence: "'low'|'medium'|'high'",
        reasoning: 'string',
      },
      payload,
    },
    null,
    2,
  )

  const available = await provider.isAvailable()
  if (!available) return null

  try {
    const suggestion = await provider.generateJson<AISuggestTransactionFieldsResult['suggestion']>(prompt)
    if (!suggestion) return null
    return { ok: true, message: 'Suggestion generated with AI provider.', suggestion }
  } catch {
    return null
  }
}

const deterministicSuggestTaxWriteOffs = (payload: AISuggestTaxWriteOffsRequest): AISuggestTaxWriteOffsResult => {
  const categoryRollup = payload.transactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce<
      Record<
        string,
        {
          amount: number
          transactionCount: number
        }
      >
    >((acc, transaction) => {
      const key = (transaction.category?.trim() || 'Uncategorized')
      const current = acc[key] ?? { amount: 0, transactionCount: 0 }
      current.amount += transaction.amount
      current.transactionCount += 1
      acc[key] = current
      return acc
    }, {})

  const categories = Object.entries(categoryRollup)
    .map(([category, summary]) => ({
      category,
      amount: summary.amount,
      transactionCount: summary.transactionCount,
      rationale:
        category === 'Uncategorized'
          ? 'Uncategorized expenses may contain deductible items. Review receipts and classify before filing.'
          : `Recurring or business-relevant ${category.toLowerCase()} expenses may be partially deductible depending on tax rules.`,
    }))
    .sort((a, b) => b.amount - a.amount)

  const totalSuggestedAmount = categories.reduce((sum, row) => sum + row.amount, 0)

  return {
    ok: true,
    message: categories.length > 0 ? 'Tax write-off suggestions generated from local analytics.' : 'No expense transactions found for selected accounts.',
    source: 'local_fallback',
    result: {
      categories,
      totalSuggestedAmount,
      confidence: categories.length >= 3 ? 'medium' : categories.length > 0 ? 'low' : 'low',
      disclaimers: [
        'Suggestions are informational only and are not tax advice.',
        'Confirm eligibility with a qualified tax professional before filing.',
      ],
    },
  }
}

const runProviderSuggestTaxWriteOffs = async (payload: AISuggestTaxWriteOffsRequest): Promise<AISuggestTaxWriteOffsResult | null> => {
  const provider = getConfiguredProvider()
  if (!provider) return null

  const available = await provider.isAvailable()
  if (!available) return null

  const prompt = JSON.stringify(
    {
      task: 'Review transactions for a selected member and suggest potential tax write-off categories and totals.',
      requirements: [
        'Use transaction categories, descriptions, and amounts to infer possible write-off buckets.',
        'Be conservative and include rationale per category.',
        'Return JSON only matching the output shape.',
      ],
      outputShape: {
        categories: [
          {
            category: 'string',
            amount: 'number',
            transactionCount: 'number',
            rationale: 'string',
          },
        ],
        totalSuggestedAmount: 'number',
        confidence: "'low'|'medium'|'high'",
        disclaimers: ['string'],
      },
      payload,
    },
    null,
    2,
  )

  try {
    const result = await provider.generateJson<AISuggestTaxWriteOffsResult['result']>(prompt)
    if (!result) return null
    return {
      ok: true,
      message: 'Tax write-off suggestions generated with AI provider.',
      source: 'ai_provider',
      result,
    }
  } catch {
    return null
  }
}

const deterministicExplainMonth = (payload: AIExplainMonthRequest): AIExplainMonthResult => {
  const topCategory = [...payload.categoryTotals].sort((a, b) => b.total - a.total)[0]
  const topMember = [...payload.memberTotals].sort((a, b) => b.total - a.total)[0]
  const previous = payload.trendRows.length >= 2 ? payload.trendRows[payload.trendRows.length - 2] : null
  const netDelta = previous ? payload.summary.net - previous.net : 0

  const anomalies: string[] = []
  if (topCategory && topCategory.total > Math.max(1, payload.summary.expense) * 0.35) {
    anomalies.push(`${topCategory.category} makes up a large share of this month's activity.`)
  }
  if (previous && Math.abs(netDelta) > Math.max(50, Math.abs(previous.net) * 0.2)) {
    anomalies.push(`Net changed by ${netDelta >= 0 ? '+' : ''}${netDelta.toFixed(2)} vs last month (${previous.month}).`)
  }

  const actions = [
    topCategory ? `Review top category (${topCategory.category}) transactions for avoidable spend.` : 'Review highest-spend categories.',
    payload.summary.net < 0 ? 'Net is negative; consider reducing discretionary categories first.' : 'Consider allocating a portion of positive net to savings goals.',
    'Re-run month generation preview to confirm all recurring transactions are captured.',
  ]

  return {
    ok: true,
    message: 'Monthly explanation generated from local analytics.',
    explanation: {
      headline: `${payload.month}: ${payload.summary.net >= 0 ? 'Positive' : 'Negative'} net of $${payload.summary.net.toFixed(2)}.`,
      bullets: [
        `Income: $${payload.summary.income.toFixed(2)} | Expense: $${payload.summary.expense.toFixed(2)}.`,
        topCategory ? `Largest category: ${topCategory.category} ($${topCategory.total.toFixed(2)}).` : 'No category data available yet.',
        topMember ? `Highest activity owner: ${topMember.member} ($${topMember.total.toFixed(2)}).` : 'No member split data available yet.',
      ],
      anomalies,
      actions,
      confidence: payload.categoryTotals.length > 0 && payload.memberTotals.length > 0 ? 'high' : 'medium',
      disclaimers: ['AI insights are guidance only and may miss off-platform context.'],
    },
  }
}

const runProviderExplainMonth = async (payload: AIExplainMonthRequest): Promise<AIExplainMonthResult | null> => {
  const provider = getConfiguredProvider()
  if (!provider) return null

  const available = await provider.isAvailable()
  if (!available) return null

  const prompt = JSON.stringify(
    {
      task: 'Explain this budget month in plain English for a household budgeting app.',
      requirements: [
        'Provide concise insight-focused narrative.',
        'Focus on trends, anomalies, and practical actions.',
        'Return JSON only matching requested output shape.',
      ],
      outputShape: {
        headline: 'string',
        bullets: 'string[]',
        anomalies: 'string[]',
        actions: 'string[]',
        confidence: "'low'|'medium'|'high'",
        disclaimers: 'string[]',
      },
      payload,
    },
    null,
    2,
  )

  try {
    const explanation = await provider.generateJson<AIExplainMonthResult['explanation']>(prompt)
    if (!explanation) return null
    return {
      ok: true,
      message: 'Monthly explanation generated with AI provider.',
      explanation,
    }
  } catch {
    return null
  }
}

const deterministicDashboardAssistant = (payload: AIDashboardAssistantRequest): AIDashboardAssistantResult => {
  const question = payload.question.toLowerCase()
  const topCategory = [...payload.categoryTotals].sort((a, b) => Math.abs(b.net) - Math.abs(a.net))[0]
  const topMember = [...payload.memberTotals].sort((a, b) => b.net - a.net)[0]
  const atRiskAccounts = payload.accounts.filter((account) => account.balance < 0)
  const nextIncome = payload.upcomingRecurring.filter((item) => item.type === 'income').slice(0, 2)
  const nextExpenses = payload.upcomingRecurring.filter((item) => item.type === 'expense').slice(0, 2)

  if (question.includes('daily brief') || question.includes('brief')) {
    return {
      ok: true,
      message: 'Daily brief generated from local analytics.',
      result: {
        answer: `${payload.month} snapshot: net $${payload.summary.net.toFixed(2)} (income $${payload.summary.income.toFixed(2)}, expense $${payload.summary.expense.toFixed(2)}). ${topCategory ? `Top category movement is ${topCategory.category} at $${topCategory.net.toFixed(2)}.` : 'No category trend yet.'} ${topMember ? `Highest member net is ${topMember.member} at $${topMember.net.toFixed(2)}.` : ''}`.trim(),
        suggestedActions: [
          payload.summary.net < 0 ? 'Trim one discretionary category this week.' : 'Allocate part of net to savings.',
          topCategory ? `Review the last 5 transactions in ${topCategory.category}.` : 'Review your top spending category.',
        ],
        confidence: payload.categoryTotals.length > 0 ? 'medium' : 'low',
      },
    }
  }

  if (question.includes('risk') || question.includes('cashflow')) {
    const riskAnswer =
      atRiskAccounts.length > 0
        ? `⚠️ ${atRiskAccounts.length} account(s) are currently negative: ${atRiskAccounts.map((account) => account.name).join(', ')}.`
        : nextExpenses.length > 0 && nextIncome.length === 0
          ? `⚠️ Upcoming expenses exist (${nextExpenses.map((item) => item.description).join(', ')}) but no upcoming recurring income is currently scheduled.`
          : 'No immediate cashflow red flags detected based on current balances and upcoming recurring items.'

    return {
      ok: true,
      message: 'Cashflow risk alert generated from local analytics.',
      result: {
        answer: riskAnswer,
        suggestedActions: [
          atRiskAccounts.length > 0
            ? `Fund ${atRiskAccounts[0].name} first to avoid overdraft or missed payments.`
            : 'Keep a checking buffer for upcoming fixed expenses.',
          nextIncome.length > 0
            ? `Next income expected: ${nextIncome[0].description} on ${nextIncome[0].date}.`
            : 'Add or verify recurring income rules in Income/Recurring.',
        ],
        confidence: 'medium',
      },
    }
  }

  if (question.includes('smart') || question.includes('action')) {
    return {
      ok: true,
      message: 'Smart actions generated from local analytics.',
      result: {
        answer: 'Here are your highest-impact next moves:',
        suggestedActions: [
          payload.summary.net < 0
            ? 'Reduce one discretionary expense category by 10% this month.'
            : 'Move part of positive net to savings now.',
          topCategory ? `Audit recent ${topCategory.category} transactions for quick cuts.` : 'Audit top monthly expenses.',
          atRiskAccounts.length > 0
            ? `Prioritize funding ${atRiskAccounts[0].name}.`
            : 'Set a minimum balance target for your main checking account.',
        ],
        confidence: 'medium',
      },
    }
  }

  if (question.includes('why') || question.includes('net')) {
    const primaryDriver = topCategory
      ? `${topCategory.category} (${topCategory.net >= 0 ? '+' : ''}$${topCategory.net.toFixed(2)})`
      : 'category activity'
    const netDirection = payload.summary.net >= 0 ? 'positive' : 'negative'
    return {
      ok: true,
      message: 'Net-trend explanation generated from local analytics.',
      result: {
        answer: `Your net is ${netDirection} at $${payload.summary.net.toFixed(2)} because expenses ($${payload.summary.expense.toFixed(2)}) ${payload.summary.expense > payload.summary.income ? 'are higher than' : 'are below'} income ($${payload.summary.income.toFixed(2)}). The biggest driver appears to be ${primaryDriver}.`,
        suggestedActions: [
          topCategory ? `Review and trim recent ${topCategory.category} transactions.` : 'Review your highest expense category.',
          payload.summary.net < 0 ? 'Set a short-term cap on discretionary spending.' : 'Keep current spending pace and increase savings transfer.',
          nextIncome.length > 0 ? `Plan around next income on ${nextIncome[0].date}.` : 'Add/verify recurring income to improve forecasting.',
        ],
        confidence: 'medium',
      },
    }
  }

  if (question.includes('income')) {
    return {
      ok: true,
      message: 'Income-focused response generated from local analytics.',
      result: {
        answer: `Month-to-date income is $${payload.summary.income.toFixed(2)}. ${nextIncome.length > 0 ? `Upcoming recurring income includes ${nextIncome.map((item) => `${item.description} on ${item.date}`).join('; ')}.` : 'No upcoming recurring income is currently in the preview window.'}`,
        suggestedActions: [
          'Confirm all expected paychecks are entered in Income/Recurring.',
          'Tag income sources consistently for cleaner reporting.',
        ],
        confidence: 'medium',
      },
    }
  }

  if (question.includes('expense') || question.includes('spend')) {
    return {
      ok: true,
      message: 'Expense-focused response generated from local analytics.',
      result: {
        answer: `Month-to-date expenses are $${payload.summary.expense.toFixed(2)}. ${topCategory ? `Largest category impact is ${topCategory.category} at ${topCategory.net >= 0 ? '+' : ''}$${topCategory.net.toFixed(2)} net.` : 'No category trend is available yet.'}`,
        suggestedActions: [
          topCategory ? `Audit ${topCategory.category} transactions first.` : 'Audit your top expense category first.',
          'Set a weekly spending threshold and check progress mid-week.',
        ],
        confidence: 'medium',
      },
    }
  }

  if (question.includes('member') || question.includes('who')) {
    return {
      ok: true,
      message: 'Member-focused response generated from local analytics.',
      result: {
        answer: topMember
          ? `Top member net this month is ${topMember.member} at $${topMember.net.toFixed(2)}.`
          : 'No member-level net data is available yet for this month.',
        suggestedActions: [
          'Compare member-level income and expense trends for outliers.',
          'Use member tags/ownership consistently on new transactions.',
        ],
        confidence: topMember ? 'medium' : 'low',
      },
    }
  }

  const suggestedActions = [
    'Try a specific ask like: "Why is net down this month?", "Top spending category?", or "Who has the highest net?"',
    'Enable/configure provider AI in Settings for richer free-form answers.',
    topCategory ? `For now, review ${topCategory.category} transactions first.` : 'For now, review your top monthly expense category.',
  ]

  return {
    ok: true,
    message: 'Fallback assistant response generated from local analytics.',
    result: {
      answer: `I received your question: "${payload.question}". In fallback mode I only support targeted finance intents (net, income, expenses, member, risk, actions), so this question may look generic unless provider AI is enabled. Current snapshot: net $${payload.summary.net.toFixed(2)} (income $${payload.summary.income.toFixed(2)}, expense $${payload.summary.expense.toFixed(2)}).`,
      suggestedActions,
      confidence: 'low',
    },
  }
}

const runProviderDashboardAssistant = async (payload: AIDashboardAssistantRequest): Promise<AIDashboardAssistantResult | null> => {
  const provider = getConfiguredProvider()
  if (!provider) return null

  const available = await provider.isAvailable()
  if (!available) return null

  const prompt = JSON.stringify(
    {
      task: 'Answer a household budgeting dashboard question with concise practical guidance.',
      requirements: [
        'Use only provided context.',
        'Be concise, specific, and actionable.',
        'Return JSON only matching output shape.',
      ],
      outputShape: {
        answer: 'string',
        suggestedActions: 'string[]',
        confidence: "'low'|'medium'|'high'",
      },
      payload,
    },
    null,
    2,
  )

  try {
    const result = await provider.generateJson<AIDashboardAssistantResult['result']>(prompt)
    if (!result) return null
    return {
      ok: true,
      message: 'Dashboard assistant response generated with AI provider.',
      result,
    }
  } catch {
    return null
  }
}

export const aiService = {
  async listModels(payload: { provider: 'none' | 'ollama' | 'lmstudio'; baseUrl?: string }): Promise<AIModelOption[]> {
    if (payload.provider === 'none') return []

    try {
      if (payload.provider === 'ollama') {
        const baseUrl = payload.baseUrl ?? 'http://127.0.0.1:11434'
        const response = await fetchWithTimeout(`${baseUrl}/api/tags`)
        if (!response.ok) return []

        const json = (await response.json()) as { models?: Array<{ name?: string; model?: string }> }
        return (json.models ?? [])
          .map((item) => {
            const id = (item.name ?? item.model ?? '').trim()
            return id ? { id, label: id } : null
          })
          .filter((item): item is AIModelOption => item != null)
      }

      const baseUrl = payload.baseUrl ?? 'http://127.0.0.1:1234'
      const normalizedBase = baseUrl.replace(/\/$/, '')
      const modelsUrl = normalizedBase.endsWith('/v1') ? `${normalizedBase}/models` : `${normalizedBase}/v1/models`
      const response = await fetchWithTimeout(modelsUrl)
      if (!response.ok) return []

      const json = (await response.json()) as { data?: Array<{ id?: string }> }
      return (json.data ?? [])
        .map((item) => {
          const id = (item.id ?? '').trim()
          return id ? { id, label: id } : null
        })
        .filter((item): item is AIModelOption => item != null)
    } catch {
      return []
    }
  },

  async testConnection(payload: { provider: 'none' | 'ollama' | 'lmstudio'; baseUrl?: string; model?: string }) {
    if (payload.provider === 'none') {
      return { ok: true, message: 'AI disabled. App continues without AI.' }
    }

    const provider = createProvider(payload)
    if (!provider) {
      return { ok: false, message: 'No provider selected.' }
    }

    if (!payload.model?.trim()) {
      return { ok: false, message: 'No model selected. Choose a model before testing.' }
    }

    const available = await provider.isAvailable()
    if (!available) {
      return {
        ok: false,
        message: 'Unable to connect. Verify URL/model and local server status.',
      }
    }

    try {
      await provider.generateJson<{ ok: boolean }>(JSON.stringify({
        task: 'connection-health-check',
        outputShape: { ok: 'boolean' },
        response: { ok: true },
      }))

      return { ok: true, message: 'Connected successfully and model generation is working.' }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const timeoutHint = errorMessage.toLowerCase().includes('timed out')
        ? ' (The model may still be loading; try again in a moment or choose a smaller/faster model.)'
        : ''
      return {
        ok: false,
        message: `Connected to endpoint, but model generation failed: ${errorMessage}${timeoutHint}`,
      }
    }

  },

  async suggestTransactionFields(payload: AISuggestTransactionFieldsRequest): Promise<AISuggestTransactionFieldsResult> {
    const aiResult = await runProviderSuggest(payload)
    if (aiResult?.suggestion) return aiResult
    return deterministicSuggest(payload)
  },

  async suggestTaxWriteOffs(payload: AISuggestTaxWriteOffsRequest): Promise<AISuggestTaxWriteOffsResult> {
    const aiResult = await runProviderSuggestTaxWriteOffs(payload)
    if (aiResult?.result) return aiResult
    return deterministicSuggestTaxWriteOffs(payload)
  },

  async detectDuplicateTransaction(payload: AIDetectDuplicateTransactionRequest): Promise<AIDetectDuplicateTransactionResult> {
    return deterministicDuplicateCheck(payload)
  },

  async explainMonth(payload: AIExplainMonthRequest): Promise<AIExplainMonthResult> {
    const aiResult = await runProviderExplainMonth(payload)
    if (aiResult?.explanation) return aiResult
    return deterministicExplainMonth(payload)
  },

  async dashboardAssistant(payload: AIDashboardAssistantRequest): Promise<AIDashboardAssistantResult> {
    const aiResult = await runProviderDashboardAssistant(payload)
    if (aiResult?.result) return aiResult
    return deterministicDashboardAssistant(payload)
  },
}

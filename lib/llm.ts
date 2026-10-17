import 'server-only'

import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModel } from 'ai'

const DEFAULT_CHAT_MODEL = 'google/gemini-2.5-pro'

const openrouter = process.env.OPENROUTER_API_KEY
  ? createOpenAICompatible({
      name: 'openrouter',
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY,
      headers: { 'X-Title': 'StroyAudit.ai' },
      includeUsage: true,
    })
  : null

// OpenRouter is the primary provider; AI Gateway is only a fallback while the key isn't configured.
export function getChatModel(): LanguageModel {
  const modelId = process.env.CHAT_MODEL || DEFAULT_CHAT_MODEL
  return openrouter ? openrouter.chatModel(modelId) : modelId
}

import { AiConfig, ChatMessage } from '../../shared/types'

export interface ToolCall {
  name: string
  args: Record<string, unknown>
}

export interface ChatCompletionResult {
  content: string
  toolCalls: ToolCall[]
}

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}${path}`
}

/**
 * Minimal OpenAI-compatible chat completion client.
 * Works with OpenAI, Ollama, OpenRouter, LM Studio, Z.ai and any
 * gateway exposing POST {baseUrl}/chat/completions.
 */
export async function chatCompletion(
  cfg: AiConfig,
  messages: (ChatMessage | { role: 'system'; content: string })[],
  opts: { tools?: unknown[]; timeoutMs?: number } = {}
): Promise<ChatCompletionResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 120_000)
  try {
    const res = await fetch(joinUrl(cfg.baseUrl, '/chat/completions'), {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {})
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: cfg.temperature ?? 0.3,
        messages,
        ...(opts.tools && opts.tools.length > 0 ? { tools: opts.tools, tool_choice: 'auto' } : {})
      })
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`AI provider error ${res.status}: ${body.slice(0, 400)}`)
    }
    const data = (await res.json()) as {
      choices?: {
        message?: {
          content?: string | null
          tool_calls?: { function?: { name?: string; arguments?: string } }[]
        }
      }[]
    }
    const msg = data.choices?.[0]?.message
    const toolCalls: ToolCall[] = (msg?.tool_calls ?? [])
      .map((tc) => {
        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(tc.function?.arguments ?? '{}')
        } catch {
          args = {}
        }
        return { name: tc.function?.name ?? '', args }
      })
      .filter((tc) => tc.name)
    return { content: msg?.content ?? '', toolCalls }
  } finally {
    clearTimeout(timer)
  }
}


// ---- streaming SSE (OpenAI-compatible) --------------------------------------

/** Estrae gli eventi "data: ..." completi da un buffer SSE; restituisce il resto parziale. Puro, testabile. */
export function parseSSEBuffer(buffer: string): { events: string[]; rest: string } {
  const events: string[] = []
  let rest = buffer
  let idx: number
  while ((idx = rest.indexOf('\n')) >= 0) {
    const line = rest.slice(0, idx).replace(/\r$/, '')
    rest = rest.slice(idx + 1)
    if (line.startsWith('data:')) {
      const data = line.slice(5).trim()
      if (data) events.push(data)
    }
  }
  return { events, rest }
}

export interface AccumulatedToolCall {
  index: number
  id?: string
  name: string
  args: string
}

/** Accumula i framimenti delta.tool_calls (arrivano spezzati). Puro, testabile. */
export function accumulateToolCallDeltas(
  acc: AccumulatedToolCall[],
  deltas: { index: number; id?: string; function?: { name?: string; arguments?: string } }[]
): AccumulatedToolCall[] {
  const next = [...acc]
  for (const d of deltas) {
    const i = d.index ?? 0
    let slot = next.find((x) => x.index === i)
    if (!slot) {
      slot = { index: i, name: '', args: '' }
      next.push(slot)
    }
    if (d.id) slot.id = d.id
    if (d.function?.name) slot.name += d.function.name
    if (d.function?.arguments) slot.args += d.function.arguments
  }
  return next
}

/**
 * chat completion in streaming (SSE): emette i framimenti di contenuto via onContent
 * e restituisce lo stesso risultato di chatCompletion (contenuto completo + tool calls ricomposti).
 */
export async function chatCompletionStream(
  cfg: AiConfig,
  messages: (ChatMessage | { role: 'system'; content: string })[],
  opts: { tools?: unknown[]; timeoutMs?: number; onContent?: (delta: string) => void } = {}
): Promise<ChatCompletionResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 180_000)
  try {
    const res = await fetch(joinUrl(cfg.baseUrl, '/chat/completions'), {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {})
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: cfg.temperature ?? 0.3,
        stream: true,
        messages,
        ...(opts.tools && opts.tools.length > 0 ? { tools: opts.tools, tool_choice: 'auto' } : {})
      })
    })
    if (!res.ok || !res.body) {
      const body = await res.text().catch(() => '')
      throw new Error(`AI provider error ${res.status}: ${body.slice(0, 300)}`)
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let content = ''
    let toolAcc: AccumulatedToolCall[] = []
    let streamDone = false

    const handleEvents = (events: string[]) => {
      for (const ev of events) {
        if (ev === '[DONE]') {
          streamDone = true
          continue
        }
        let parsed: {
          choices?: {
            delta?: { content?: string | null; tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[] }
          }[]
        }
        try {
          parsed = JSON.parse(ev)
        } catch {
          continue
        }
        const delta = parsed.choices?.[0]?.delta
        if (!delta) continue
        if (delta.content) {
          content += delta.content
          opts.onContent?.(delta.content)
        }
        if (delta.tool_calls && delta.tool_calls.length > 0) {
          toolAcc = accumulateToolCallDeltas(toolAcc, delta.tool_calls)
        }
      }
    }

    const reader = res.body.getReader()
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const { events, rest } = parseSSEBuffer(buffer)
      buffer = rest
      handleEvents(events)
      if (streamDone) break
    }
    if (buffer.startsWith('data:')) handleEvents([buffer.slice(5).trim()])

    const toolCalls: ToolCall[] = toolAcc
      .filter((t) => t.name)
      .map((t) => {
        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(t.args || '{}')
        } catch {
          args = {}
        }
        return { name: t.name, args }
      })

    return { content, toolCalls }
  } finally {
    clearTimeout(timer)
  }
}

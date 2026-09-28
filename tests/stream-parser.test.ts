import { describe, expect, it } from 'vitest'
import { parseSSEBuffer, accumulateToolCallDeltas } from '../src/main/ai/client'

describe('parser SSE', () => {
  it('estrae gli eventi data: completi e conserva il resto parziale', () => {
    const { events, rest } = parseSSEBuffer('data: {"a":1}\n\ndata: {"b":2}\ndata: {"c":')
    expect(events).toEqual(['{"a":1}', '{"b":2}'])
    expect(rest).toBe('data: {"c":')
  })

  it('gestisce i \\r di fine riga e ignora le righe non-data', () => {
    const { events } = parseSSEBuffer('event: x\r\ndata: [DONE]\r\n: commento\r\n')
    expect(events).toEqual(['[DONE]'])
  })

  it('buffer vuoto → nessun evento', () => {
    expect(parseSSEBuffer('')).toEqual({ events: [], rest: '' })
  })
})

describe('accumulo tool_calls in streaming', () => {
  it('ricompone nome e argomenti spezzati su più frammenti', () => {
    let acc = accumulateToolCallDeltas([], [{ index: 0, id: 'call_1', function: { name: 'propose_arc' } }])
    acc = accumulateToolCallDeltas(acc, [{ index: 0, function: { name: 'hitecture_changes' } }])
    acc = accumulateToolCallDeltas(acc, [{ index: 0, function: { arguments: '{"ti' } }])
    acc = accumulateToolCallDeltas(acc, [{ index: 0, function: { arguments: 'tle":"X"}' } }])
    expect(acc).toEqual([{ index: 0, id: 'call_1', name: 'propose_architecture_changes', args: '{"title":"X"}' }])
  })

  it('tiene separati i tool call su indici diversi', () => {
    let acc = accumulateToolCallDeltas([], [
      { index: 0, id: 'a', function: { name: 'uno' } },
      { index: 1, id: 'b', function: { name: 'due', arguments: '{}' } }
    ])
    acc = accumulateToolCallDeltas(acc, [{ index: 1, function: { arguments: '{"x":1}' } }])
    expect(acc).toHaveLength(2)
    expect(acc.find((t) => t.index === 1)?.args).toBe('{}{"x":1}')
    expect(acc.find((t) => t.index === 0)?.name).toBe('uno')
  })
})

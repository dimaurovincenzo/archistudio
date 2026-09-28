import {
  AiChatResult,
  AiConfig,
  AiContextRequest,
  ArchiModel,
  ChatMessage,
  Proposal
} from '../../shared/types'
import { buildAiContext } from '../context'
import { chatCompletion, chatCompletionStream } from './client'
import { PROPOSE_TOOL, sanitizeOps } from './tools'
import { newId, nowIso } from '../../shared/ids'

const RULES = `You are the AI Architect inside ArchiStudio, a tool that designs software architecture before code.

The user's architecture model is provided as JSON in the ARCHITECTURE CONTEXT message. The model is the single source of truth.

Rules:
1. When the user asks for ANY change to components, relations, groups or artifacts, call the propose_architecture_changes tool with structured operations. Never describe changes only in text if they modify the model.
2. Reference existing components by their exact name (or id). When connecting new components, create both the nodes and the relations in the same proposal.
3. Respect what already exists: do not recreate components that are present. Prefer updating them.
4. Component type values come from the technology catalog (lowercase ids): databases (postgresql, mysql, mongodb, redis, dynamodb, elasticsearch, neo4j, influxdb, supabase, pinecone, qdrant…), messaging (rabbitmq, kafka, nats, sqs), languages/runtimes (nodejs, python, go, rust, java, php, dotnet…), frameworks (react, nextjs, vue, flutter, django, fastapi, spring, laravel, nestjs…), infra (docker, kubernetes, nginx, cloudflare, aws, gcp, lambda, s3), auth (keycloak, auth0, cognito), payments (stripe, paypal), communication (sendgrid, twilio, socketio), AI (openai, anthropic, gemini, ollama, langchain), and generic architectural types (web-app, mobile-app, api, backend, microservice, worker, cache, queue, cron, storage, auth, external-api, ai-service, generic). When the user names a specific technology, use its catalog id as type; the icon and color are derived automatically. Give every new component a short description and 1-4 responsibilities.
5. Position requests: you may set position {x, y} per new node; keep new nodes spread out (at least 160px apart).
6. For architecture analysis questions (no change requested), answer in text. Be concrete and reference component names.
7. When the user asks for a specification document, create an artifact (categories: requirements, system, component, api, database, dataflow, adr, deployment) with full markdown content.
8. If the request is ambiguous (e.g. two components share a name), ask a clarifying question instead of guessing.
9. Never invent components that the user did not mention or that are not required by a stated requirement.
10. Do not use emoji. Keep a professional, concise tone.
11. Always reply in the same language the user writes in. Default to Italian if unsure.`

export async function runAiTurn(
  cfg: AiConfig,
  model: ArchiModel,
  selection: AiContextRequest,
  history: ChatMessage[],
  onContent?: (delta: string) => void
): Promise<AiChatResult> {
  const context = buildAiContext(model, selection)
  const messages: { role: string; content: string }[] = [
    { role: 'system', content: RULES },
    {
      role: 'system',
      content: `ARCHITECTURE CONTEXT (current selection or whole project):\n${context}`
    },
    ...history.slice(-16)
  ]

  try {
    // prima via: streaming (i framimenti arrivano in UI via onContent); fallback non-stream
    let res
    try {
      res = await chatCompletionStream(cfg, messages as never, { tools: [PROPOSE_TOOL], onContent })
    } catch (streamErr) {
      const msg = String((streamErr as Error).message ?? streamErr)
      if (onContent === undefined || !/provider|stream|event/i.test(msg)) {
        // errore non legato allo streaming: propaga
        throw streamErr
      }
      res = await chatCompletion(cfg, messages as never, { tools: [PROPOSE_TOOL] })
    }
    const call = res.toolCalls.find((t) => t.name === PROPOSE_TOOL.function.name) ?? res.toolCalls[0]
    if (call) {
      const ops = sanitizeOps(model, call.args.ops)
      if (ops) {
        const proposal: Proposal = {
          id: newId('pr'),
          title: typeof call.args.title === 'string' ? call.args.title : 'Modifiche proposte',
          summary: typeof call.args.summary === 'string' ? call.args.summary : '',
          ops,
          source: 'ai',
          createdAt: nowIso(),
          status: 'pending'
        }
        return {
          reply: res.content?.trim() || proposal.summary || 'Ho preparato una serie di modifiche da rivedere.',
          proposal
        }
      }
    }
    return { reply: res.content?.trim() || '(risposta vuota dal modello)' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('abort')) return { reply: '', error: 'La richiesta al provider AI è andata in timeout.' }
    return { reply: '', error: msg }
  }
}

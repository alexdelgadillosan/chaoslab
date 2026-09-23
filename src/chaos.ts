export type Health = 'healthy' | 'degraded' | 'down'

export type ChaosFlag =
  | 'latency'
  | 'killDb'
  | 'http500'
  | 'stopWorker'
  | 'dupMessages'

export interface NodeState {
  id: string
  label: string
  detail: string
  health: Health
}

export interface Metrics {
  latencyMs: number[]
  errorRate: number
  queueDepth: number
  p99: number
  rps: number
}

export interface TraceSpan {
  id: string
  name: string
  service: string
  startMs: number
  durationMs: number
  status: 'ok' | 'error' | 'timeout'
}

export interface LabState {
  chaos: Record<ChaosFlag, boolean>
  nodes: NodeState[]
  metrics: Metrics
  spans: TraceSpan[]
  narrative: string
  narrativeTone: 'ok' | 'warn' | 'crit'
  tick: number
}

export const CHAOS_LABELS: Record<ChaosFlag, { title: string; hint: string }> = {
  latency: { title: 'Inject 500ms latency', hint: 'Toxiproxy-style delay on Service A → Redis' },
  killDb: { title: 'Kill database', hint: 'Postgres unreachable — Service B fails' },
  http500: { title: 'Return 50% HTTP 500', hint: 'Gateway stochastic fault injection' },
  stopWorker: { title: 'Stop worker', hint: 'Consumer offline — queue backs up' },
  dupMessages: { title: 'Duplicate messages', hint: 'At-least-once delivery storm' },
}

const BASE_NODES: Omit<NodeState, 'health'>[] = [
  { id: 'gateway', label: 'Gateway', detail: 'edge / ingress' },
  { id: 'svc-a', label: 'Service A', detail: 'Redis cache' },
  { id: 'svc-b', label: 'Service B', detail: 'Postgres' },
  { id: 'queue', label: 'Queue', detail: 'async buffer' },
  { id: 'worker', label: 'Worker', detail: 'consumer' },
]

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function jitter(base: number, spread: number): number {
  return base + (Math.random() - 0.5) * spread
}

export function createInitialState(): LabState {
  return {
    chaos: {
      latency: false,
      killDb: false,
      http500: false,
      stopWorker: false,
      dupMessages: false,
    },
    nodes: BASE_NODES.map((n) => ({ ...n, health: 'healthy' as Health })),
    metrics: {
      latencyMs: Array.from({ length: 40 }, () => jitter(42, 18)),
      errorRate: 0.4,
      queueDepth: 12,
      p99: 95,
      rps: 840,
    },
    spans: buildSpans(false, false, false, false),
    narrative: 'All systems nominal — circuit closed, retries idle, queue draining.',
    narrativeTone: 'ok',
    tick: 0,
  }
}

export function toggleChaos(state: LabState, flag: ChaosFlag): LabState {
  const next = {
    ...state,
    chaos: { ...state.chaos, [flag]: !state.chaos[flag] },
  }
  return derive(next)
}

export function resetChaos(state: LabState): LabState {
  return derive({
    ...createInitialState(),
    tick: state.tick + 1,
  })
}

export function tickSimulation(state: LabState): LabState {
  const { chaos } = state
  const last = state.metrics.latencyMs[state.metrics.latencyMs.length - 1] ?? 42

  let targetLatency = 42
  if (chaos.latency) targetLatency += 500
  if (chaos.killDb) targetLatency += 180
  if (chaos.http500) targetLatency += 40

  const nextLatency = clamp(
    last * 0.65 + targetLatency * 0.35 + jitter(0, chaos.latency ? 40 : 12),
    20,
    900,
  )

  let errorRate = 0.3 + Math.random() * 0.5
  if (chaos.http500) errorRate = 48 + Math.random() * 8
  else if (chaos.killDb) errorRate = 22 + Math.random() * 10
  else if (chaos.latency) errorRate = 4 + Math.random() * 3
  else if (chaos.stopWorker) errorRate = 2 + Math.random() * 2

  let queueDepth = state.metrics.queueDepth
  if (chaos.stopWorker) queueDepth = clamp(queueDepth + 8 + Math.random() * 12, 0, 999)
  else if (chaos.dupMessages) queueDepth = clamp(queueDepth + 5 + Math.random() * 8, 0, 999)
  else queueDepth = clamp(queueDepth * 0.82 + jitter(10, 6), 0, 999)

  const latencyMs = [...state.metrics.latencyMs.slice(1), nextLatency]
  const p99 = clamp(Math.max(...latencyMs.slice(-10)) * 1.15, 40, 1200)
  const rps = clamp(
    chaos.http500 || chaos.killDb ? jitter(210, 60) : jitter(840, 80),
    50,
    1200,
  )

  const next: LabState = {
    ...state,
    tick: state.tick + 1,
    metrics: {
      latencyMs,
      errorRate: Math.round(errorRate * 10) / 10,
      queueDepth: Math.round(queueDepth),
      p99: Math.round(p99),
      rps: Math.round(rps),
    },
  }

  // Rebuild spans every few ticks so waterfall animates
  if (state.tick % 3 === 0) {
    next.spans = buildSpans(chaos.latency, chaos.killDb, chaos.http500, chaos.stopWorker)
  }

  return derive(next)
}

function derive(state: LabState): LabState {
  const { chaos } = state
  const nodes = BASE_NODES.map((n): NodeState => {
    let health: Health = 'healthy'
    if (n.id === 'gateway') {
      if (chaos.http500) health = 'degraded'
      if (chaos.killDb && chaos.http500) health = 'down'
    }
    if (n.id === 'svc-a') {
      if (chaos.latency) health = 'degraded'
    }
    if (n.id === 'svc-b') {
      if (chaos.killDb) health = 'down'
      else if (chaos.http500) health = 'degraded'
    }
    if (n.id === 'queue') {
      if (chaos.stopWorker || chaos.dupMessages) health = 'degraded'
      if (chaos.stopWorker && chaos.dupMessages) health = 'down'
    }
    if (n.id === 'worker') {
      if (chaos.stopWorker) health = 'down'
      else if (chaos.dupMessages) health = 'degraded'
    }
    return { ...n, health }
  })

  const { narrative, narrativeTone } = buildNarrative(chaos)

  return {
    ...state,
    nodes,
    narrative,
    narrativeTone,
    spans: buildSpans(chaos.latency, chaos.killDb, chaos.http500, chaos.stopWorker),
  }
}

function buildNarrative(chaos: Record<ChaosFlag, boolean>): {
  narrative: string
  narrativeTone: LabState['narrativeTone']
} {
  const active = (Object.keys(chaos) as ChaosFlag[]).filter((k) => chaos[k])
  if (active.length === 0) {
    return {
      narrative: 'All systems nominal — circuit closed, retries idle, queue draining.',
      narrativeTone: 'ok',
    }
  }

  if (chaos.http500 && chaos.killDb) {
    return {
      narrative:
        'Cascading failure — circuit breaker OPEN, bulkhead isolating Service B. Failing fast at gateway.',
      narrativeTone: 'crit',
    }
  }
  if (chaos.http500) {
    return {
      narrative: 'Circuit breaker OPEN — failing fast on 50% of gateway requests. Fallback serving stale cache.',
      narrativeTone: 'crit',
    }
  }
  if (chaos.killDb) {
    return {
      narrative:
        'Postgres DOWN — Service B retries exhausted. Hedged requests cancelled; write path rejected.',
      narrativeTone: 'crit',
    }
  }
  if (chaos.stopWorker && chaos.dupMessages) {
    return {
      narrative:
        'Worker offline + duplicate storm — queue depth climbing. Idempotency keys preventing double-apply.',
      narrativeTone: 'crit',
    }
  }
  if (chaos.stopWorker) {
    return {
      narrative: 'Worker STOPPED — queue recovery pending. Messages retained; redelivery on reconnect.',
      narrativeTone: 'warn',
    }
  }
  if (chaos.dupMessages) {
    return {
      narrative: 'Duplicate messages detected — at-least-once delivery. Dedup window absorbing extras.',
      narrativeTone: 'warn',
    }
  }
  if (chaos.latency) {
    return {
      narrative:
        'Injected 500ms latency on Redis path — timeout budgets tight. Retry backoff engaged (exp + jitter).',
      narrativeTone: 'warn',
    }
  }
  return {
    narrative: 'Degraded mode — observing blast radius and recovery signals.',
    narrativeTone: 'warn',
  }
}

function buildSpans(
  latency: boolean,
  killDb: boolean,
  http500: boolean,
  stopWorker: boolean,
): TraceSpan[] {
  const gwFail = http500 && Math.random() < 0.5
  const dbFail = killDb
  const redisSlow = latency

  const spans: TraceSpan[] = [
    {
      id: '1',
      name: 'GET /api/orders',
      service: 'gateway',
      startMs: 0,
      durationMs: gwFail ? 12 : redisSlow ? 620 : 48,
      status: gwFail ? 'error' : 'ok',
    },
  ]

  if (!gwFail) {
    spans.push({
      id: '2',
      name: 'cache.get',
      service: 'svc-a',
      startMs: 8,
      durationMs: redisSlow ? 520 : 14,
      status: redisSlow ? 'timeout' : 'ok',
    })
    spans.push({
      id: '3',
      name: 'db.query',
      service: 'svc-b',
      startMs: redisSlow ? 540 : 28,
      durationMs: dbFail ? 2000 : 36,
      status: dbFail ? 'error' : 'ok',
    })
    if (!dbFail) {
      spans.push({
        id: '4',
        name: 'enqueue',
        service: 'queue',
        startMs: redisSlow ? 590 : 72,
        durationMs: 18,
        status: 'ok',
      })
      spans.push({
        id: '5',
        name: 'process.job',
        service: 'worker',
        startMs: redisSlow ? 620 : 95,
        durationMs: stopWorker ? 0 : 110,
        status: stopWorker ? 'error' : 'ok',
      })
    }
  } else {
    spans.push({
      id: '2',
      name: 'circuit.reject',
      service: 'gateway',
      startMs: 2,
      durationMs: 4,
      status: 'error',
    })
  }

  return spans
}

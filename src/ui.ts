import type { ChaosFlag, Health, LabState, TraceSpan } from './chaos'
import { CHAOS_LABELS } from './chaos'

const HEALTH_CLASS: Record<Health, string> = {
  healthy: 'dot-ok',
  degraded: 'dot-warn',
  down: 'dot-crit',
}

const HEALTH_LABEL: Record<Health, string> = {
  healthy: 'OK',
  degraded: 'DEGRADED',
  down: 'DOWN',
}

export function mountShell(root: HTMLElement): void {
  root.innerHTML = `
    <div class="scanlines" aria-hidden="true"></div>
    <div class="grid-bg" aria-hidden="true"></div>
    <header class="topbar">
      <div class="brand">
        <span class="brand-mark">◆</span>
        <div>
          <h1>ChaosLab</h1>
          <p class="tagline">reliability engineering playground</p>
        </div>
      </div>
      <div class="topbar-meta">
        <span class="pill" id="tick-pill">TICK 0</span>
        <span class="pill pill-live"><span class="live-dot"></span> LIVE SIM</span>
      </div>
    </header>

    <main class="layout">
      <section class="panel topology-panel">
        <div class="panel-head">
          <h2>Service Topology</h2>
          <span class="panel-sub">Gateway → A → B → Queue → Worker</span>
        </div>
        <div class="topology" id="topology"></div>
      </section>

      <section class="panel controls-panel">
        <div class="panel-head">
          <h2>Fault Injection</h2>
          <span class="panel-sub">click to toggle chaos</span>
        </div>
        <div class="controls" id="controls"></div>
        <button type="button" class="btn btn-reset" id="reset-btn">⟲ Reset all chaos</button>
      </section>

      <section class="panel narrative-panel">
        <div class="panel-head">
          <h2>Status</h2>
          <span class="panel-sub">operator narrative</span>
        </div>
        <p class="narrative" id="narrative"></p>
      </section>

      <section class="panel metrics-panel">
        <div class="panel-head">
          <h2>Telemetry</h2>
          <span class="panel-sub">synthetic but convincing</span>
        </div>
        <div class="metrics" id="metrics"></div>
      </section>

      <section class="panel traces-panel">
        <div class="panel-head">
          <h2>Trace Waterfall</h2>
          <span class="panel-sub">OpenTelemetry-style spans</span>
        </div>
        <div class="waterfall" id="waterfall"></div>
      </section>

      <section class="panel arch-panel">
        <div class="panel-head">
          <h2>Architecture Notes</h2>
          <span class="panel-sub">patterns under test</span>
        </div>
        <ul class="arch-list">
          <li><strong>Retries</strong> — exponential backoff + jitter on Redis/DB paths; budget capped so latency injection surfaces timeout risk.</li>
          <li><strong>Circuit breaker / fallback</strong> — gateway trips OPEN on 500 storms; fails fast and serves stale cache instead of amplifying load.</li>
          <li><strong>Queue recovery</strong> — stopped workers retain messages; reconnect drains backlog. Duplicates hit idempotency keys (at-least-once).</li>
        </ul>
      </section>
    </main>

    <footer class="footer">
      <span>client-side demo · no real infra harmed</span>
      <a href="https://github.com/alexdelgadillosan/chaoslab" target="_blank" rel="noopener">source</a>
    </footer>
  `
}

export function renderControls(
  el: HTMLElement,
  state: LabState,
  onToggle: (flag: ChaosFlag) => void,
): void {
  const flags = Object.keys(CHAOS_LABELS) as ChaosFlag[]
  el.innerHTML = flags
    .map((flag) => {
      const meta = CHAOS_LABELS[flag]
      const active = state.chaos[flag]
      return `
        <button
          type="button"
          class="btn chaos-btn ${active ? 'active' : ''}"
          data-flag="${flag}"
          aria-pressed="${active}"
        >
          <span class="chaos-title">${meta.title}</span>
          <span class="chaos-hint">${meta.hint}</span>
          <span class="chaos-state">${active ? 'ARMED' : 'idle'}</span>
        </button>
      `
    })
    .join('')

  el.querySelectorAll<HTMLButtonElement>('.chaos-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const flag = btn.dataset.flag as ChaosFlag
      onToggle(flag)
    })
  })
}

export function renderTopology(el: HTMLElement, state: LabState): void {
  const parts: string[] = []
  state.nodes.forEach((node, i) => {
    if (i > 0) {
      parts.push(`<div class="topo-edge" aria-hidden="true"><span></span></div>`)
    }
    parts.push(`
      <article class="topo-node health-${node.health}" data-id="${node.id}">
        <span class="health-dot ${HEALTH_CLASS[node.health]}" title="${HEALTH_LABEL[node.health]}"></span>
        <div class="topo-body">
          <strong>${node.label}</strong>
          <span>${node.detail}</span>
        </div>
        <span class="health-badge">${HEALTH_LABEL[node.health]}</span>
      </article>
    `)
  })
  el.innerHTML = parts.join('')
}

export function renderNarrative(el: HTMLElement, state: LabState): void {
  el.className = `narrative tone-${state.narrativeTone}`
  el.textContent = state.narrative
}

export function renderMetrics(el: HTMLElement, state: LabState): void {
  const { latencyMs, errorRate, queueDepth, p99, rps } = state.metrics
  const maxLat = Math.max(100, ...latencyMs)
  const points = latencyMs
    .map((v, i) => {
      const x = (i / (latencyMs.length - 1)) * 100
      const y = 100 - (v / maxLat) * 90
      return `${x},${y}`
    })
    .join(' ')

  const errClass = errorRate > 20 ? 'crit' : errorRate > 5 ? 'warn' : 'ok'
  const qClass = queueDepth > 100 ? 'crit' : queueDepth > 40 ? 'warn' : 'ok'

  el.innerHTML = `
    <div class="metric-card">
      <div class="metric-label">Latency (ms)</div>
      <svg class="sparkline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="latency sparkline">
        <polyline class="spark-line" points="${points}" />
      </svg>
      <div class="metric-value pulse">${Math.round(latencyMs[latencyMs.length - 1]!)}<small>ms</small></div>
      <div class="metric-meta">p99 ${p99}ms · ${rps} rps</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Error rate</div>
      <div class="gauge">
        <div class="gauge-fill ${errClass}" style="width:${Math.min(100, errorRate)}%"></div>
      </div>
      <div class="metric-value pulse ${errClass}">${errorRate.toFixed(1)}<small>%</small></div>
      <div class="metric-meta">gateway + downstream</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Queue depth</div>
      <div class="bars" aria-hidden="true">
        ${Array.from({ length: 8 }, (_, i) => {
          const h = Math.min(100, (queueDepth / 200) * 100 + i * 4)
          return `<span style="height:${h}%"></span>`
        }).join('')}
      </div>
      <div class="metric-value pulse ${qClass}">${queueDepth}</div>
      <div class="metric-meta">pending messages</div>
    </div>
  `
}

export function renderWaterfall(el: HTMLElement, spans: TraceSpan[]): void {
  const maxEnd = Math.max(...spans.map((s) => s.startMs + Math.max(s.durationMs, 8)), 200)
  el.innerHTML = spans
    .map((span) => {
      const left = (span.startMs / maxEnd) * 100
      const width = Math.max(2, (Math.max(span.durationMs, 4) / maxEnd) * 100)
      return `
        <div class="span-row">
          <div class="span-meta">
            <span class="span-svc">${span.service}</span>
            <span class="span-name">${span.name}</span>
          </div>
          <div class="span-track">
            <div
              class="span-bar status-${span.status}"
              style="left:${left}%;width:${width}%"
              title="${span.durationMs}ms · ${span.status}"
            ></div>
          </div>
          <div class="span-dur">${span.durationMs === 0 ? '—' : span.durationMs + 'ms'}</div>
        </div>
      `
    })
    .join('')
}

export function renderTick(el: HTMLElement, tick: number): void {
  el.textContent = `TICK ${tick}`
}

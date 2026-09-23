import './style.css'
import {
  createInitialState,
  resetChaos,
  tickSimulation,
  toggleChaos,
  type LabState,
} from './chaos'
import {
  mountShell,
  renderControls,
  renderMetrics,
  renderNarrative,
  renderTick,
  renderTopology,
  renderWaterfall,
} from './ui'

const root = document.querySelector<HTMLElement>('#app')
if (!root) throw new Error('#app missing')

mountShell(root)

const topologyEl = document.querySelector<HTMLElement>('#topology')!
const controlsEl = document.querySelector<HTMLElement>('#controls')!
const narrativeEl = document.querySelector<HTMLElement>('#narrative')!
const metricsEl = document.querySelector<HTMLElement>('#metrics')!
const waterfallEl = document.querySelector<HTMLElement>('#waterfall')!
const tickEl = document.querySelector<HTMLElement>('#tick-pill')!
const resetBtn = document.querySelector<HTMLButtonElement>('#reset-btn')!

let state: LabState = createInitialState()

function paint(fullControls = false): void {
  renderTopology(topologyEl, state)
  renderNarrative(narrativeEl, state)
  renderMetrics(metricsEl, state)
  renderWaterfall(waterfallEl, state.spans)
  renderTick(tickEl, state.tick)
  if (fullControls) {
    renderControls(controlsEl, state, (flag) => {
      state = toggleChaos(state, flag)
      paint(true)
    })
  }
}

resetBtn.addEventListener('click', () => {
  state = resetChaos(state)
  paint(true)
})

paint(true)

window.setInterval(() => {
  state = tickSimulation(state)
  paint(false)
}, 900)

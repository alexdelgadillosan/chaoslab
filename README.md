# ChaosLab

Distributed systems resilience playground — inject latency, kill dependencies, trip circuit breakers, and watch metrics and traces react in real time.

**Live demo:** https://alexdelgadillosan.github.io/chaoslab/

## Problem

Reliability patterns are hard to *see*. This lab makes latency, failures, and recovery visible in one click — a client-side ops console that simulates a service topology under chaos.

## Stack

- Vite + TypeScript (SPA)
- Synthetic metrics, traces, and health state (no backend required)
- Deployed to GitHub Pages

## Architecture

```
UI → API gateway → Service A (Redis) → Service B (Postgres) → Queue → Worker
         ↑ fault injection: latency / kill DB / HTTP 500 / stop worker / dup messages
```

Patterns under test: retries with backoff, circuit breaker + fallback, queue recovery with idempotency.

## Features

- **Service topology** with live health dots (green / yellow / red)
- **Chaos controls** — inject 500ms latency, kill database, 50% HTTP 500, stop worker, duplicate messages
- **Reset** to clear all faults
- **Telemetry** — latency sparkline, error rate %, queue depth
- **Trace waterfall** — spans stretch / fail when chaos is active
- **Status narrative** — e.g. “Circuit breaker OPEN — failing fast”

## Run locally

```bash
npm install
npm run dev
```

Build for production (base path `/chaoslab/`):

```bash
npm run build
npm run preview
```

## Deploy

Push to `main` runs [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) and publishes to GitHub Pages.

Enable **Settings → Pages → Source: GitHub Actions** on the repo if not already set.

## Attribution

Inspired by Microsoft Aspire polyglot samples + Toxiproxy-style fault injection; custom control panel and scenarios documented as deltas.

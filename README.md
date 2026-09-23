# ChaosLab

Distributed systems resilience playground.

**Problem:** Reliability patterns are hard to *see*. This lab makes latency, failures, and recovery visible in one click.

**Stack (target):** Polyglot services · queues · OpenTelemetry · Grafana / Aspire-style dashboard · fault injection

**Status:** Scaffold — implementation in progress.

## Architecture

UI → API gateway → Service A/B → Redis / PostgreSQL → Queue → Worker (+ inject latency / kill / 500s)

## What this repo will demonstrate

- Inject latency / kill dependency / HTTP 500 storm
- Retries, circuit breaker, queue recovery
- Traces and metrics reacting in real time

## Demo

- Live: _coming soon_
- Video: _coming soon_

## Run

```bash
# docker compose up  (coming soon)
```

## Attribution

Inspired by Microsoft Aspire polyglot samples + Toxiproxy-style fault injection; custom control panel and scenarios documented as deltas.

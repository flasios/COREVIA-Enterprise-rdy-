# ADR-0019: Dedicated TTS Gateway Runtime For Server-Side Speech Synthesis

> **Status:** accepted
>
> **Date:** 2026-03-12
>
> **Deciders:** Enterprise Architecture, Platform Architecture, UX Platform Lead

## Context

COREVIA currently has two different voice-related concerns:

- browser-side voice interaction and speech recognition in the web client,
- server-side speech synthesis via the Edge TTS adapter under `server/platform/tts/edge.ts`.

The server-side TTS adapter introduces a different runtime profile from the core API:

- it depends on Python execution,
- it expects a backend synthesis script,
- it creates audio files under `/tmp`,
- it is slower and more burst-prone than ordinary JSON request handling.

That makes server-side TTS a poor long-term fit for the main API runtime.

## Decision

We will treat **server-side TTS** as a dedicated gateway-style runtime.

This means:

- browser speech recognition remains a frontend concern,
- server-side synthesis for narrated outputs, audio briefings, and generated speech becomes the responsibility of a `tts-gateway` runtime,
- the API calls `tts-gateway` through a stable internal contract,
- long-running or pre-generated audio jobs may later be orchestrated through the `processing-worker` runtime, but the synthesis engine itself remains isolated in the gateway runtime.

## Current implementation blocker

The architecture direction is accepted, but the current repo still has a packaging gap:

- `platform/tts/edge.ts` references `scripts/edge_tts_synth.py`,
- that script is not currently present in the repository,
- therefore a production-ready `tts-gateway` cannot yet be packaged safely without first restoring or replacing the backend synthesis implementation.

## Consequences

### Positive

- Prevents Python and audio-generation concerns from contaminating the API runtime.
- Gives TTS its own timeout, health, caching, and dependency surface.
- Allows voice output to evolve independently from browser speech recognition.

### Negative

- Adds another runtime to build, secure, observe, and deploy.
- Requires a real synthesis backend to be restored or replaced.

## Explicit non-decision

This ADR does not require all voice features to move server-side. Browser speech recognition remains valid where it is already working well.
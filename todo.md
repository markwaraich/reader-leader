# Reader Leader Stage 4 Harness

## Phase 0 — Contracts and migration

- [x] Create `feat/stage-4-harness` from the source commit corresponding to checkpoint `691f7c79`.
- [x] Add versioned recognition, telemetry, scoring, and finalization contracts.
- [x] Add v2/v1 to v3 local-storage migration.

## Phase 1 — Audio and VAD

- [x] Add adaptive noise-floor calibration and RMS hysteresis.
- [x] Emit one visual nudge per silence episode at 3 seconds.
- [x] Emit one intervention per silence episode at 5 seconds.
- [x] Keep silence support separate from lexical error scoring.

## Phase 2 — Recognition and alignment

- [x] Add robust Web Speech handling with automatic `onend` restart while reading remains active.
- [x] Add cumulative-final transcript normalization.
- [x] Add deterministic alignment with a maximum four-token lookahead.
- [x] Add substitution, omission, and self-correction tracking.
- [x] Add tested Hiberno-English / Northern Irish rhotic and dental-stop fixtures.

## Phase 3 — Telemetry and scoring

- [x] Add bounded Zustand session telemetry.
- [x] Add deterministic WCPM, accuracy, substitution, omission, self-correction, and intervention metrics.
- [x] Keep browser resources and audio blobs outside the store.

## Phase 4 — Gemini finalization

- [x] Replace target-word diagnostics with one full-session finalization request.
- [x] Add structured Gemini output schema and prompt-injection boundary.
- [x] Enforce canonical token order, accent restraint, self-correction preservation, and server-side arithmetic.
- [x] Return validated client alignment on missing credentials, timeout, malformed output, or policy failure.

## Phase 5 — Product integration

- [x] Drive live word progression from final recognition observations rather than VAD bursts.
- [x] Add live recognition, nudge, intervention, and metrics UI.
- [x] Show model/client source, fallback warnings, and Stage 4 counters in the running record.
- [x] Preserve bounded token audio evidence and teacher audit actions.

## Release gates

- [x] Lint and strict TypeScript.
- [x] Unit, policy, storage, hook, and core assertions.
- [x] Production Chromium Stage 4 journey.
- [x] Final production build.
- [x] Managed sandbox synchronization and restart on `0.0.0.0:3000`.
- [x] HTTP 200, managed browser, and live Gemini smoke checks.
- [x] Managed checkpoint and feature-branch push.

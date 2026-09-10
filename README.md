# Reader Leader

Reader Leader is a Next.js App Router test harness for UK and Hiberno-English early-reading fluency assessment. It implements the full student-to-educator loop: story selection, live microphone analysis, recognition-driven word progression, timed literacy support, deterministic scoring, one-shot Gemini adjudication, celebration, and an auditable running record.

## Stage 4 Architecture

| Layer | Implementation |
|---|---|
| Audio and VAD | Web Audio `AnalyserNode`, adaptive noise-floor calibration, RMS hysteresis, `MediaRecorder`, and idempotent teardown |
| Support timing | A visual nudge at exactly 3 seconds of silence and an intervention at exactly 5 seconds; neither event creates a reading error |
| Recognition | Chrome-first Web Speech wrapper with interim results, final observations, robust error handling, and automatic `onend` restart while reading remains active |
| Alignment | Deterministic client sequence alignment with a maximum four-token lookahead to contain skipped-line errors |
| Accent restraint | Versioned Hiberno-English / Northern Irish allow-list for tested rhotic and dental-stop lexical/phoneme fixtures |
| Telemetry | Bounded Zustand store containing final observations, VAD events, token states, WCPM, accuracy, substitutions, omissions, and self-corrections |
| Final adjudication | One `POST /api/speech/align` request after completion; Gemini Flash returns schema-constrained token classifications |
| Trust boundary | Zod validates input/output, server policy preserves canonical story order and accent rules, and all scores are recomputed deterministically |
| Persistence | Versioned local-storage envelope (`reader-leader-session-v3`) with migration from v2 and v1 |

## Assessment Rules

The audio layer decides only whether speech or silence is present. It never decides whether a word is correct. Only final speech-recognition observations progress the lexical tracker. Interim hypotheses are display-only.

The alignment engine compares cumulative final recognition text with canonical story tokens. Exact matches and allow-listed regional variants are preferred, then substitutions, insertions, and omissions. Lookahead is capped at four target or observed tokens so a skipped line cannot cascade through the rest of the record. A wrong attempt followed by the target before the next token is committed becomes `self-corrected` and carries no accuracy penalty.

Accuracy and WCPM are deterministic. Unresolved substitutions and omissions reduce accuracy. Self-corrections and accepted regional variants do not. Silence nudges and interventions are counted as support telemetry, not mistakes.

## Accent-Invariance Contract

Regional restraint is a narrow allow-list, not general fuzzy matching. The initial tested fixtures include:

- Rhotic `horse`, including `/hɔɹs/`, `/hɔːɹs/`, `/hɔrs/`, and `/hɔːrs/`.
- Dental-stop `[t]` realizations such as `three → tree`, `thing → ting`, and `think → tink`.
- Dental-stop `[d]` realizations such as `this → dis`, `that → dat`, and `them → dem`.

The same observation remains score-impacting in Standard RP comparison mode unless it is otherwise an exact match. New variants require a fixture and regression test.

## Gemini Finalization

`POST /api/speech/align` accepts a versioned, bounded telemetry payload and optional short WAV evidence. The route loads canonical story text by `storyId`, invokes the server-only Google Gen AI SDK once, validates structured JSON, rejects canonical-token changes, re-applies accent and self-correction policy, and overwrites model-generated arithmetic with deterministic metrics.

If credentials are absent, the provider times out, or output fails schema or policy validation, the route returns HTTP 200 with `source: "client-fallback"`, a visible warning, and the validated client alignment. It never replaces failed adjudication with a fabricated perfect record.

Configure `GEMINI_API_KEY` and optional `GEMINI_MODEL` as server-only secrets. The default model is `gemini-3.6-flash`. Never place either value in a browser-prefixed variable.

## Browser Support and Privacy

Live lexical tracking depends on `SpeechRecognition`, which is not available consistently across all browsers. Reader Leader is therefore Chrome/Chromium-first. Unsupported browsers retain microphone/VAD support and manual navigation but display an explicit degraded-mode message; the application does not invent lexical judgments.

Some browsers use a remote recognition service for Web Speech. Deployments should disclose this to schools and guardians. Reader Leader does not persist raw session audio. Only optional bounded two-second evidence clips are retained locally for educator playback and final adjudication.

## Routes

| Route | Purpose |
|---|---|
| `/` | Story-band selection library |
| `/read` | Stage 4 live read-aloud canvas |
| `/celebrate` | Student celebration and educator-record handoff |
| `/dashboard` | Class metrics and phonetic-gap overview |
| `/dashboard/student` | Completed or seeded running record with evidence and audit actions |
| `POST /api/speech/align` | Full-session Gemini adjudication with validated client fallback |

## Run and Verify

```bash
pnpm install
pnpm check
pnpm test
pnpm build
pnpm start
```

The production server binds `0.0.0.0:3000`. `pnpm test` runs Vitest policy/unit tests, standalone core assertions, a production Next.js test build, and the Chromium read-aloud journey. `pnpm verify:gemini-live` is an opt-in live-provider smoke test and requires the server to be running with a valid Gemini secret.

## Deployment

Reader Leader requires a server runtime for its Next.js API route. `pnpm build` creates the standalone Next.js bundle and packages the runnable server, traced dependencies, and static assets into `dist/`. Production starts through `node dist/index.js` using the configured host and port.

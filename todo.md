# Reader Leader Route-Wiring Fix

- [x] Confirm `app/page.tsx` mounts `StoryLibrary` and each story card calls the existing `selectStory` action before navigation.
- [x] Confirm `app/read/page.tsx` mounts the existing `ReadingExperience` without retaining static Phase 1 controls.
- [x] Confirm `app/dashboard/student/page.tsx` mounts the existing hydrated running-record view and existing two-step override flow.
- [x] Apply only minimal corrections required by the active files; do not duplicate helper logic.
- [x] Verify Fat Cat and Brave Knight snapshots, microphone permission and hesitation timers, align-and-celebrate navigation, flagged `knight` evidence, and `accepted-teacher-override` audit persistence.
- [x] Run lint, strict TypeScript, the focused core checks, production build, and live browser flow.

## Production Preview

- [x] Confirm the story-card and microphone buttons retain their existing client `onClick` handlers.
- [x] Configure the managed preview command to run the compiled Next.js server without development HMR.
- [x] Build the production application and restart port 3000 under the production command.
- [x] Verify HTTP response, absence of `/_next/hmr`, React hydration, story navigation, and the microphone permission path on the preview URL.

## Phase 4 Demo Features

- [x] Extend typed session/alignment state for evaluation mode, false-correction rate, and a bounded attempt-audio data URI.
- [x] Advance the active token from VAD speech events and keep the 3s/5s FSM support bound to that token.
- [x] Automatically finish after the final token is spoken and paused, while retaining manual next/finish behavior.
- [x] Capture and persist a real two-second `knight` attempt segment and play it through a clean HTML5 Audio element.
- [x] Revoke temporary object URLs and release all audio graph resources on finish, reset, and unmount.
- [x] Add the Standard RP versus Hiberno-English/Northern Irish evaluation toggle and distinct alignment outcomes.
- [x] Verify strict TypeScript, focused assertions, production build, HTTP 200, hydration, and both evaluation paths.

## Green Band Completion and Session Isolation

- [x] Add The Lost Shield and King’s Ring to the typed Level 5 catalogue without changing The Brave Knight contract.
- [x] Render three consistent, interactive Green Band cards with friendly inline vector artwork.
- [x] Reset the active token and hesitation lifecycle to index 0 on `/read` mount, microphone start, and Read Again.
- [x] Ensure non-hero stories render neutral 100% records with story-appropriate assessment history.
- [x] Show the teacher-override success banner only when the active session has its own confirmed override.
- [x] Regression-test Brave Knight alignment, `knight` popover, retained audio playback, and two-click override.
- [x] Run strict checks, a clean production build, HTTP 200 verification, and restart `0.0.0.0:3000`.

## Reading Counter Start Gate

- [x] Confirm the current `/read` mount and microphone-start reset paths still force token index 0.
- [x] Ignore all VAD energy during the first 300 ms after microphone activation.
- [x] Require genuine sustained speech energy before emitting a speech-start edge or advancing the active token.
- [x] Preserve the Brave Knight alignment, two-second snippet, two-click override, and clean Reading Canvas UI.
- [x] Run focused assertions, the production Chromium regression, a clean build, HTTP 200, and restart `0.0.0.0:3000`.

## Natural Reading VAD Calibration

- [x] Keep the existing 300 ms microphone startup-noise gate unchanged.
- [x] Reduce the active RMS threshold by approximately 20% and shorten sustained-speech qualification to 90 ms.
- [x] Confirm startup noise still cannot advance token 0 and natural-paced speech still completes the Brave Knight regression.
- [x] Run strict checks, a clean production build, HTTP 200 verification, and restart `0.0.0.0:3000`.

## Evidence Pre-Roll and Baseline Patience

- [x] Capture the `knight` evidence window from 400 ms before token start through 1,600 ms after token start.
- [x] Keep the persisted attempt duration at exactly two seconds and preserve playback/cleanup behavior.
- [x] Delay the Baseline RP `horse` substitution interrupt until 1.8 seconds of completion patience.
- [x] Preserve the story grid, UI shells, regional 0.0% outcome, and two-click teacher override.
- [x] Run strict checks, timing regression assertions, a clean production build, HTTP 200, and restart `0.0.0.0:3000`.

## Stage Demo Timing Thresholds

- [x] Set hesitation amber feedback to 2,000 ms and the phonetic prompt to 3,800 ms.
- [x] Set Baseline RP patience to 800 ms and final-token auto-finish hold to 2,400 ms.
- [x] Update focused timing assertions and preserve all unrelated audio, alignment, and educator behavior.
- [x] Run strict checks, a clean production build, HTTP 200 verification, and restart `0.0.0.0:3000`.

## Final-Token Dialect Restraint Timing

- [x] Add evaluation-specific final-token delays: 1,200 ms regional and 2,400 ms Baseline RP.
- [x] Suppress general hesitation amber/prompt feedback on the final regional `horse` token.
- [x] Preserve the Baseline RP 800 ms anomaly reveal and keep it visible before celebration.
- [x] Update focused and browser regressions for the decoupled final-token paths.
- [x] Run `pnpm test`, strict checks, a clean production build, HTTP 200, and restart `0.0.0.0:3000`.

## Deployment Artifact Repair

- [x] Confirm whether the current project is still configured as static hosting while the app requires a Next.js server runtime.
- [x] Identify why the deployment pipeline expects `/dist` while `pnpm build` emits `.next`.
- [x] Apply the smallest deployment-compatible hosting or build correction without removing `/api/speech/align`.
- [x] Run `pnpm test`, a deployment-compatible production build, and local HTTP verification.
- [x] Save a deployment-ready checkpoint for publishing from the Management UI.

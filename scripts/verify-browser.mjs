import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";

const DEBUG_PORT = 9333;
const APP_PORT = 3100;
const APP_URL = `http://127.0.0.1:${APP_PORT}`;
const AUDIO_PATH = "/tmp/reader-leader-patterned.wav";
const PROFILE_PATH = `/tmp/reader-leader-cdp-profile-${process.pid}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function createPatternedWav(path, sampleRate = 44_100) {
  const tones = [[0.05, 0.2], [0.55, 0.9], [1.65, 1.95], [2.75, 3.05]];
  for (let index = 0; index < 11; index += 1) {
    const start = 8.6 + index * 0.75;
    tones.push([start, start + 0.3]);
  }
  const seconds = 20;
  const samples = seconds * sampleRate;
  const dataSize = samples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let sample = 0; sample < samples; sample += 1) {
    const time = sample / sampleRate;
    const active = tones.some(([start, end]) => time >= start && time <= end);
    const value = active ? Math.sin(2 * Math.PI * 440 * time) * 20_000 : 0;
    buffer.writeInt16LE(Math.round(value), 44 + sample * 2);
  }
  writeFileSync(path, buffer);
}

async function waitForUrl(url, attempts = 80) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {
      // The local process is still starting.
    }
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function createCdpClient(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  const pending = new Map();
  const events = [];
  let nextId = 1;
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) {
      if (["Runtime.exceptionThrown", "Runtime.consoleAPICalled", "Log.entryAdded"].includes(message.method)) events.push(message);
      return;
    }
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error.message));
    else waiter.resolve(message.result);
  });
  const ready = new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  async function command(method, params = {}) {
    await ready;
    const id = nextId;
    nextId += 1;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  }
  async function evaluate(expression) {
    const result = await command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  }
  return { command, evaluate, events, close: () => socket.close() };
}

async function waitForValue(evaluate, expression, timeoutMs = 8_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const value = await evaluate(expression);
      if (value) return value;
    } catch {
      // A full-page navigation can briefly destroy the previous execution context.
    }
    await sleep(100);
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

createPatternedWav(AUDIO_PATH);
rmSync(PROFILE_PATH, { force: true, recursive: true });
const appServer = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(APP_PORT)], {
  cwd: process.cwd(),
  env: { ...process.env, NODE_ENV: "production", NEXT_DIST_DIR: ".next-browser", GEMINI_API_KEY: "" },
  stdio: "ignore",
});

let chromium;
let client;
try {
  await waitForUrl(APP_URL);
  chromium = spawn("/usr/bin/chromium", [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--no-proxy-server", "--proxy-bypass-list=*",
    "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required",
    `--use-file-for-fake-audio-capture=${AUDIO_PATH}`, `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${PROFILE_PATH}`, "about:blank",
  ], { stdio: "ignore" });
  const targets = await (await waitForUrl(`http://127.0.0.1:${DEBUG_PORT}/json`)).json();
  const page = targets.find((target) => target.type === "page");
  assert.ok(page?.webSocketDebuggerUrl, "A Chromium page target is required.");
  client = createCdpClient(page.webSocketDebuggerUrl);
  await client.command("Page.enable");
  await client.command("Runtime.enable");
  await client.command("Log.enable");

  await client.command("Page.navigate", { url: APP_URL });
  await waitForValue(client.evaluate, "document.documentElement.dataset.readerLeaderHydrated === 'true'");
  assert.equal(await client.evaluate(`(() => { const section = [...document.querySelectorAll('section')].find((candidate) => candidate.querySelector('h2')?.textContent?.includes('Level 5: Green Band')); return section?.querySelectorAll('button').length; })()`), 3);
  assert.equal(await client.evaluate(`['The Brave Knight', 'The Lost Shield', "King's Ring"].every((title) => [...document.querySelectorAll('button')].some((button) => button.textContent?.includes(title)))`), true);
  assert.equal(await client.evaluate(`(() => { const storyButtons = [...document.querySelectorAll('button')].filter((button) => button.textContent?.includes('Focus:')); return storyButtons.length === 12 && storyButtons.every((button) => button.querySelector('svg')); })()`), true, "Every story card must retain its inline illustration without a storage dependency.");

  await client.evaluate(`[...document.querySelectorAll('button')].find((button) => button.textContent?.includes('The Lost Shield'))?.click()`);
  await waitForValue(client.evaluate, "location.pathname === '/read'");
  await waitForValue(client.evaluate, "JSON.parse(localStorage.getItem('reader-leader-session-v2')).state.session.currentTokenIndex === 0");
  assert.equal(await client.evaluate("document.body.textContent.includes('The knight searched the castle for his lost shield.')"), true);
  await client.evaluate("document.querySelector('button[aria-label=\"Next target word\"]')?.click()");
  await client.evaluate("document.querySelector('button[aria-label=\"Next target word\"]')?.click()");
  await waitForValue(client.evaluate, "JSON.parse(localStorage.getItem('reader-leader-session-v2')).state.session.currentTokenIndex === 2");
  await client.command("Page.navigate", { url: `${APP_URL}/celebrate` });
  await waitForValue(client.evaluate, "document.body.textContent.includes('Read Again')");
  assert.equal(await client.evaluate(`document.querySelector('svg[aria-label="A smiling gold celebration star"]') !== null`), true, "The celebration star must render without an external image request.");
  await client.evaluate(`[...document.querySelectorAll('a')].find((anchor) => anchor.textContent?.includes('Read Again'))?.click()`);
  await waitForValue(client.evaluate, "location.pathname === '/read'");
  await waitForValue(client.evaluate, "JSON.parse(localStorage.getItem('reader-leader-session-v2')).state.session.currentTokenIndex === 0");

  await client.command("Page.navigate", { url: APP_URL });
  await waitForValue(client.evaluate, "document.documentElement.dataset.readerLeaderHydrated === 'true'");
  await client.evaluate(`[...document.querySelectorAll('button')].find((button) => button.textContent?.includes('The Brave Knight'))?.click()`);
  await waitForValue(client.evaluate, "location.pathname === '/read'");
  assert.equal(await client.evaluate("document.querySelector('button[aria-pressed=\"true\"]')?.textContent.includes('Agent Restraint')"), true);
  await client.evaluate("document.querySelector('button[aria-label=\"Start microphone\"]')?.click()");
  await waitForValue(client.evaluate, "document.querySelector('button[aria-label=\"Stop recording and finish\"]') !== null");
  await sleep(350);
  const warmupEnvelope = JSON.parse(await client.evaluate("localStorage.getItem('reader-leader-session-v2')"));
  assert.equal(warmupEnvelope.state.session.currentTokenIndex, 0, "Startup noise must not advance the first word.");
  await waitForValue(client.evaluate, `[...document.querySelectorAll('span')].some((span) => span.textContent === 'went' && span.className.includes('E5A93C'))`, 8_000);
  await waitForValue(client.evaluate, "document.body.textContent.includes('w · e · n · t')", 10_000);
  await waitForValue(client.evaluate, "JSON.parse(localStorage.getItem('reader-leader-session-v2')).state.session.currentTokenIndex === 13", 20_000);
  await sleep(1_800);
  assert.equal(await client.evaluate("location.pathname"), "/read", "Regional completion should retain its clean final-word hold before navigation.");
  assert.equal(await client.evaluate(`[...document.querySelectorAll('span')].some((span) => span.textContent === 'horse.' && span.className.includes('E5A93C'))`), false, "Regional final horse must remain neutral.");
  await waitForValue(client.evaluate, "location.pathname === '/celebrate'", 24_000);

  const regionalEnvelope = JSON.parse(await client.evaluate("localStorage.getItem('reader-leader-session-v2')"));
  const regional = regionalEnvelope.state.session;
  assert.equal(regional.currentTokenIndex, 13);
  assert.equal(regional.evaluationMode, "regional-restraint");
  assert.equal(regional.alignment.metrics.accuracyRate, 93);
  assert.equal(regional.alignment.tokens.find((token) => token.token === "knight").scoreImpact, true);
  assert.equal(regional.alignment.metrics.falseCorrectionRate, 0);
  assert.equal(regional.alignment.tokens.find((token) => token.token.startsWith("horse")).status, "accepted-regional-variant");
  assert.match(regional.attemptSnippet.dataUri, /^data:audio\/wav/);
  assert.equal(regional.attemptSnippet.durationMs, 2_000);

  await client.evaluate(`[...document.querySelectorAll('a')].find((anchor) => anchor.textContent?.includes('View Educator Record'))?.click()`);
  await waitForValue(client.evaluate, "location.pathname === '/dashboard/student'");
  await client.evaluate(`[...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'knight')?.click()`);
  await waitForValue(client.evaluate, "document.body.textContent.includes('Listen to Attempt (2s)')");
  await client.evaluate("document.querySelector('button[aria-label=\"Play the retained two-second attempt\"]')?.click()");
  await waitForValue(client.evaluate, "document.body.textContent.includes('Playing the retained two-second attempt') || document.body.textContent.includes('Attempt playback complete')");
  assert.equal(await client.evaluate("document.body.textContent.includes('Provisional phonics error · included in accuracy until reviewed')"), true);
  assert.equal(await client.evaluate("document.body.textContent.includes('Override AI (Accept as Fluent)')"), true);
  await client.evaluate(`[...document.querySelectorAll('button')].find((button) => button.textContent?.includes('Confirm Phonics Error'))?.click()`);
  await waitForValue(client.evaluate, `document.body.textContent.includes("Confirmed: Sounded silent 'k'")`);
  await waitForValue(client.evaluate, "document.body.textContent.includes('Silent consonant intervention required')");
  const confirmedEnvelope = JSON.parse(await client.evaluate("localStorage.getItem('reader-leader-session-v2')"));
  assert.equal(confirmedEnvelope.state.session.alignment.metrics.accuracyRate, 93);
  assert.equal(confirmedEnvelope.state.session.alignment.tokens.find((token) => token.token === "knight").status, "confirmed-phonics-error");
  await client.evaluate(`[...document.querySelectorAll('button')].find((button) => button.textContent?.includes('Override AI (Accept as Fluent)'))?.click()`);
  await waitForValue(client.evaluate, "document.body.textContent.includes('Confirm: Accept as Fluent')");
  await client.evaluate(`[...document.querySelectorAll('button')].find((button) => button.textContent?.includes('Confirm: Accept as Fluent'))?.click()`);
  await waitForValue(client.evaluate, "document.body.textContent.includes('Accepted as fluent by educator')");
  const overrideEnvelope = JSON.parse(await client.evaluate("localStorage.getItem('reader-leader-session-v2')"));
  assert.equal(overrideEnvelope.state.overrides.at(-1).sessionId, regional.id);
  assert.equal(overrideEnvelope.state.session.alignment.tokens.find((token) => token.token === "knight").status, "accepted-teacher-override");
  assert.equal(overrideEnvelope.state.session.alignment.metrics.accuracyRate, 100);
  assert.equal(await client.evaluate("document.body.textContent.includes('Teacher override saved.')"), true);

  await client.command("Page.navigate", { url: APP_URL });
  await waitForValue(client.evaluate, "document.documentElement.dataset.readerLeaderHydrated === 'true'");
  await client.evaluate(`[...document.querySelectorAll('button')].find((button) => button.textContent?.includes('The Brave Knight'))?.click()`);
  await waitForValue(client.evaluate, "location.pathname === '/read'");
  await client.evaluate(`[...document.querySelectorAll('button')].find((button) => button.textContent?.includes('Standard Received Pronunciation'))?.click()`);
  await waitForValue(client.evaluate, "document.querySelector('button[aria-pressed=\"true\"]')?.textContent.includes('Baseline ASR')");
  await client.evaluate("document.querySelector('button[aria-label=\"Start microphone\"]')?.click()");
  await waitForValue(client.evaluate, "document.querySelector('button[aria-label=\"Stop recording and finish\"]') !== null");
  await waitForValue(client.evaluate, "JSON.parse(localStorage.getItem('reader-leader-session-v2')).state.session.currentTokenIndex === 13", 20_000);
  await waitForValue(client.evaluate, "document.body.textContent.includes('Baseline ASR interrupt')", 5_000);
  assert.equal(await client.evaluate(`[...document.querySelectorAll('span')].some((span) => span.textContent === 'horse.' && span.className.includes('E5A93C'))`), true, "Baseline final horse should show the substitution interrupt.");
  await sleep(1_400);
  assert.equal(await client.evaluate("location.pathname"), "/read", "Baseline interrupt should remain visible before final navigation.");
  await waitForValue(client.evaluate, "location.pathname === '/celebrate'", 8_000);
  const standardEnvelope = JSON.parse(await client.evaluate("localStorage.getItem('reader-leader-session-v2')"));
  const standard = standardEnvelope.state.session;
  assert.equal(standard.evaluationMode, "standard-rp");
  assert.equal(standard.alignment.tokens.find((token) => token.token.startsWith("horse")).status, "substitution");
  assert.equal(standard.alignment.metrics.falseCorrectionRate, 7.1);

  await client.command("Page.navigate", { url: APP_URL });
  await waitForValue(client.evaluate, "document.documentElement.dataset.readerLeaderHydrated === 'true'");
  await client.evaluate(`[...document.querySelectorAll('button')].find((button) => button.textContent?.includes('The Fat Cat'))?.click()`);
  await waitForValue(client.evaluate, "location.pathname === '/read'");
  for (let index = 0; index < 6; index += 1) {
    await client.evaluate("document.querySelector('button[aria-label=\"Next target word\"]')?.click()");
    await sleep(50);
  }
  await client.evaluate("document.querySelector('button[aria-label=\"Finish this reading\"]')?.click()");
  await waitForValue(client.evaluate, "location.pathname === '/celebrate'", 12_000);
  await client.evaluate(`[...document.querySelectorAll('a')].find((anchor) => anchor.textContent?.includes('View Educator Record'))?.click()`);
  await waitForValue(client.evaluate, "location.pathname === '/dashboard/student'");
  const introductoryEnvelope = JSON.parse(await client.evaluate("localStorage.getItem('reader-leader-session-v2')"));
  assert.equal(introductoryEnvelope.state.session.alignment.metrics.accuracyRate, 100);
  assert.equal(introductoryEnvelope.state.session.alignment.tokens.every((token) => token.status === "correct"), true);
  assert.equal(await client.evaluate("document.body.textContent.includes('Teacher override saved.')"), false);
  assert.equal(await client.evaluate("document.body.textContent.includes('Practising cvc words and short vowels')"), true);
  assert.equal(await client.evaluate("document.body.textContent.includes('Reviewed sounded silent')"), false);
  console.log("Green Band, reset, Brave Knight preservation, and non-hero educator isolation browser flow passed.");
} catch (error) {
  console.error("Browser verification failed:", error);
  if (client) console.error("Captured runtime events:", JSON.stringify(client.events, null, 2));
  throw error;
} finally {
  client?.close();
  chromium?.kill("SIGTERM");
  appServer.kill("SIGTERM");
  await sleep(500);
  rmSync(PROFILE_PATH, { force: true, recursive: true, maxRetries: 5, retryDelay: 100 });
}

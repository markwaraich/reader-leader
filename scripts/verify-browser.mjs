import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";

const DEBUG_PORT = 9333;
const APP_PORT = 3100;
const APP_URL = `http://127.0.0.1:${APP_PORT}`;
const AUDIO_PATH = "/tmp/reader-leader-stage4.wav";
const PROFILE_PATH = `/tmp/reader-leader-cdp-profile-${process.pid}`;
const STORAGE_KEY = "reader-leader-session-v3";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function createPatternedWav(path, sampleRate = 44_100) {
  const tones = [[0.05, 0.2], [0.55, 0.9], [1.65, 1.95], [2.75, 3.05]];
  for (let index = 0; index < 11; index += 1) {
    const start = 8.6 + index * 0.75;
    tones.push([start, start + 0.3]);
  }
  const seconds = 20;
  const buffer = Buffer.alloc(44 + seconds * sampleRate * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(buffer.length - 8, 4);
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
  buffer.writeUInt32LE(buffer.length - 44, 40);
  for (let sample = 0; sample < seconds * sampleRate; sample += 1) {
    const time = sample / sampleRate;
    const active = tones.some(([start, end]) => time >= start && time <= end);
    const value = active ? Math.sin(2 * Math.PI * 440 * time) * 20_000 : 0;
    buffer.writeInt16LE(Math.round(value), 44 + sample * 2);
  }
  writeFileSync(path, buffer);
}

async function waitForUrl(url, attempts = 100) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {}
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
    const id = nextId++;
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
    } catch {}
    await sleep(100);
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

const fakeRecognitionSource = `(() => {
  let starts = 0;
  class FakeSpeechRecognition {
    constructor() { this.continuous = false; this.interimResults = false; this.maxAlternatives = 1; this.lang = ''; this.onresult = null; this.onerror = null; this.onend = null; this.timers = []; }
    start() {
      starts += 1;
      if (starts === 1) {
        this.timers.push(setTimeout(() => this.onend?.(new Event('end')), 100));
        return;
      }
      const words = ['the', 'brave', 'kite knight', 'went', 'out', 'into', 'the', 'cold', 'night', 'to', 'find', 'his', 'lost', 'hoarse'];
      const times = [700, 1700, 2800, 8600, 9350, 10100, 10850, 11600, 12350, 13100, 13850, 14300, 14900, 15400];
      words.forEach((transcript, index) => {
        this.timers.push(setTimeout(() => {
          const result = [{ transcript, confidence: 0.96 }];
          result.isFinal = true;
          this.onresult?.({ resultIndex: 0, results: [result] });
        }, times[index]));
      });
    }
    stop() { this.timers.forEach(clearTimeout); this.timers = []; }
    abort() { this.stop(); }
  }
  Object.defineProperty(window, 'webkitSpeechRecognition', { configurable: true, value: FakeSpeechRecognition });
  Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: FakeSpeechRecognition });
})();`;

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
  await client.command("Page.addScriptToEvaluateOnNewDocument", { source: fakeRecognitionSource });

  await client.command("Page.navigate", { url: APP_URL });
  await waitForValue(client.evaluate, "document.documentElement.dataset.readerLeaderHydrated === 'true'");
  assert.equal(await client.evaluate(`['The Brave Knight', 'The Lost Shield', "King's Ring"].every((title) => [...document.querySelectorAll('button')].some((button) => button.textContent?.includes(title)))`), true);
  assert.equal(await client.evaluate(`[...document.querySelectorAll('button')].filter((button) => button.textContent?.includes('Focus:')).every((button) => button.querySelector('svg'))`), true);

  await client.evaluate(`[...document.querySelectorAll('button')].find((button) => button.textContent?.includes('The Brave Knight'))?.click()`);
  await waitForValue(client.evaluate, "location.pathname === '/read'");
  await client.evaluate("document.querySelector('button[aria-label=\"Start microphone\"]')?.click()");
  await waitForValue(client.evaluate, "document.querySelector('button[aria-label=\"Stop recording and finish\"]') !== null");
  await waitForValue(client.evaluate, "document.body.textContent.includes('Take your time. Look at the word when you’re ready.')", 9_000);
  await waitForValue(client.evaluate, "document.body.textContent.includes('Let’s try the first sound together.')", 5_000);
  await waitForValue(client.evaluate, `JSON.parse(localStorage.getItem('${STORAGE_KEY}')).state.session.currentTokenIndex === 13`, 22_000);
  await sleep(1_200);
  await client.evaluate("document.querySelector('button[aria-label=\"Stop recording and finish\"]')?.click()");
  await waitForValue(client.evaluate, "location.pathname === '/celebrate'", 8_000);

  const envelope = JSON.parse(await client.evaluate(`localStorage.getItem('${STORAGE_KEY}')`));
  const session = envelope.state.session;
  assert.equal(session.telemetry.version, 1);
  assert.equal(session.telemetry.events.some((event) => event.type === "visual-nudge"), true);
  assert.equal(session.telemetry.events.some((event) => event.type === "intervention"), true);
  assert.equal(session.telemetry.events.filter((event) => event.type === "recognition-restart").length, 1);
  assert.equal(session.telemetry.tokens.find((token) => token.normalizedToken === "knight").status, "self-corrected");
  assert.equal(session.telemetry.tokens.find((token) => token.normalizedToken === "horse").status, "accepted-regional-variant");
  assert.deepEqual(session.attemptSnippets.map((snippet) => snippet.token).sort(), ["horse", "knight"]);
  assert.equal(session.alignment.source, "client-fallback");
  assert.equal(session.alignment.metrics.accuracyRate, 100);
  assert.equal(session.alignment.metrics.selfCorrections, 1);
  assert.equal(session.alignment.metrics.interventions >= 1, true);

  await client.evaluate(`[...document.querySelectorAll('a')].find((anchor) => anchor.textContent?.includes('View Educator Record'))?.click()`);
  await waitForValue(client.evaluate, "location.pathname === '/dashboard/student'");
  assert.equal(await client.evaluate("document.body.textContent.includes('Validated client record')"), true);
  assert.equal(await client.evaluate("document.body.textContent.includes('Gemini is not configured')"), true);
  assert.equal(await client.evaluate("document.body.textContent.includes('Self-corrections 1')"), true);
  await client.evaluate(`[...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'knight')?.click()`);
  await waitForValue(client.evaluate, "document.body.textContent.includes('Self-correction recorded')");
  assert.equal(await client.evaluate("document.body.textContent.includes('Self-corrected during reading · no accuracy penalty')"), true);
  assert.equal(await client.evaluate("document.body.textContent.includes('Listen to Attempt (2s)')"), true);

  const seriousEvents = client.events.filter((event) => event.method === "Runtime.exceptionThrown" || event.params?.entry?.level === "error");
  assert.deepEqual(seriousEvents, []);
  console.log("Stage 4 VAD, recognition restart, bounded alignment, telemetry, evidence, and educator record browser flow passed.");
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

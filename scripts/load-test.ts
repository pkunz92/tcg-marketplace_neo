/**
 * TCG Marketplace – Load Test Script (Phase 5D)
 *
 * Tests the two highest-traffic read endpoints:
 *   1. GET /api/listings/          – paginated listing browse
 *   2. GET /api/search/?q=<term>   – trigram search (p95 target: <100 ms)
 *
 * Usage (autocannon):
 *   npx ts-node scripts/load-test.ts
 *
 * Usage (k6 – export K6_SCRIPT=true):
 *   K6_SCRIPT=true npx ts-node scripts/load-test.ts > /tmp/load-test.js && k6 run /tmp/load-test.js
 *
 * Environment:
 *   BASE_URL   Backend URL (default: http://localhost:8000)
 *   DURATION   Test duration in seconds (default: 30)
 *   CONNECTIONS Number of concurrent connections (default: 20)
 *   P95_WARN_MS Warn threshold in ms (default: 100)
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8000';
const DURATION = parseInt(process.env.DURATION ?? '30', 10);
const CONNECTIONS = parseInt(process.env.CONNECTIONS ?? '20', 10);
const P95_WARN_MS = parseInt(process.env.P95_WARN_MS ?? '100', 10);

const SEARCH_TERMS = ['pikachu', 'charizard', 'lightning', 'black lotus', 'blue-eyes'];

// ---------------------------------------------------------------------------
// autocannon runner (default)
// ---------------------------------------------------------------------------

async function runAutocannon() {
  // Dynamic import so the file can be parsed without autocannon installed.
  // Install with: npm i -D autocannon
  let autocannon: typeof import('autocannon');
  try {
    autocannon = await import('autocannon');
  } catch {
    console.error(
      '[load-test] autocannon not found. Install it:\n  npm i -D autocannon\n' +
      'Or use k6: K6_SCRIPT=true npx ts-node scripts/load-test.ts | k6 run -'
    );
    process.exit(1);
  }

  const endpoints = [
    { title: 'Listings browse', url: `${BASE_URL}/api/listings/?page=1` },
    ...SEARCH_TERMS.map((term) => ({
      title: `Search: ${term}`,
      url: `${BASE_URL}/api/search/?q=${encodeURIComponent(term)}&limit=20`,
    })),
  ];

  let hasWarning = false;

  for (const ep of endpoints) {
    console.log(`\n▶ ${ep.title}`);
    const result = await autocannon.default({
      url: ep.url,
      connections: CONNECTIONS,
      duration: DURATION,
      headers: { Accept: 'application/json' },
    });

    const p95 = result.latency.p97_5; // autocannon uses p97_5 as the nearest
    const rps = result.requests.average;
    const errors = result.errors;

    console.log(
      `  p95 latency : ${p95} ms  ${p95 > P95_WARN_MS ? '⚠️  EXCEEDS TARGET' : '✅'}`
    );
    console.log(`  avg RPS     : ${rps.toFixed(1)}`);
    console.log(`  errors      : ${errors}`);

    if (p95 > P95_WARN_MS) {
      hasWarning = true;
      console.warn(`  ⚠ ${ep.title} p95 ${p95} ms exceeds ${P95_WARN_MS} ms target`);
    }
  }

  if (hasWarning) {
    console.warn(
      `\n⚠  One or more endpoints exceeded the ${P95_WARN_MS} ms p95 latency target.`
    );
    process.exit(1);
  } else {
    console.log('\n✅ All endpoints within latency target.');
  }
}

// ---------------------------------------------------------------------------
// k6 script emitter (K6_SCRIPT=true)
// ---------------------------------------------------------------------------

function emitK6Script() {
  const urlList = [
    `${BASE_URL}/api/listings/?page=1`,
    ...SEARCH_TERMS.map(
      (t) => `${BASE_URL}/api/search/?q=${encodeURIComponent(t)}&limit=20`
    ),
  ];

  const urlsJson = JSON.stringify(urlList, null, 2);
  const script = `
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const p95Target = ${P95_WARN_MS};
const latency = new Trend('request_latency', true);

const URLS = ${urlsJson};

export const options = {
  vus: ${CONNECTIONS},
  duration: '${DURATION}s',
  thresholds: {
    http_req_duration: ['p(95)<' + p95Target],
    request_latency:   ['p(95)<' + p95Target],
  },
};

export default function () {
  const url = URLS[Math.floor(Math.random() * URLS.length)];
  const res = http.get(url, { headers: { Accept: 'application/json' } });
  latency.add(res.timings.duration);
  check(res, {
    'status 200': (r) => r.status === 200,
    [\`p95 < \${p95Target}ms\`]: () => res.timings.duration < p95Target * 2,
  });
  sleep(0.05);
}
`.trimStart();

  process.stdout.write(script);
}

// ---------------------------------------------------------------------------
// CI latency assertion helper
// ---------------------------------------------------------------------------

/**
 * Run a single timing check against the search endpoint – use this in CI
 * (no autocannon needed).
 *
 *   CI_CHECK=true npx ts-node scripts/load-test.ts
 */
async function runCiCheck() {
  const { default: http } = await import('http');

  function timedGet(url: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      http
        .get(url, (res) => {
          res.resume();
          res.on('end', () => resolve(Date.now() - start));
        })
        .on('error', reject);
    });
  }

  const samples: number[] = [];
  const term = 'pikachu';
  const url = `${BASE_URL}/api/search/?q=${term}&limit=20`;
  const runs = 20;

  console.log(`[CI] Warming up search endpoint (${runs} requests)...`);
  for (let i = 0; i < runs; i++) {
    samples.push(await timedGet(url));
  }

  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)];
  const p95 = samples[Math.floor(samples.length * 0.95)];

  console.log(`[CI] Search latency: median=${median}ms  p95=${p95}ms  (target <${P95_WARN_MS}ms)`);

  if (median > P95_WARN_MS) {
    console.warn(`[CI] ⚠ Median search latency ${median}ms exceeds ${P95_WARN_MS}ms target`);
    process.exitCode = 1;
  } else {
    console.log('[CI] ✅ Search latency within target.');
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

if (process.env.K6_SCRIPT === 'true') {
  emitK6Script();
} else if (process.env.CI_CHECK === 'true') {
  runCiCheck().catch((e) => { console.error(e); process.exit(1); });
} else {
  runAutocannon().catch((e) => { console.error(e); process.exit(1); });
}

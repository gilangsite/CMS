import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import process from 'node:process';

const port = 3100;
const baseUrl = `http://127.0.0.1:${port}`;

async function waitForServer() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 90000) {
    try {
      const res = await fetch(baseUrl);
      if (res.ok) return;
    } catch {
      // wait for Next.js to start
    }
    await delay(2000);
  }
  throw new Error('Timed out waiting for the app server to start');
}

async function request(path) {
  const res = await fetch(`${baseUrl}${path}`);
  return { status: res.status, url: res.url };
}

async function main() {
  const child = spawn('npm', ['run', 'dev', '--', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: process.cwd(),
    env: { ...process.env, CI: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });

  try {
    await waitForServer();
    const home = await request('/');
    const dashboard = await request('/app/dashboard');

    if (home.status !== 200) {
      throw new Error(`Home route returned unexpected status ${home.status}`);
    }
    if (dashboard.status !== 200) {
      throw new Error(
        `Dashboard route returned unexpected status ${dashboard.status}\n${output.slice(-2000)}`
      );
    }

    console.log('Smoke test passed');
    console.log(JSON.stringify({ home, dashboard }, null, 2));
  } finally {
    child.kill('SIGTERM');
    setTimeout(() => child.kill('SIGKILL'), 5000);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

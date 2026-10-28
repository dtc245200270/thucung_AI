import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const debugPort = 9222;
const profileDir = path.resolve('scratch/cdp_test_profile');

if (!fs.existsSync(profileDir)) {
  fs.mkdirSync(profileDir, { recursive: true });
}

console.log('[1] Spawning Chrome with separate profile and remote debugging port 9222...');
const chromeProc = spawn(chromePath, [
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profileDir}`,
  '--no-first-run',
  '--no-default-browser-check',
  'http://localhost:5173'
], {
  detached: true,
  stdio: 'ignore'
});
chromeProc.unref();

// Wait for Chrome CDP to become available
let connected = false;
let versionData = null;
for (let i = 0; i < 15; i++) {
  await new Promise(r => setTimeout(r, 600));
  try {
    const res = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
    if (res.ok) {
      versionData = await res.json();
      connected = true;
      break;
    }
  } catch (e) {
    // wait and retry
  }
}

if (!connected) {
  console.error('FAILED_TO_CONNECT_CDP');
  process.exit(1);
}

console.log('✓ CDP Handshake successful!');
console.log('Browser:', versionData.Browser);
console.log('Protocol Version:', versionData['Protocol-Version']);
console.log('WebSocket Debugger URL:', versionData.webSocketDebuggerUrl);

// Query list of pages
const listRes = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
const listData = await listRes.json();
console.log('Pages detected:', listData.length);
listData.forEach((p, idx) => {
  console.log(`  [${idx}] ${p.title} - ${p.url} (type: ${p.type})`);
});

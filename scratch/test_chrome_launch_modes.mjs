import { spawn } from 'child_process';
import path from 'path';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = path.resolve('scratch/cdp_test_profile_headed');

console.log('Testing headed Chrome launch on 9222 with separate profile...');
const proc = spawn(chromePath, [
  '--remote-debugging-port=9222',
  `--user-data-dir=${profileDir}`,
  '--no-first-run',
  '--no-default-browser-check',
  'http://127.0.0.1:5173/'
]);

proc.on('error', (err) => console.log('Proc error:', err));
proc.on('exit', (code, sig) => console.log('Proc exited:', code, sig));

let ok = false;
for (let i = 0; i < 10; i++) {
  await new Promise(r => setTimeout(r, 500));
  try {
    const res = await fetch('http://127.0.0.1:9222/json/version');
    if (res.ok) {
      console.log('Success! Version:', await res.json());
      ok = true;
      break;
    }
  } catch {}
}

if (!ok) {
  console.log('Headed mode failed or exited. Testing headless mode...');
  proc.kill();
} else {
  console.log('Headed mode is WORKING!');
  proc.kill();
}

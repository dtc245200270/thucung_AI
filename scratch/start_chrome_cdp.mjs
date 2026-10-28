import { spawn } from 'child_process';
import path from 'path';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = path.resolve('scratch/cdp_test_profile_headed');
const debugPort = 9222;

console.log('Khởi chạy Chrome daemon trên cổng 9222...');
const proc = spawn(chromePath, [
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profileDir}`,
  '--no-first-run',
  '--no-default-browser-check',
  'http://localhost:5173'
], {
  stdio: 'inherit'
});

proc.on('exit', (code, sig) => {
  console.log(`Chrome daemon exited with code ${code}, signal ${sig}`);
  process.exit(code || 0);
});

// Giữ tiến trình Node sống để giữ Chrome
setInterval(() => {}, 60000);

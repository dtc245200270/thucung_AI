import { execSync } from 'child_process';

const output = execSync('powershell -Command "Get-Process chrome | Select-Object Id, MainWindowTitle | Where-Object { $_.MainWindowTitle.Length -gt 0 } | Format-Table -AutoSize"', { encoding: 'utf8' });
console.log('=== CHROME WINDOWS ===');
console.log(output);

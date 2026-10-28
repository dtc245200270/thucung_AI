import { execSync } from 'child_process';

const output = execSync('powershell -Command "Get-CimInstance Win32_Process -Filter \\"name = \'chrome.exe\'\\" | Select-Object ProcessId, ParentProcessId, CommandLine | Format-List"', { encoding: 'utf8' });
console.log('=== CHROME PROCESSES ===');
console.log(output);

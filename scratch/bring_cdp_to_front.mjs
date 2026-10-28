import { execSync } from 'child_process';

const psCode = `
Add-Type @"
  using System;
  using System.Runtime.InteropServices;
  public class WinUtil {
    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
  }
"@

$procs = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*remote-debugging-port=9222*" -and $_.ParentProcessId -ne (Get-CimInstance Win32_Process -Filter "name='chrome.exe'").ProcessId }
# Find root chrome process for port 9222
$cdpProc = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*remote-debugging-port=9222*" -and $_.CommandLine -notlike "*--type=*" }

if ($cdpProc) {
  Write-Host "Found CDP Chrome root process ID: $($cdpProc.ProcessId)"
  $procObj = Get-Process -Id $cdpProc.ProcessId -ErrorAction SilentlyContinue
  if ($procObj -and $procObj.MainWindowHandle -ne 0) {
    [WinUtil]::ShowWindowAsync($procObj.MainWindowHandle, 3) # SW_MAXIMIZE = 3, SW_RESTORE = 9
    [WinUtil]::SetForegroundWindow($procObj.MainWindowHandle)
    Write-Host "Window brought to front via MainWindowHandle: $($procObj.MainWindowHandle)"
  } else {
    Write-Host "MainWindowHandle was 0 or not found directly on root process. Enumerating all chrome windows..."
    Get-Process chrome | Where-Object { $_.MainWindowHandle -ne 0 } | ForEach-Object {
      Write-Host "Found visible window on PID $($_.Id) with title: '$($_.MainWindowTitle)'"
      [WinUtil]::ShowWindowAsync($_.MainWindowHandle, 9)
      [WinUtil]::SetForegroundWindow($_.MainWindowHandle)
    }
  }
}
`;

try {
  const res = execSync(`powershell -NoProfile -Command "${psCode.replace(/"/g, '\\"')}"`, { encoding: 'utf8' });
  console.log(res);
} catch (e) {
  console.error('PS Error:', e.message);
}

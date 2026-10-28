Add-Type @"
  using System;
  using System.Text;
  using System.Runtime.InteropServices;
  using System.Collections.Generic;

  public class WindowHelper {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool SwitchToThisWindow(IntPtr hWnd, bool fAltTab);

    public static List<IntPtr> FindWindowsForPid(uint targetPid) {
      List<IntPtr> result = new List<IntPtr>();
      EnumWindows((hWnd, lParam) => {
        uint pid;
        GetWindowThreadProcessId(hWnd, out pid);
        if (pid == targetPid && IsWindowVisible(hWnd)) {
          StringBuilder sb = new StringBuilder(256);
          GetWindowText(hWnd, sb, 256);
          if (sb.Length > 0) {
            result.Add(hWnd);
          }
        }
        return true;
      }, IntPtr.Zero);
      return result;
    }
  }
"@

$cdpProc = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*remote-debugging-port=9222*" -and $_.CommandLine -notlike "*--type=*" }

if ($cdpProc) {
  Write-Host "Target PID: $($cdpProc.ProcessId)"
  $windows = [WindowHelper]::FindWindowsForPid($cdpProc.ProcessId)
  Write-Host "Visible windows found: $($windows.Count)"
  foreach ($w in $windows) {
    Write-Host "Bringing window $w to front..."
    [WindowHelper]::ShowWindowAsync($w, 9)
    [WindowHelper]::SetForegroundWindow($w)
    [WindowHelper]::SwitchToThisWindow($w, $true)
  }
}

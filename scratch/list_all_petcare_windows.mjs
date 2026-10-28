import { execSync } from 'child_process';

const code = `
Add-Type @"
  using System;
  using System.Text;
  using System.Runtime.InteropServices;
  using System.Collections.Generic;

  public class EnumAll {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);
    [DllImport("user32.dll", SetLastError = true)] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] public static extern bool IsWindowVisible(IntPtr hWnd);

    public static void ListWindows() {
      EnumWindows((hWnd, lParam) => {
        uint pid;
        GetWindowThreadProcessId(hWnd, out pid);
        StringBuilder sb = new StringBuilder(256);
        GetWindowText(hWnd, sb, 256);
        string title = sb.ToString();
        if (title.ToLower().Contains("petcare") || title.ToLower().Contains("chrome") || title.ToLower().Contains("5173")) {
          Console.WriteLine("PID: " + pid + " | Visible: " + IsWindowVisible(hWnd) + " | Title: " + title);
        }
        return true;
      }, IntPtr.Zero);
    }
  }
"@
[EnumAll]::ListWindows()
`;

const res = execSync(`powershell -NoProfile -Command "${code.replace(/"/g, '\\"')}"`, { encoding: 'utf8' });
console.log(res);

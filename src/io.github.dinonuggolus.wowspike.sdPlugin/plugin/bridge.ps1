param([Parameter(Mandatory)][int]$Port)
# Minimal WebSocket relay: host <-> stdin/stdout lines. Sends NO input to any window.
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System; using System.Collections.Concurrent; using System.Threading;
public static class StdinPump {
  public static ConcurrentQueue<string> Lines = new ConcurrentQueue<string>();
  public static void Start() {
    var t = new Thread(() => { string l; while ((l = Console.In.ReadLine()) != null) Lines.Enqueue(l); Lines.Enqueue("{\"kind\":\"stop\"}"); });
    t.IsBackground = true; t.Start();
  }
}
"@
$socket = New-Object System.Net.WebSockets.ClientWebSocket
$socket.Options.Proxy = $null
function Emit($o) { [Console]::WriteLine(($o | ConvertTo-Json -Compress -Depth 10)) }
try {
  [void]$socket.ConnectAsync([Uri]"ws://127.0.0.1:$Port", [Threading.CancellationToken]::None).GetAwaiter().GetResult()
  [StdinPump]::Start()
  Emit @{ bridge = 'ready' }
  $buffer = New-Object byte[] 65536
  $segment = New-Object 'System.ArraySegment[byte]' -ArgumentList @(, $buffer)
  $message = New-Object System.IO.MemoryStream
  $receive = $socket.ReceiveAsync($segment, [Threading.CancellationToken]::None)
  $running = $true
  while ($running -and $socket.State -eq [Net.WebSockets.WebSocketState]::Open) {
    $line = $null
    while ([StdinPump]::Lines.TryDequeue([ref]$line)) {
      $cmd = $line | ConvertFrom-Json
      if ($cmd.kind -eq 'stop') { $running = $false }
      elseif ($cmd.kind -eq 'send') {
        $bytes = [Text.Encoding]::UTF8.GetBytes([string]$cmd.message)
        $seg = New-Object 'System.ArraySegment[byte]' -ArgumentList @(, $bytes)
        [void]$socket.SendAsync($seg, [Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
      }
    }
    if ($receive.Wait(50)) {
      $r = $receive.Result
      if ($r.MessageType -eq [Net.WebSockets.WebSocketMessageType]::Close) { break }
      $message.Write($buffer, 0, $r.Count)
      if ($r.EndOfMessage) {
        $text = [Text.Encoding]::UTF8.GetString($message.ToArray()) -replace "[\r\n]+", ' '
        [Console]::WriteLine($text)
        $message.SetLength(0)
      }
      $receive = $socket.ReceiveAsync($segment, [Threading.CancellationToken]::None)
    }
  }
} catch { Emit @{ bridge = 'fatal'; error = $_.Exception.Message } }
finally { try { $socket.Dispose() } catch {} }

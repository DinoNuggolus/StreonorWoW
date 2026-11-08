param([int]$Port=0,[switch]$DryRun,[string]$GameProcess='Wow.exe',[int]$ParentPid=0,
      [ValidateSet('normal','unfocused','conflict')][string]$DryRunGuard='normal')
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object Text.UTF8Encoding($false)
Add-Type -TypeDefinition @"
using System; using System.Collections.Concurrent; using System.Threading; using System.Runtime.InteropServices;
public static class DockNative {
 public static ConcurrentQueue<string> Lines=new ConcurrentQueue<string>();
 public static void Start(){ var t=new Thread(()=>{string s; while((s=Console.In.ReadLine())!=null){ if(s.Length>1048576)continue; Lines.Enqueue(s); if(Lines.Count>1024)break; } Lines.Enqueue("{\"kind\":\"stop\"}");});t.IsBackground=true;t.Start(); }
 [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT {public ushort vk,scan; public uint flags,time;public UIntPtr extra;}
 [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT {public int x,y; public uint data,flags,time;public UIntPtr extra;}
 [StructLayout(LayoutKind.Explicit)] public struct UNION { [FieldOffset(0)] public KEYBDINPUT key; [FieldOffset(0)] public MOUSEINPUT mouse; }
 [StructLayout(LayoutKind.Sequential)] public struct INPUT {public uint type; public UNION data;}
 [DllImport("user32.dll",SetLastError=true)] public static extern uint SendInput(uint n,INPUT[] inputs,int size);
 [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int key);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hwnd,out uint pid);
 public static bool Down(int scan,bool up){var a=new INPUT[1];a[0].type=1;a[0].data.key.scan=(ushort)scan;a[0].data.key.flags=(uint)(8|(up?2:0));return SendInput(1,a,Marshal.SizeOf(typeof(INPUT)))==1;}
}
"@
function Emit($o){[Console]::WriteLine(($o|ConvertTo-Json -Compress -Depth 12))}
$vks=@(49,50,51,52,53,54,55,56,57,48,189,187,219,221,220)
$scans=@(2,3,4,5,6,7,8,9,10,11,12,13,26,27,43)
$held=@{}; $active=0; $started=[Diagnostics.Stopwatch]::StartNew(); $downAt=0
function Focused {
 if($DryRun){return $DryRunGuard -ne 'unfocused'}
 [uint32]$foregroundPid=0
 [void][DockNative]::GetWindowThreadProcessId([DockNative]::GetForegroundWindow(),[ref]$foregroundPid)
 try {return [string]::Equals(([Diagnostics.Process]::GetProcessById($foregroundPid).ProcessName),[IO.Path]::GetFileNameWithoutExtension($GameProcess),[StringComparison]::OrdinalIgnoreCase)}catch{return $false}
}
function Conflict([int]$slot){
 if($DryRun){return $DryRunGuard -eq 'conflict'}
 foreach($vk in @(16,17,18,91,92,160,161,162,163,164,165)+@($vks[$slot-1])){if(([int][DockNative]::GetAsyncKeyState($vk) -band 32768) -ne 0){return $true}}
 return $false
}
function Send-ChordSequence([int]$slot,[bool]$down){
 $sequence=@(@{vk=162;scan=29;up=$false},@{vk=160;scan=42;up=$false},@{vk=164;scan=56;up=$false},@{vk=$vks[$slot-1];scan=$scans[$slot-1];up=$false})
 if(-not $down){[array]::Reverse($sequence);foreach($step in $sequence){$step.up=$true}}
 if($DryRun){Emit @{bridge='chord';slot=$slot;down=$down;sequence=$sequence};return}
 $failed=$false
 foreach($step in $sequence){
  if(-not [DockNative]::Down($step.scan,$step.up)){
   if($down){throw 'SendInput failed'}
   # An unsuccessful key-up must not prevent the other owned keys being released.
   $failed=$true
  }
 }
 if($failed){throw 'SendInput release failed'}
}
function ReleaseActive([string]$reason){
 if($script:active -gt 0){$slot=$script:active;$script:active=0;try{Send-ChordSequence $slot $false}finally{Emit @{bridge='released';slot=$slot;reason=$reason}}}
}
function Command($cmd){
 if($cmd.kind -eq 'stop'){$script:running=$false;return}
 if($cmd.kind -eq 'release'){ReleaseActive 'release';return}
 if($cmd.kind -eq 'procCount'){
  # Count only: process names are enumerated, no property of the process is read, no handle is opened.
  if($DryRun){$n=[int]$env:STREONORDOCK_DRY_PROCS}else{$n=@(Get-Process -Name ([IO.Path]::GetFileNameWithoutExtension($GameProcess)) -ErrorAction SilentlyContinue).Count}
  Emit @{bridge='procs';count=$n;req=$cmd.req};return
 }
 if($cmd.kind -eq 'send'){
  if($script:socket -and $script:socket.State -eq 'Open'){
   if($outbox.Count -ge 128 -or ([string]$cmd.message).Length -gt 1048576){throw 'Host output limit'}
   $outbox.Enqueue([string]$cmd.message)
  };return
 }
 if($cmd.kind -ne 'chord' -or $cmd.slot -isnot [int] -or $cmd.slot -lt 1 -or $cmd.slot -gt 15 -or $cmd.down -isnot [bool]){return}
 [int]$slot=$cmd.slot
 if(-not $cmd.down){if($script:active -eq $slot){ReleaseActive 'keyUp'};$held.Remove($slot);return}
 if($held.ContainsKey($slot)){return};$held[$slot]=$true
 $reason=$null
 if($script:active -gt 0){$reason='overlap'}elseif(-not (Focused)){$reason='unfocused'}elseif(Conflict $slot){$reason='physical-conflict'}
 if($reason){Emit @{bridge='refused';slot=$slot;reason=$reason;pressId=$cmd.pressId};return}
 # Mark owned before sending: a partial SendInput failure still releases every planned key.
 $script:active=$slot;$script:downAt=$started.ElapsedMilliseconds
 Send-ChordSequence $slot $true
 # Acknowledge only a successfully sent down, never a refusal, repeat or release.
 Emit @{bridge='accepted';slot=$slot;pressId=$cmd.pressId}
}
$socket=$null;$running=$true
$outbox=New-Object 'System.Collections.Generic.Queue[string]'
$sendTask=$null;$sendCts=$null
try {
 if($Port -ne 0){
  if($Port -lt 1 -or $Port -gt 65535){throw 'Invalid port'}
  $socket=New-Object Net.WebSockets.ClientWebSocket;$socket.Options.Proxy=$null
  $cts=New-Object Threading.CancellationTokenSource(5000)
  try{[void]$socket.ConnectAsync([Uri]"ws://127.0.0.1:$Port",$cts.Token).GetAwaiter().GetResult()}finally{$cts.Dispose()}
 }
 [DockNative]::Start();Emit @{bridge='ready';dryRun=[bool]$DryRun}
 if($socket){$buffer=New-Object byte[] 65536;$segment=New-Object 'System.ArraySegment[byte]' -ArgumentList @(,$buffer);$message=New-Object IO.MemoryStream;$receive=$socket.ReceiveAsync($segment,[Threading.CancellationToken]::None)}
 while($running -and (-not $socket -or $socket.State -eq 'Open')){
  if($ParentPid -gt 0){try{[void][Diagnostics.Process]::GetProcessById($ParentPid)}catch{break}}
  if($active -gt 0){if($started.ElapsedMilliseconds-$downAt -ge 2000){ReleaseActive 'timeout'}elseif(-not (Focused)){ReleaseActive 'focus-lost'}}
  $line=$null;$batch=0
  while($running -and $batch -lt 64 -and [DockNative]::Lines.TryDequeue([ref]$line)){
   $batch++;try{Command ($line|ConvertFrom-Json)}catch{ReleaseActive 'error';Emit @{bridge='error';error=$_.Exception.Message}}
  }
  if($socket){
   try{
   # Never block the input/release loop on host backpressure. Only one send is in flight.
   if($sendTask -and $sendTask.IsCompleted){[void]$sendTask.GetAwaiter().GetResult();$sendTask=$null;$sendCts.Dispose();$sendCts=$null}
   if(-not $sendTask -and $outbox.Count -gt 0){
    $bytes=[Text.Encoding]::UTF8.GetBytes($outbox.Dequeue())
    $seg=New-Object 'System.ArraySegment[byte]' -ArgumentList @(,$bytes)
    $sendCts=New-Object Threading.CancellationTokenSource(2000)
    $sendTask=$socket.SendAsync($seg,[Net.WebSockets.WebSocketMessageType]::Text,$true,$sendCts.Token)
   }
   if($receive.Wait(10)){
    $r=$receive.Result;if($r.MessageType -eq 'Close'){break}
    if($message.Length+$r.Count -gt 1048576){throw 'Host frame limit'}
    $message.Write($buffer,0,$r.Count)
    if($r.EndOfMessage){[Console]::WriteLine(([Text.Encoding]::UTF8.GetString($message.ToArray()) -replace '[\r\n]+',' '));$message.SetLength(0)}
    $receive=$socket.ReceiveAsync($segment,[Threading.CancellationToken]::None)
   }
   }catch{
    # The host went away (Streonor quit/restarted/slept, or dropped the socket without a close
    # handshake): ReceiveAsync/SendAsync fault as an AggregateException. Not a relay bug.
    $inner=$_.Exception;while($inner.InnerException){$inner=$inner.InnerException}
    Emit @{bridge='disconnected';error=$inner.Message};break
   }
  }else{Start-Sleep -Milliseconds 10}
 }
}catch{Emit @{bridge='fatal';error=$_.Exception.Message}}
finally{try{ReleaseActive 'stop'}catch{};if($socket){$socket.Dispose()};if($sendCts){$sendCts.Dispose()};if($message){$message.Dispose()}}


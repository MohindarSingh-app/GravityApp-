# Starts the default Google Play Pixel AVD and waits until adb sees it as "device".
$ErrorActionPreference = 'Stop'

$sdk = $env:ANDROID_HOME
if (-not $sdk) { $sdk = $env:ANDROID_SDK_ROOT }
if (-not $sdk) { $sdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }

$adb = Join-Path $sdk 'platform-tools\adb.exe'
$emulator = Join-Path $sdk 'emulator\emulator.exe'
$avd = if ($env:ZYPLI_ANDROID_AVD) { $env:ZYPLI_ANDROID_AVD } else { 'Pixel_7' }

if (-not (Test-Path $emulator)) {
  Write-Error "Android emulator not found at $emulator. Install Android SDK Emulator in Android Studio."
}

& $adb kill-server | Out-Null
& $adb start-server | Out-Null

$running = & $adb devices | Select-String 'emulator-\d+\s+device'
if ($running) {
  Write-Host "Emulator already running:`n$($running.Line)"
  exit 0
}

Write-Host "Starting AVD: $avd (Google APIs / Play Store image)..."
Start-Process -FilePath $emulator -ArgumentList @('-avd', $avd, '-no-snapshot-load', '-no-boot-anim', '-gpu', 'auto', '-read-only') -WindowStyle Normal

for ($i = 0; $i -lt 150; $i++) {
  Start-Sleep -Seconds 2
  $lines = & $adb devices
  $serial = ($lines | Select-String '^(emulator-\d+)\s+device$' | ForEach-Object { $_.Matches[0].Groups[1].Value } | Select-Object -First 1)
  if ($serial) {
    $boot = & $adb -s $serial shell getprop sys.boot_completed 2>$null
    if ($boot -match '1') {
      Write-Host "Ready: $serial"
      & $adb devices -l
      exit 0
    }
  }
  Write-Host "Waiting for emulator boot... ($i)"
}

Write-Error "Emulator did not become ready in time. Open Android Studio > Device Manager and cold boot Pixel_7."

$ErrorActionPreference = 'Stop'

$adbCommand = Get-Command adb -ErrorAction Stop
$deviceLines = & $adbCommand.Source devices
$connected = $deviceLines | Select-Object -Skip 1 | Where-Object {
  $_ -match '^\S+\s+device(?:\s|$)'
}
$wifiDevices = $connected | Where-Object {
  $_ -match '^\S+:\d+\s+device(?:\s|$)' -or $_ -match '_adb-tls-connect\._tcp\s+device(?:\s|$)'
}

$serial = $env:ANDROID_SERIAL
if ($serial) {
  $isConnected = $connected | Where-Object { $_ -match "^$([regex]::Escape($serial))\s+device(?:\s|$)" }
  $isWifi = $wifiDevices | Where-Object { $_ -match "^$([regex]::Escape($serial))\s+device(?:\s|$)" }
  if (-not $isConnected -or -not $isWifi) {
    throw "ANDROID_SERIAL '$serial' is not a connected Wi-Fi ADB device."
  }
} elseif ($wifiDevices.Count -eq 1) {
  $serial = ($wifiDevices[0] -split '\s+')[0]
} elseif ($wifiDevices.Count -gt 1) {
  throw 'Multiple Wi-Fi ADB devices are connected. Set ANDROID_SERIAL to the device serial and retry.'
} else {
  throw 'No Wi-Fi ADB device is connected. Pair and connect the phone with adb, then retry.'
}

$env:ANDROID_SERIAL = $serial
$androidDirectory = Join-Path $PSScriptRoot '..\android'
Push-Location $androidDirectory
try {
  & .\gradlew.bat app:installDebug
  if ($LASTEXITCODE -ne 0) {
    throw "Gradle failed to build or install the debug app (exit code $LASTEXITCODE)."
  }

  & $adbCommand.Source -s $serial reverse tcp:8081 tcp:8081
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to forward the Metro development server to the Wi-Fi device (exit code $LASTEXITCODE)."
  }

  & $adbCommand.Source -s $serial reverse tcp:8082 tcp:8081
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to forward the saved Metro port to the development server (exit code $LASTEXITCODE)."
  }
} finally {
  Pop-Location
}

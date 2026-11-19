# =============================================================================
# Gravity Hub Service Admin — ऐप ठीक करके चलाने का स्क्रिप्ट
# =============================================================================
# इस फाइल को राइट-क्लिक करें → "Run with PowerShell"
# या टर्मिनल में: powershell -ExecutionPolicy Bypass -File FIX_AND_RUN.ps1
# =============================================================================

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Gravity Hub Service Admin — App Fix" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$appDir = "e:/energy_Service_Apps/Service_admin_App"
Set-Location $appDir

Write-Host "[1/5] बिल्ड कैश साफ कर रहा हूं..." -ForegroundColor Yellow
Remove-Item -Recurse -Force "$appDir/android/app/build" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$appDir/android/.gradle" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$appDir/node_modules/.cache" -ErrorAction SilentlyContinue
Write-Host "    कैश साफ हो गया।" -ForegroundColor Green

Write-Host ""
Write-Host "[2/5] नोड मॉड्यूल्स इंस्टॉल कर रहा हूं..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "    npm install फेल हुआ!" -ForegroundColor Red
    exit 1
}
Write-Host "    नोड मॉड्यूल्स इंस्टॉल हो गए।" -ForegroundColor Green

Write-Host ""
Write-Host "[3/5] एंड्रॉइड प्रोजेक्ट साफ कर रहा हूं..." -ForegroundColor Yellow
cd android
.\gradlew.bat clean
if ($LASTEXITCODE -ne 0) {
    Write-Host "    ग्रैडल क्लीन फेल हुआ!" -ForegroundColor Red
    exit 1
}
cd ..
Write-Host "    एंड्रॉइड प्रोजेक्ट साफ हो गया।" -ForegroundColor Green

Write-Host ""
Write-Host "[4/5] ऐप एम्युलेटर पर इंस्टॉल कर रहा हूं..." -ForegroundColor Yellow
Write-Host "    सुनिश्चित करें कि एम्युलेटर चालू है (adb devices चेक करें)" -ForegroundColor Cyan
npx react-native run-android
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "    बिल्ड फेल हुआ। नीचे दिए गए स्टेप्स ट्राई करें:" -ForegroundColor Red
    Write-Host "      1. एम्युलेटर चालू है कि नहीं चेक करें: adb devices" -ForegroundColor Cyan
    Write-Host "      2. मेट्रो बंडलर रीस्टार्ट करें: npx react-native start --reset-cache" -ForegroundColor Cyan
    Write-Host "      3. फिर से इस स्क्रिप्ट को चलाएं" -ForegroundColor Cyan
    exit 1
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  ऐप सफलतापूर्वक इंस्टॉल हो गया!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green

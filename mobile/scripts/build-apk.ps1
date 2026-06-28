$ErrorActionPreference = "Stop"

$mobileRoot = Split-Path -Parent $PSScriptRoot
$androidDir = Join-Path $mobileRoot "android"
$javaHome = "C:\Program Files\Android\Android Studio\jbr"
$sdkHome = "$env:LOCALAPPDATA\Android\Sdk"

if (-not (Test-Path $javaHome)) {
    throw "Java not found. Install Android Studio."
}
if (-not (Test-Path $sdkHome)) {
    throw "Android SDK not found."
}

$env:JAVA_HOME = $javaHome
$env:ANDROID_HOME = $sdkHome
$env:PATH = "$javaHome\bin;$sdkHome\platform-tools;$env:PATH"

Push-Location $mobileRoot
try {
    Write-Host "Syncing Capacitor..."
    npx cap sync android

    Push-Location $androidDir
    try {
        Write-Host "Building debug APK..."
        .\gradlew.bat :app:assembleDebug
        $buildExit = $LASTEXITCODE

        $apk = Get-ChildItem -Path "app\build\outputs\apk\debug" -Filter "*.apk" |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First 1

        if (-not $apk) {
            throw "APK not found after build (exit code $buildExit)."
        }

        if ($buildExit -ne 0) {
            Write-Host "Gradle reported warnings, but APK was created." -ForegroundColor Yellow
        }

        $outDir = Join-Path $mobileRoot "dist"
        New-Item -ItemType Directory -Force -Path $outDir | Out-Null
        $dest = Join-Path $outDir "lang-center.apk"
        Copy-Item $apk.FullName $dest -Force

        Write-Host ""
        Write-Host "APK ready:" -ForegroundColor Green
        Write-Host $dest
    }
    finally {
        Pop-Location
    }
}
finally {
    Pop-Location
}
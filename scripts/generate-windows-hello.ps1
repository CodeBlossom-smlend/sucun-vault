$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$output = Join-Path $projectRoot 'windows-generated'
$cli = Join-Path $projectRoot 'node_modules\.bin\dynwinrt-codegen.cmd'

if (-not (Test-Path $cli)) {
    throw '@microsoft/dynwinrt-codegen is missing. Run npm install on Windows.'
}

$windowsWinmd = Get-ChildItem 'C:\Program Files (x86)\Windows Kits\10\UnionMetadata' -Filter Windows.winmd -Recurse -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending |
    Select-Object -First 1 -ExpandProperty FullName
if (-not $windowsWinmd) {
    throw 'Windows.winmd was not found. Install the Windows 10/11 SDK.'
}

$win32Winmd = $env:DYNWINRT_WIN32_WINMD
if (-not $win32Winmd -or -not (Test-Path $win32Winmd)) {
    $nugetRoot = Join-Path $env:USERPROFILE '.nuget\packages\microsoft.windows.sdk.win32metadata'
    $win32Winmd = Get-ChildItem $nugetRoot -Filter Windows.Win32.winmd -Recurse -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending |
        Select-Object -First 1 -ExpandProperty FullName
}
if (-not $win32Winmd) {
    throw 'Windows.Win32.winmd was not found. Install Microsoft.Windows.SDK.Win32Metadata with NuGet or set DYNWINRT_WIN32_WINMD.'
}

if (Test-Path $output) { Remove-Item $output -Recurse -Force }

& $cli generate --winmd $windowsWinmd --namespace Windows.Security.Credentials.UI --class-name UserConsentVerifier --output $output
if ($LASTEXITCODE -ne 0) { throw 'WinRT binding generation failed.' }

& $cli generate --winmd $win32Winmd --ref $windowsWinmd --class-name Windows.Win32.System.WinRT.IUserConsentVerifierInterop --output $output
if ($LASTEXITCODE -ne 0) { throw 'COM binding generation failed.' }

Write-Host "Windows Hello bindings generated in $output"

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
& (Join-Path $Root "scripts\bootstrap.ps1")

$CpaExe = Join-Path $Root "runtime\cpa\cli-proxy-api.exe"
$CpampExe = Join-Path $Root "runtime\cpamp\cpa-manager-plus_v1.11.2_windows_amd64\cpa-manager-plus.exe"
if (-not (Get-Process cli-proxy-api -ErrorAction SilentlyContinue)) {
    Start-Process -FilePath $CpaExe -ArgumentList @("-config", (Join-Path $Root "cpa-config.yaml")) -WorkingDirectory $Root -WindowStyle Hidden
}
if (-not (Get-Process cpa-manager-plus -ErrorAction SilentlyContinue)) {
    Start-Process -FilePath $CpampExe -WorkingDirectory (Split-Path $CpampExe) -WindowStyle Hidden
}
Write-Host "CLIProxyAPI:  http://127.0.0.1:8317/v1"
Write-Host "CPA Manager: http://127.0.0.1:18317/management.html"

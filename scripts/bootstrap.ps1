$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Runtime = Join-Path $Root "runtime"
$CpaZip = Join-Path $Runtime "cpa.zip"
$CpampZip = Join-Path $Runtime "cpamp.zip"
$CpaExe = Join-Path $Runtime "cpa\cli-proxy-api.exe"
$CpampDir = Join-Path $Runtime "cpamp\cpa-manager-plus_v1.11.2_windows_amd64"
$CpampExe = Join-Path $CpampDir "cpa-manager-plus.exe"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js 20+ is required" }
New-Item -ItemType Directory -Force -Path $Runtime, (Join-Path $Root ".local"), (Join-Path $Root "auths"), (Join-Path $Root "logs"), (Join-Path $Root "manager-data") | Out-Null

function Get-VerifiedArchive([string]$Url, [string]$Path, [string]$Sha256) {
    & node (Join-Path $Root "scripts\download.mjs") $Url $Path $Sha256
    if ($LASTEXITCODE -ne 0) { throw "Download or SHA256 verification failed: $Url" }
}

if (-not (Test-Path -LiteralPath $CpaExe)) {
    Get-VerifiedArchive "https://github.com/router-for-me/CLIProxyAPI/releases/download/v7.2.80/CLIProxyAPI_7.2.80_windows_amd64.zip" $CpaZip "A8E1A805BAE83150D2E1C7E25B4C22714461D4536173F0BD93BE8BBC1333BE4C"
    Expand-Archive -LiteralPath $CpaZip -DestinationPath (Join-Path $Runtime "cpa") -Force
}
if (-not (Test-Path -LiteralPath $CpampExe)) {
    Get-VerifiedArchive "https://github.com/seakee/CPA-Manager-Plus/releases/download/v1.11.2/cpa-manager-plus_v1.11.2_windows_amd64.zip" $CpampZip "35931D7EF81399E40D9D9FED0852EF336C2B6BEEEC7C186570807C08C2A133E0"
    Expand-Archive -LiteralPath $CpampZip -DestinationPath (Join-Path $Runtime "cpamp") -Force
}

$EncryptedBundle = Join-Path $Root "secrets.enc"
$LocalSecrets = Join-Path $Root ".local\secrets.json"
$LocalBundleHash = Join-Path $Root ".local\secrets.sha256"
if (-not (Test-Path -LiteralPath $EncryptedBundle)) { throw "secrets.enc not found" }
$BundleHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $EncryptedBundle).Hash
$SavedBundleHash = if (Test-Path -LiteralPath $LocalBundleHash) { (Get-Content -Raw -LiteralPath $LocalBundleHash).Trim() } else { "" }
$SecretsNeedRefresh = -not (Test-Path -LiteralPath $LocalSecrets) -or $SavedBundleHash -ne $BundleHash
if ($SecretsNeedRefresh) {
    $PasswordWasProvided = -not [string]::IsNullOrWhiteSpace($env:CPA_BUNDLE_PASSWORD)
    $Bstr = [IntPtr]::Zero
    try {
        if (-not $PasswordWasProvided) {
            $Secure = Read-Host "Encrypted bundle password" -AsSecureString
            $Bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
            $env:CPA_BUNDLE_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Bstr)
        }
        & node (Join-Path $Root "scripts\secrets.mjs") decrypt secrets.enc .local/secrets.json
        if ($LASTEXITCODE -ne 0) { throw "Secret decryption failed" }
        [IO.File]::WriteAllText($LocalBundleHash, $BundleHash, [Text.UTF8Encoding]::new($false))
    } finally {
        if (-not $PasswordWasProvided) { Remove-Item Env:CPA_BUNDLE_PASSWORD -ErrorAction SilentlyContinue }
        if ($Bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Bstr) }
    }
}

& node (Join-Path $Root "scripts\configure.mjs")
if ($LASTEXITCODE -ne 0) { throw "Configuration generation failed" }
$env:CPA_IMPORT_DIR = Join-Path $Root ".local\imports"
& node (Join-Path $Root "import-sub2api.mjs")
Remove-Item Env:CPA_IMPORT_DIR -ErrorAction SilentlyContinue
if ($LASTEXITCODE -ne 0) { throw "Account import failed" }

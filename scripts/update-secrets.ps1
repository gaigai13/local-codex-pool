$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Secure = Read-Host "New encrypted bundle password" -AsSecureString
$Confirm = Read-Host "Repeat password" -AsSecureString
$Bstr1 = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
$Bstr2 = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Confirm)
try {
    $Plain1 = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Bstr1)
    $Plain2 = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Bstr2)
    if ($Plain1 -ne $Plain2 -or $Plain1.Length -lt 12) { throw "Passwords differ or are shorter than 12 characters" }
    $env:CPA_BUNDLE_PASSWORD = $Plain1
    & node (Join-Path $Root "scripts\secrets.mjs") encrypt secrets.enc
    if ($LASTEXITCODE -ne 0) { throw "Encryption failed" }
} finally {
    Remove-Item Env:CPA_BUNDLE_PASSWORD -ErrorAction SilentlyContinue
    if ($Bstr1 -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Bstr1) }
    if ($Bstr2 -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Bstr2) }
    $Plain1 = $null
    $Plain2 = $null
}

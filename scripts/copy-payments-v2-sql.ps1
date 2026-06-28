Get-Content "$PSScriptRoot\..\supabase\PAYMENTS_V2_CLEAN.sql" -Raw | Set-Clipboard
Write-Host "PAYMENTS_V2_CLEAN.sql copied to clipboard. Paste in Supabase SQL Editor."
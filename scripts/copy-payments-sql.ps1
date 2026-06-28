Get-Content "$PSScriptRoot\..\supabase\PAYMENTS.sql" -Raw | Set-Clipboard
Write-Host "PAYMENTS.sql copied to clipboard. Paste in Supabase SQL Editor."
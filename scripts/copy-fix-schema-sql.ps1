Get-Content "$PSScriptRoot\..\supabase\FIX_SCHEMA_CLEAN.sql" -Raw | Set-Clipboard
Write-Host "FIX_SCHEMA_CLEAN.sql copied to clipboard. Paste in Supabase SQL Editor."
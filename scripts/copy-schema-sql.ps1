$sql = Get-Content (Join-Path $PSScriptRoot "..\supabase\schema.sql") -Raw -Encoding UTF8
Set-Clipboard -Value $sql
Write-Host "schema.sql copied to clipboard"
Write-Host "Supabase SQL Editor -> Ctrl+V -> Run"
Start-Process "https://supabase.com/dashboard/project/axbzqkikujwggoequegt/sql/new"

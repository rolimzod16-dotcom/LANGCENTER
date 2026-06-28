$sql = Get-Content (Join-Path $PSScriptRoot "..\supabase\TEACHERS.sql") -Raw -Encoding UTF8
Set-Clipboard -Value $sql
Write-Host "TEACHERS.sql copied to clipboard!"
Write-Host "Delete ALL in SQL Editor -> Ctrl+V -> Run"
Start-Process "https://supabase.com/dashboard/project/wtxgeekgkvwlkfxkxqew/sql/new"
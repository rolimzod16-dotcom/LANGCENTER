$sql = "ALTER TABLE students ADD COLUMN IF NOT EXISTS password_hash TEXT;"
Set-Clipboard -Value $sql
Write-Host "ONLY this line copied:"
Write-Host $sql
Write-Host ""
Write-Host "Supabase SQL Editor -> delete ALL text -> Ctrl+V -> Run"
Start-Process "https://supabase.com/dashboard/project/wtxgeekgkvwlkfxkxqew/sql/new"
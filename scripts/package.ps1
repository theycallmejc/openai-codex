$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root 'dist'
$archive = Join-Path $out 'automated-sdlc-qa-source.zip'
$stage = Join-Path ([IO.Path]::GetTempPath()) ("sdlc-package-" + [guid]::NewGuid())
New-Item -ItemType Directory -Force $out | Out-Null
if (Test-Path $archive) { Remove-Item -LiteralPath $archive -Force }
$paths = @('backend','frontend','postman','sample-data','scripts','.github','README.md','ARCHITECTURE.md','FIELD-MAPPING.md','PLAN.md','PROMPTS.md','SECURITY.md','Dockerfile','docker-compose.yml','.gitignore','.dockerignore') | ForEach-Object { Join-Path $root $_ } | Where-Object { Test-Path $_ }
New-Item -ItemType Directory -Force $stage | Out-Null
foreach ($path in $paths) {
  if ((Get-Item $path) -is [IO.DirectoryInfo]) { $files = Get-ChildItem -LiteralPath $path -Recurse -File } else { $files = Get-Item $path }
  foreach ($file in $files) {
    $relative = $file.FullName.Substring($root.Length).TrimStart('\')
    if ($relative -match '(^|\\)(__pycache__|\.pytest_cache|\.venv|venv)(\\|$)|\.(pyc|db|sqlite|zip)$') { continue }
    $destination = Join-Path $stage $relative
    New-Item -ItemType Directory -Force (Split-Path $destination) | Out-Null
    Copy-Item -LiteralPath $file.FullName -Destination $destination
  }
}
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $archive -CompressionLevel Optimal
Remove-Item -LiteralPath $stage -Recurse -Force
$zip = Get-Item $archive
if ($zip.Length -gt 150MB) { throw 'Source archive exceeds 150 MB.' }
$entries = [IO.Compression.ZipFile]::OpenRead($archive).Entries.FullName.Replace('\','/')
foreach ($required in @('backend/src/main.py','frontend/index.html','README.md')) { if ($entries -notcontains $required) { throw "Missing required archive entry: $required" } }
Write-Output "Created $archive ($($zip.Length) bytes)"

# Builds dist/bridge-table.html: the whole game in one file (CSS and scripts inlined).
# That single file runs offline in any browser: double-click it on the PC, or copy it to the phone and open it there.
# Run:  powershell -ExecutionPolicy Bypass -File build.ps1
$root = $PSScriptRoot
$utf8 = New-Object System.Text.UTF8Encoding $false
$html = [IO.File]::ReadAllText("$root\index.html", $utf8)

$css = [IO.File]::ReadAllText("$root\css\style.css", $utf8)
$html = $html.Replace('<link rel="stylesheet" href="css/style.css">', "<style>`n$css`n</style>")

foreach ($m in [regex]::Matches($html, '<script src="(js/[^"]+)"></script>')) {
  $js = [IO.File]::ReadAllText("$root\" + $m.Groups[1].Value.Replace('/', '\'), $utf8)
  $html = $html.Replace($m.Value, "<script>`n$js`n</script>")
}

$icon = [Convert]::ToBase64String([IO.File]::ReadAllBytes("$root\icons\icon-192.png"))
$html = $html.Replace('<link rel="manifest" href="manifest.webmanifest">', '')
$html = $html.Replace('href="icons/icon-192.png"', "href=""data:image/png;base64,$icon""")

New-Item -ItemType Directory -Force "$root\dist" | Out-Null
[IO.File]::WriteAllText("$root\dist\bridge-table.html", "<!doctype html>`n" + $html, $utf8)
Write-Host "Built dist\bridge-table.html"

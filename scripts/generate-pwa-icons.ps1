Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = "Stop"

$source = "public/skynova-light.png"
if (-not (Test-Path $source)) {
  throw "Source logo not found: $source"
}

function New-PwaIcon {
  param(
    [string]$OutputPath,
    [int]$Size,
    [string]$BackgroundColor = "#FFFFFF"
  )

  $bitmap = New-Object System.Drawing.Bitmap($Size, $Size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml($BackgroundColor))
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  $logo = [System.Drawing.Image]::FromFile((Resolve-Path $source))

  $targetWidth = [int]($Size * 0.82)
  $ratio = $logo.Height / $logo.Width
  $targetHeight = [int]($targetWidth * $ratio)

  if ($targetHeight -gt [int]($Size * 0.52)) {
    $targetHeight = [int]($Size * 0.52)
    $targetWidth = [int]($targetHeight / $ratio)
  }

  $x = [int](($Size - $targetWidth) / 2)
  $y = [int](($Size - $targetHeight) / 2)
  $graphics.DrawImage($logo, $x, $y, $targetWidth, $targetHeight)

  $dir = Split-Path $OutputPath -Parent
  if (-not (Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir | Out-Null
  }

  $fullOutput = Join-Path (Resolve-Path $dir) (Split-Path $OutputPath -Leaf)
  $bitmap.Save($fullOutput, [System.Drawing.Imaging.ImageFormat]::Png)

  $logo.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

New-PwaIcon -OutputPath "public/icons/icon-192x192.png" -Size 192
New-PwaIcon -OutputPath "public/icons/icon-512x512.png" -Size 512
New-PwaIcon -OutputPath "public/icons/apple-touch-icon.png" -Size 180

Write-Output "PWA icons generated from $source"
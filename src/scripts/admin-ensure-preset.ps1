# --- CONFIG ---
$base        = "http://localhost:3000"
$tenant      = "bn9"
$email       = "root@bn9.local"
$password    = "bn9@12345"

# preset ที่ต้องการให้มี/ใช้งาน
$presetName  = "Ploy Friendly v1"
$model       = "gpt-4o-mini"
$systemPrompt= "You are P'Ploy, friendly and helpful assistant..."
$temperature = 0.6
$topP        = 1
$maxTokens   = 800

# ถ้าต้องการ override ที่บอท (หลังผูก preset แล้ว)
$botOverrides = @{
  #temperature = 0.7
  maxTokens   = 1200
}

function J($o){ $o | ConvertTo-Json -Depth 6 }
function Ok($m){ Write-Host $m -ForegroundColor Green }
function Info($m){ Write-Host $m -ForegroundColor Yellow }
function Err($m){ Write-Host $m -ForegroundColor Red }

try {
  # 1) LOGIN
  $loginBody = @{ email=$email; password=$password } | J
  $login = Invoke-RestMethod -Method Post "$base/api/auth/login" -Body $loginBody -ContentType "application/json"
  if(-not $login.ok){ throw "Login failed: $(J $login)" }
  $token = $login.token
  $h = @{
    Authorization = "Bearer $token"
    "x-tenant"    = $tenant
    "Content-Type"= "application/json"
  }
  Ok "✓ Login OK"

  # 2) PICK BOT
  $bots = Invoke-RestMethod "$base/api/admin/bots" -Headers $h
  if(-not $bots.ok -or $bots.items.Count -eq 0){ throw "No bots found" }
  $bot = $bots.items | Where-Object { $_.name -eq "admin-bot-001" } | Select-Object -First 1
  if(-not $bot){ $bot = $bots.items[0] }
  $botId = $bot.id
  Info "Using bot: $($bot.name) ($botId)"

  # 3) ENSURE PRESET (create-if-missing; reuse-if-exists)
  $presetId = $null
  try {
    $presetBody = @{
      name         = $presetName
      model        = $model
      temperature  = $temperature
      topP         = $topP
      maxTokens    = $maxTokens
      systemPrompt = $systemPrompt
    } | J

    $created = Invoke-RestMethod -Method Post "$base/api/admin/ai/presets" -Headers $h -Body $presetBody
    if($created.ok){
      $presetId = $created.item.id
      if($created.existed){ Info "→ Preset existed; reusing id: $presetId" } else { Ok "✓ Preset created: $presetId" }
    } else { throw "Preset create returned not ok" }
  } catch {
    # กันชนชื่อซ้ำ/สร้างไม่ผ่าน → ค้นหาด้วยชื่อ
    $list = Invoke-RestMethod "$base/api/admin/ai/presets" -Headers $h
    $found = $list.items | Where-Object { $_.name -eq $presetName } | Select-Object -First 1
    if(-not $found){ throw "Preset not found and cannot create" }
    $presetId = $found.id
    Info "→ Found preset id: $presetId"
  }

  # 4) APPLY PRESET TO BOT (+ optional overrides)
  $payload = @{ presetId = $presetId }
  if($botOverrides.Keys.Count -gt 0){
    $botOverrides.GetEnumerator() | ForEach-Object { $payload[$_.Key] = $_.Value }
    Info "Applying preset with overrides: $(J $botOverrides)"
  }
  $res = Invoke-RestMethod -Method Put "$base/api/admin/bots/$botId/config" -Headers $h -Body (J $payload)
  if(-not $res.ok){ throw "update config not ok: $(J $res)" }
  Ok "✓ Bot config updated"

  # 5) VERIFY
  $cfg = Invoke-RestMethod "$base/api/admin/bots/$botId/config" -Headers $h
  $show = [pscustomobject]@{
    botId       = $botId
    presetId    = $cfg.config.presetId
    openaiModel = $cfg.config.openaiModel
    temperature = $cfg.config.temperature
    topP        = $cfg.config.topP
    maxTokens   = $cfg.config.maxTokens
    updatedAt   = $cfg.config.updatedAt
  }
  Ok "✓ Result:"
  $show
}
catch { Err "✗ Flow error: $_" }

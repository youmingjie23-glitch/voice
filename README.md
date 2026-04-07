# Render YouTube Cookies Bot

這份專案給 Render Web Service 使用，透過 `yt-dlp` + YouTube cookies 來提高 YouTube 播放成功率。

## 指令
- `!play YouTube連結`
- `!stop`
- `!leave`
- `!help`

## 重點
- **不要**把 `cookies.txt` 或真的 `.env` 推到 GitHub。
- 建議把 cookies 轉成 Base64，放到 Render 的 `YTDLP_COOKIES_B64` 環境變數。
- 這能提高成功率，但**仍不保證永久穩定**；cookies 可能失效，需要重匯出。

## 本機測試
```bash
npm install
cp .env.example .env
# 把 DISCORD_TOKEN 改成你的新 token
# 把 YTDLP_COOKIES_B64 改成你的 cookies.txt 的 base64
npm start
```

## 在 Windows 把 cookies.txt 轉成 Base64
PowerShell:
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("cookies.txt")) | Set-Clipboard
```

## 在 macOS / Linux 把 cookies.txt 轉成 Base64
```bash
base64 cookies.txt | tr -d '\n'
```

## Render 設定
Environment Variables:
- `DISCORD_TOKEN`
- `PREFIX`（可選）
- `YTDLP_COOKIES_B64`
- `YTDLP_PROXY`（可選）

Health Check Path:
- `/health`

## 權限
Bot 至少要有：
- View Channels
- Send Messages
- Read Message History
- Connect
- Speak

另外在 Discord Developer Portal 要開：
- MESSAGE CONTENT INTENT

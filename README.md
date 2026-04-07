# Render Music Bot

這份專案是給 Render 免費 Web Service 用的低 RAM Discord 音樂 bot。

## 指令
- `!play YouTube連結`
- `!stop`
- `!leave`
- `!help`

## 本機測試
```bash
npm install
cp .env.example .env
# 把 .env 裡的 DISCORD_TOKEN 換成你的新 token
npm start
```

## GitHub → Render
1. 上傳整個專案到 GitHub。
2. 到 Render 建立 **Web Service**。
3. 連接你的 GitHub repo。
4. Build Command 填 `npm install`
5. Start Command 填 `npm start`
6. 在 Render 的 Environment 加入：
   - `DISCORD_TOKEN` = 你的新 token
   - `PREFIX` = `!`（可選）
7. 部署完成後，拿到 Render 網址。
8. 用 UptimeRobot 定時打 `https://你的網址/health`

## 權限
Bot 至少要有：
- View Channels
- Send Messages
- Read Message History
- Connect
- Speak

另外在 Discord Developer Portal 要開：
- MESSAGE CONTENT INTENT
- SERVER MEMBERS INTENT 不一定需要

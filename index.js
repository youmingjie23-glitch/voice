require("dotenv").config();

const fs = require("fs");
const os = require("os");
const path = require("path");
const express = require("express");
const prism = require("prism-media");
const ffmpegPath = require("ffmpeg-static");
const youtubedl = require("youtube-dl-exec");
const { Client, GatewayIntentBits } = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  getVoiceConnection,
} = require("@discordjs/voice");

const app = express();
const PORT = process.env.PORT || 3000;
const PREFIX = process.env.PREFIX || "!";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const guildState = new Map();
let cookiesFilePath = process.env.YTDLP_COOKIES_FILE || null;

function ensureCookiesFile() {
  if (cookiesFilePath && fs.existsSync(cookiesFilePath)) {
    return cookiesFilePath;
  }

  const b64 = process.env.YTDLP_COOKIES_B64;
  if (!b64) return null;

  try {
    const decoded = Buffer.from(b64, "base64").toString("utf8");
    const tempPath = path.join(os.tmpdir(), "youtube-cookies.txt");
    fs.writeFileSync(tempPath, decoded, "utf8");
    cookiesFilePath = tempPath;
    return cookiesFilePath;
  } catch (err) {
    console.error("Failed to decode cookies:", err);
    return null;
  }
}

function getYtDlpArgs() {
  const args = {
    noPlaylist: true,
    noWarnings: true,
    addHeader: [
      "referer:youtube.com",
      "user-agent:Mozilla/5.0",
    ],
  };

  const cookiePath = ensureCookiesFile();
  if (cookiePath) {
    args.cookies = cookiePath;
  }

  if (process.env.YTDLP_PROXY) {
    args.proxy = process.env.YTDLP_PROXY;
  }

  return args;
}

async function getVideoInfo(url) {
  const args = {
    ...getYtDlpArgs(),
    dumpSingleJson: true,
    skipDownload: true,
  };

  return await youtubedl(url, args);
}

async function getAudioUrl(url) {
  const formatCandidates = [
    "bestaudio",
    "bestaudio/best",
    "best[acodec!=none]/best",
    "best",
  ];

  for (const fmt of formatCandidates) {
    try {
      const args = {
        ...getYtDlpArgs(),
        getUrl: true,
        format: fmt,
      };

      const output = await youtubedl(url, args);
      const lines = String(output)
        .split(/\r?\n/)
        .map(v => v.trim())
        .filter(Boolean);

      if (lines.length) {
        console.log(`Using format: ${fmt}`);
        return lines[0];
      }
    } catch (err) {
      console.error(`getAudioUrl failed with format ${fmt}:`, err?.message || err);
    }
  }

  throw new Error("找不到可播放的影片/音訊格式");
}

function createAudioStream(url) {
  const args = [
    "-reconnect", "1",
    "-reconnect_streamed", "1",
    "-reconnect_delay_max", "5",
    "-i", url,
    "-analyzeduration", "0",
    "-loglevel", "0",
    "-f", "s16le",
    "-ar", "48000",
    "-ac", "2",
  ];

  return new prism.FFmpeg({
    args,
    shell: false,
    ffmpegPath,
  });
}

app.get("/", (req, res) => {
  res.send("Render YouTube cookies bot is running.");
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    botReady: client.isReady(),
    uptimeSeconds: Math.floor(process.uptime()),
    hasCookies: Boolean(ensureCookiesFile()),
    time: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`Cookies loaded: ${Boolean(ensureCookiesFile())}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = (args.shift() || "").toLowerCase();

  try {
    if (command === "play") {
      await handlePlay(message, args);
    } else if (command === "stop") {
      handleStop(message);
    } else if (command === "leave") {
      handleLeave(message);
    } else if (command === "help") {
      handleHelp(message);
    }
  } catch (error) {
    console.error("Command error:", error);
    const reason = error?.message ? `\n原因：${error.message}` : "";
    message.reply(`❌ 執行指令時發生錯誤。${reason}`);
  }
});

async function handlePlay(message, args) {
  const voiceChannel = message.member?.voice?.channel;
  if (!voiceChannel) {
    return message.reply("❌ 你要先進入語音頻道。");
  }

  const input = args[0];
  if (!input) {
    return message.reply(`❌ 請輸入 ${PREFIX}play YouTube連結`);
  }

  if (!/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(input)) {
    return message.reply("❌ 這版只支援 YouTube 連結。");
  }

  if (!ensureCookiesFile()) {
    return message.reply("❌ 尚未設定 YouTube cookies。請先在 Render 加入 YTDLP_COOKIES_B64。");
  }

  let state = guildState.get(message.guild.id);

  if (!state) {
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator,
      selfDeaf: true,
    });

    const player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Stop,
      },
    });

    connection.subscribe(player);

    state = {
      connection,
      player,
      textChannelId: message.channel.id,
      currentTitle: null,
    };

    player.on(AudioPlayerStatus.Idle, async () => {
      const textChannel = await client.channels.fetch(state.textChannelId).catch(() => null);
      if (textChannel && textChannel.isTextBased()) {
        textChannel.send("⏹️ 播放結束，已離開語音頻道。").catch(() => {});
      }
      cleanupGuild(message.guild.id);
    });

    player.on("error", async (error) => {
      console.error("Player error:", error);
      const textChannel = await client.channels.fetch(state.textChannelId).catch(() => null);
      if (textChannel && textChannel.isTextBased()) {
        textChannel.send("❌ 播放失敗，可能是 cookies 失效、連結受限，或 YouTube 再次驗證。").catch(() => {});
      }
      cleanupGuild(message.guild.id);
    });

    guildState.set(message.guild.id, state);
  }

  state.textChannelId = message.channel.id;

  let info = { title: "未知標題" };

  try {
    info = await getVideoInfo(input);
  } catch (err) {
    console.error("getVideoInfo failed:", err?.message || err);
  }

  const streamUrl = await getAudioUrl(input);

  const transcoder = createAudioStream(streamUrl);
  const resource = createAudioResource(transcoder, {
    inputType: StreamType.Raw,
    inlineVolume: false,
  });

  state.currentTitle = info.title || "未知標題";
  state.player.play(resource);

  message.channel.send(`▶️ 開始播放：**${state.currentTitle}**`);
}

function handleStop(message) {
  const state = guildState.get(message.guild.id);
  if (!state) {
    return message.reply("❌ 目前沒有播放中的音樂。");
  }

  state.player.stop(true);
  cleanupGuild(message.guild.id);
  message.channel.send("⏹️ 已停止播放。");
}

function handleLeave(message) {
  const state = guildState.get(message.guild.id);
  if (!state) {
    return message.reply("❌ 我目前不在語音頻道。");
  }

  cleanupGuild(message.guild.id);
  message.channel.send("👋 已離開語音頻道。");
}

function handleHelp(message) {
  message.channel.send(
    [
      "可用指令：",
      `\`${PREFIX}play YouTube連結\` 播放 YouTube 連結（需 cookies）`,
      `\`${PREFIX}stop\` 停止播放`,
      `\`${PREFIX}leave\` 離開語音頻道`,
      `\`${PREFIX}help\` 查看指令`,
    ].join("\n")
  );
}

function cleanupGuild(guildId) {
  const state = guildState.get(guildId);
  if (!state) return;

  try {
    state.player.stop();
  } catch (_) {}

  try {
    state.connection.destroy();
  } catch (_) {}

  const existing = getVoiceConnection(guildId);
  if (existing) {
    try {
      existing.destroy();
    } catch (_) {}
  }

  guildState.delete(guildId);
}

client.login(process.env.DISCORD_TOKEN);

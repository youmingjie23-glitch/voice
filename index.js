require("dotenv").config();

const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  getVoiceConnection,
} = require("@discordjs/voice");
const play = require("play-dl");

const app = express();
const PORT = process.env.PORT || 3000;
const PREFIX = process.env.PREFIX || "!";

app.get("/", (req, res) => {
  res.send("Discord music bot is running.");
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    botReady: client.isReady(),
    uptimeSeconds: Math.floor(process.uptime()),
    time: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const state = new Map();
// state per guild:
// {
//   connection,
//   player,
//   currentUrl,
//   textChannelId,
//   voiceChannelId
// }

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
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
    message.reply("❌ 執行指令時發生錯誤。");
  }
});

async function handlePlay(message, args) {
  const voiceChannel = message.member?.voice?.channel;
  if (!voiceChannel) {
    return message.reply("❌ 你要先進入語音頻道。");
  }

  const query = args[0];
  if (!query) {
    return message.reply(`❌ 請輸入 ${PREFIX}play YouTube連結`);
  }

  if (!(play.yt_validate(query) === "video" || query.includes("youtu"))) {
    return message.reply("❌ 低 RAM 版本只支援貼 YouTube 連結。");
  }

  let guildState = state.get(message.guild.id);

  if (!guildState) {
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

    guildState = {
      connection,
      player,
      currentUrl: null,
      textChannelId: message.channel.id,
      voiceChannelId: voiceChannel.id,
    };

    player.on(AudioPlayerStatus.Idle, async () => {
      const textChannel = await client.channels.fetch(guildState.textChannelId).catch(() => null);
      if (textChannel && textChannel.isTextBased()) {
        textChannel.send("⏹️ 播放結束，已離開語音頻道。").catch(() => {});
      }
      cleanupGuild(message.guild.id);
    });

    player.on("error", async (error) => {
      console.error("Player error:", error);
      const textChannel = await client.channels.fetch(guildState.textChannelId).catch(() => null);
      if (textChannel && textChannel.isTextBased()) {
        textChannel.send("❌ 播放失敗，可能是 YouTube 限制或串流中斷。").catch(() => {});
      }
      cleanupGuild(message.guild.id);
    });

    state.set(message.guild.id, guildState);
  }

  guildState.textChannelId = message.channel.id;
  guildState.voiceChannelId = voiceChannel.id;
  guildState.currentUrl = query;

  const stream = await play.stream(query, {
    discordPlayerCompatibility: true,
  });

  const resource = createAudioResource(stream.stream, {
    inputType: stream.type,
    inlineVolume: false,
  });

  guildState.player.play(resource);
  message.channel.send("▶️ 開始播放。");
}

function handleStop(message) {
  const guildState = state.get(message.guild.id);
  if (!guildState) {
    return message.reply("❌ 目前沒有播放中的音樂。");
  }

  guildState.player.stop(true);
  cleanupGuild(message.guild.id);
  message.channel.send("⏹️ 已停止播放。");
}

function handleLeave(message) {
  const guildState = state.get(message.guild.id);
  if (!guildState) {
    return message.reply("❌ 我目前不在語音頻道。");
  }

  cleanupGuild(message.guild.id);
  message.channel.send("👋 已離開語音頻道。");
}

function handleHelp(message) {
  message.channel.send(
    [
      "可用指令：",
      `\`${PREFIX}play YouTube連結\` 播放 YouTube 連結`,
      `\`${PREFIX}stop\` 停止播放`,
      `\`${PREFIX}leave\` 離開語音頻道`,
      `\`${PREFIX}help\` 查看指令`,
    ].join("\n")
  );
}

function cleanupGuild(guildId) {
  const guildState = state.get(guildId);
  if (!guildState) return;

  try {
    guildState.player.stop();
  } catch (_) {}

  try {
    guildState.connection.destroy();
  } catch (_) {}

  const existing = getVoiceConnection(guildId);
  if (existing) {
    try {
      existing.destroy();
    } catch (_) {}
  }

  state.delete(guildId);
}

client.login(process.env.DISCORD_TOKEN);

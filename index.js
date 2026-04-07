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
const PREFIX = process.env.PREFIX || "?";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const guildState = new Map();

app.get("/", (req, res) => {
  res.send("SoundCloud bot is running.");
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

client.once("ready", async () => {
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
    const reason = error?.message ? `\n原因：${error.message}` : "";
    message.reply(`❌ 執行指令時發生錯誤。${reason}`);
  }
});

async function handlePlay(message, args) {
  const voiceChannel = message.member?.voice?.channel;
  if (!voiceChannel) {
    return message.reply("❌ 你要先進入語音頻道。");
  }

  const query = args.join(" ").trim();
  if (!query) {
    return message.reply(`❌ 請輸入 ${PREFIX}play SoundCloud連結 或 ${PREFIX}play 歌名`);
  }

  let trackUrl = null;
  let trackTitle = "未知曲目";

  if (/^https?:\/\/(www\.)?soundcloud\.com\//i.test(query)) {
    trackUrl = query;

    try {
      const info = await play.soundcloud(trackUrl);
      trackTitle = info?.name || trackTitle;
    } catch (err) {
      console.error("SoundCloud URL info error:", err);
    }
  } else {
    const results = await play.search(query, {
      source: { soundcloud: "tracks" },
      limit: 1,
    });

    if (!results || !results.length) {
      return message.reply("❌ 找不到這首 SoundCloud 音樂。");
    }

    trackUrl = results[0].url;
    trackTitle = results[0].name || results[0].title || trackTitle;
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
        textChannel.send("❌ 播放失敗，請換另一首 SoundCloud。").catch(() => {});
      }
      cleanupGuild(message.guild.id);
    });

    guildState.set(message.guild.id, state);
  }

  state.textChannelId = message.channel.id;

  const stream = await play.stream(trackUrl);
  const resource = createAudioResource(stream.stream, {
    inputType: stream.type,
  });

  state.player.play(resource);
  message.channel.send(`▶️ 開始播放：**${trackTitle}**`);
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
      `\`${PREFIX}play SoundCloud連結\``,
      `\`${PREFIX}play 歌名\``,
      `\`${PREFIX}stop\``,
      `\`${PREFIX}leave\``,
      `\`${PREFIX}help\``,
    ].join("\n")
  );
}

function cleanupGuild(guildId) {
  const state = guildState.get(guildId);
  if (!state) return;

  try { state.player.stop(); } catch {}
  try { state.connection.destroy(); } catch {}

  const existing = getVoiceConnection(guildId);
  if (existing) {
    try { existing.destroy(); } catch {}
  }

  guildState.delete(guildId);
}

client.login(process.env.DISCORD_TOKEN);

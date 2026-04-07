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
  entersState,
  VoiceConnectionStatus,
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

async function initSoundCloud() {
  const clientID = await play.getFreeClientID();
  play.setToken({
    soundcloud: {
      client_id: clientID,
    },
  });
  console.log("✅ SoundCloud client_id loaded");
}

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
  try {
    await initSoundCloud();
    console.log(`✅ Logged in as ${client.user.tag}`);
  } catch (err) {
    console.error("❌ SoundCloud init failed:", err);
  }
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
    return message.reply(`❌ 請輸入 ${PREFIX}play SoundCloud連結`);
  }

  if (!/^https?:\/\/(www\.)?soundcloud\.com\//i.test(query)) {
    return message.reply("❌ 目前這版只支援 SoundCloud 連結。");
  }

  let state = guildState.get(message.guild.id);

  if (!state) {
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator,
      selfDeaf: true,
    });

    await entersState(connection, VoiceConnectionStatus.Ready, 20_000);

    const player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Pause,
      },
    });

    connection.subscribe(player);

    state = {
      connection,
      player,
      textChannelId: message.channel.id,
      idleTimer: null,
    };

    player.on(AudioPlayerStatus.Playing, () => {
      console.log("▶ player status = Playing");
      if (state.idleTimer) {
        clearTimeout(state.idleTimer);
        state.idleTimer = null;
      }
    });

    player.on(AudioPlayerStatus.Idle, async () => {
      console.log("⏹ player status = Idle");

      if (state.idleTimer) clearTimeout(state.idleTimer);

      state.idleTimer = setTimeout(async () => {
        const current = guildState.get(message.guild.id);
        if (!current) return;

        if (current.player.state.status === AudioPlayerStatus.Idle) {
          const textChannel = await client.channels.fetch(current.textChannelId).catch(() => null);
          if (textChannel && textChannel.isTextBased()) {
            textChannel.send("⏹️ 播放結束，已離開語音頻道。").catch(() => {});
          }
          cleanupGuild(message.guild.id);
        }
      }, 3000);
    });

    player.on("error", async (error) => {
      console.error("Player error:", error);
      const textChannel = await client.channels.fetch(state.textChannelId).catch(() => null);
      if (textChannel && textChannel.isTextBased()) {
        textChannel.send("❌ 播放失敗，請換另一個 SoundCloud 連結。").catch(() => {});
      }
      cleanupGuild(message.guild.id);
    });

    guildState.set(message.guild.id, state);
  }

  state.textChannelId = message.channel.id;

  const soundInfo = await play.soundcloud(query);
  const trackTitle = soundInfo?.name || "未知曲目";

  const stream = await play.stream_from_info(soundInfo);
  const resource = createAudioResource(stream.stream, {
    inputType: stream.type,
  });

  play.attachListeners(state.player, stream);

  state.player.play(resource);

  await entersState(state.player, AudioPlayerStatus.Playing, 20_000);

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
      `\`${PREFIX}stop\``,
      `\`${PREFIX}leave\``,
      `\`${PREFIX}help\``,
    ].join("\n")
  );
}

function cleanupGuild(guildId) {
  const state = guildState.get(guildId);
  if (!state) return;

  if (state.idleTimer) {
    clearTimeout(state.idleTimer);
    state.idleTimer = null;
  }

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

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

app.get("/", (req, res) => {
  res.send("SoundCloud bot is running.");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Web server running on port ${PORT}`);
});

client.once("clientReady", () => {
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
    message.reply(`❌ 錯誤：${error.message}`);
  }
});

async function handlePlay(message, args) {
  const voiceChannel = message.member?.voice?.channel;
  if (!voiceChannel) {
    return message.reply("❌ 先進語音頻道");
  }

  const url = args[0];
  if (!url || !url.includes("soundcloud.com")) {
    return message.reply("❌ 請給 SoundCloud 連結");
  }

  let state = guildState.get(message.guild.id);

  if (!state) {
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator,
      selfDeaf: true,
    });

    connection.on("stateChange", (oldState, newState) => {
      console.log(`Voice state: ${oldState.status} -> ${newState.status}`);
    });

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 60000);
    } catch (err) {
      console.error("Voice connection failed:", err);
      return message.reply("❌ 語音連線失敗，可能是頻道權限或 Render 語音連線不穩。");
    }

    const player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Play,
      },
    });

    connection.subscribe(player);

    state = {
      connection,
      player,
    };

    player.on(AudioPlayerStatus.Playing, () => {
      console.log("▶ 播放中");
    });

    player.on(AudioPlayerStatus.Idle, () => {
      console.log("⏹ 播放結束");
    });

    player.on("error", (err) => {
      console.error("播放器錯誤:", err);
    });

    guildState.set(message.guild.id, state);
  }

  const stream = await play.stream(url);

  const resource = createAudioResource(stream.stream, {
    inputType: stream.type,
  });

  state.player.play(resource);

  message.reply("▶️ 播放中");
}

function handleStop(message) {
  const state = guildState.get(message.guild.id);
  if (!state) {
    return message.reply("❌ 目前沒有播放中的音樂");
  }

  state.player.stop();
  message.reply("⏹️ 停止");
}

function handleLeave(message) {
  const state = guildState.get(message.guild.id);
  if (!state) {
    return message.reply("❌ 目前不在語音頻道");
  }

  cleanupGuild(message.guild.id);
  message.reply("👋 離開");
}

function handleHelp(message) {
  message.reply(
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

  try { state.player.stop(); } catch {}
  try { state.connection.destroy(); } catch {}

  const existing = getVoiceConnection(guildId);
  if (existing) {
    try { existing.destroy(); } catch {}
  }

  guildState.delete(guildId);
}

client.login(process.env.DISCORD_TOKEN);

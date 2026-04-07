require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus
} = require("@discordjs/voice");

const play = require("play-dl");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const PREFIX = "!";

let queue = [];
let player;

client.once("ready", () => {
  console.log(`✅ 已登入 ${client.user.tag}`);
});

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;
  if (!msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(1).split(" ");
  const cmd = args.shift();

  if (cmd === "play") {
    const vc = msg.member.voice.channel;
    if (!vc) return msg.reply("❌ 先進語音頻道");

    const query = args.join(" ");

    let url;

    if (play.yt_validate(query) === "video" || query.includes("youtu")) {
      url = query;
    } else {
      const r = await play.search(query, { limit: 1 });
      if (!r.length) return msg.reply("❌ 找不到");
      url = r[0].url;
    }

    queue.push(url);
    msg.channel.send("🎵 已加入播放清單");

    if (!player) start(msg, vc);
  }

  if (cmd === "skip") {
    player.stop();
    msg.channel.send("⏭️ 已跳過");
  }

  if (cmd === "stop") {
    queue = [];
    player.stop();
    msg.channel.send("⏹️ 已停止");
  }
});

async function start(msg, vc) {
  const connection = joinVoiceChannel({
    channelId: vc.id,
    guildId: msg.guild.id,
    adapterCreator: msg.guild.voiceAdapterCreator,
  });

  player = createAudioPlayer();
  connection.subscribe(player);

  playNext(msg);

  player.on(AudioPlayerStatus.Idle, () => {
    playNext(msg);
  });
}

async function playNext(msg) {
  if (queue.length === 0) {
    player = null;
    return;
  }

  const url = queue.shift();

  const stream = await play.stream(url);
  const resource = createAudioResource(stream.stream, {
    inputType: stream.type,
  });

  player.play(resource);
  msg.channel.send(`▶️ 播放中: ${url}`);
}

client.login(process.env.TOKEN);

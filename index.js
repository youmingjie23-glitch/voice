require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior
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

let player = null;
let connection = null;

client.once("ready", () => {
  console.log(`✅ Bot ready: ${client.user.tag}`);
});

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  if (msg.content.startsWith("!play")) {
    const vc = msg.member.voice.channel;
    if (!vc) return msg.reply("❌ 先進語音頻道");

    const url = msg.content.split(" ")[1];
    if (!url) return msg.reply("❌ 請貼 YouTube 連結");

    try {
      // 建立連線（如果沒有）
      if (!connection) {
        connection = joinVoiceChannel({
          channelId: vc.id,
          guildId: msg.guild.id,
          adapterCreator: msg.guild.voiceAdapterCreator,
          selfDeaf: true
        });
      }

      // 建立播放器（低RAM模式）
      if (!player) {
        player = createAudioPlayer({
          behaviors: {
            noSubscriber: NoSubscriberBehavior.Stop,
          },
        });

        connection.subscribe(player);
      }

      // 取得音訊（低負載）
      const stream = await play.stream(url, {
        discordPlayerCompatibility: true
      });

      const resource = createAudioResource(stream.stream, {
        inputType: stream.type,
        inlineVolume: false // 關閉音量控制（省RAM）
      });

      player.play(resource);

      msg.channel.send("▶️ 播放中");

      // 播完直接清掉
      player.once(AudioPlayerStatus.Idle, () => {
        msg.channel.send("⏹️ 播放結束");

        if (connection) {
          connection.destroy();
          connection = null;
        }

        player = null;
      });

    } catch (err) {
      console.error(err);
      msg.reply("❌ 播放失敗");
    }
  }

  if (msg.content === "!stop") {
    if (player) {
      player.stop();
      msg.channel.send("⏹️ 已停止");
    }

    if (connection) {
      connection.destroy();
      connection = null;
    }

    player = null;
  }
});

client.login(process.env.TOKEN);

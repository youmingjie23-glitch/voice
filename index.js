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

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
    } catch (err) {
      console.error("Voice connection ready timeout:", err);
      try {
        connection.destroy();
      } catch (_) {}
      return message.reply("❌ 語音連線建立失敗，請再試一次。");
    }

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

  message.channel.send(`▶️ 開始播放：**${trackTitle}**`);
}

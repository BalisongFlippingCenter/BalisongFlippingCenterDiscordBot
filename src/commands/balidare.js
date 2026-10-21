const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, InteractionContextType } = require('discord.js');
const { generateCombo, formatCombo, levelChoices } = require('../utils/comboGenerator');
const { buildCard, cardBody, landingModal, videoProblem, videoFile } = require('../utils/challengeCard');

const NO_PINGS = { parse: [] };
const DARE_LIMIT = 5;
const DARE_WINDOW_MS = 10 * 60 * 1000;
const recentDares = new Map();

function tryDare(userId) {
  const now = Date.now();
  const recent = (recentDares.get(userId) ?? []).filter(time => now - time < DARE_WINDOW_MS);
  recentDares.set(userId, recent);
  if (recent.length >= DARE_LIMIT) return false;
  recent.push(now);
  return true;
}

function dareCard(body, targetId, videoNames = []) {
  return buildCard({
    body,
    status: `⏳ Waiting on <@${targetId}> — land it and upload your clip.`,
    videoNames,
    buttons: [
      new ButtonBuilder().setCustomId(`balidare:land:${targetId}`).setLabel('Submit my landing').setEmoji('📹').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`balidare:pass:${targetId}`).setLabel('Pass').setEmoji('🏳️').setStyle(ButtonStyle.Secondary)
    ]
  });
}

module.exports = {
  channelRule: 'games',

  data: new SlashCommandBuilder()
    .setName('balidare')
    .setDescription('Dare someone to land a combo.')
    .setContexts(InteractionContextType.Guild)
    .addSubcommand(sub =>
      sub.setName('combo')
        .setDescription('Dare someone with a combo — generated at a level, or typed out yourself.')
        .addUserOption(option => option.setName('user').setDescription('Who you\'re daring').setRequired(true))
        .addStringOption(option => option.setName('level').setDescription('Generate a combo at this level').addChoices(...levelChoices))
        .addStringOption(option => option.setName('combo').setDescription('Or type your own, e.g. "fan → helix → chaplin"').setMaxLength(300))
    )
    .addSubcommand(sub =>
      sub.setName('video')
        .setDescription('Dare someone with a clip of you landing it.')
        .addUserOption(option => option.setName('user').setDescription('Who you\'re daring').setRequired(true))
        .addAttachmentOption(option => option.setName('video').setDescription('Your clip').setRequired(true))
        .addStringOption(option => option.setName('note').setDescription('Optional: what the trick or combo is').setMaxLength(300))
    ),

  async execute(interaction) {
    const challengerId = interaction.user.id;
    const target = interaction.options.getUser('user');
    const typedCombo = interaction.options.getString('combo');
    const level = interaction.options.getString('level');
    const video = interaction.options.getAttachment('video');

    let problem = null;
    if (target.bot || target.id === challengerId) problem = 'Dare someone else — not yourself or a bot.';
    else if (interaction.options.getSubcommand() === 'combo' && !typedCombo && !level) problem = 'Pick a `level` to generate a combo, or type your own in `combo`.';
    else if (video) problem = videoProblem(video, interaction.guild);
    if (!problem && !tryDare(challengerId)) problem = `⏳ You've sent ${DARE_LIMIT} dares in the last 10 minutes — give it a bit.`;
    if (problem) {
      await interaction.reply({ content: problem, ephemeral: true });
      return;
    }

    const header = `## ⚔️ Balidare\n<@${challengerId}> dares <@${target.id}> to land`;
    const pingTarget = { users: [target.id] };

    if (!video) {
      const dare = typedCombo ?? formatCombo(generateCombo(level));
      const body = `${header}${typedCombo ? '' : ` this ${level} combo`}:\n${dare}`;
      await interaction.reply({ ...dareCard(body, target.id), allowedMentions: pingTarget });
      return;
    }

    const note = interaction.options.getString('note');
    const body = `${header} what's in this clip${note ? `:\n> ${note}` : '.'}`;
    await interaction.reply({ ...buildCard({ body, status: '📤 Uploading the clip…' }), allowedMentions: pingTarget });
    const file = await videoFile(video, `dare-${challengerId}`);
    await interaction.editReply({ ...dareCard(body, target.id, [file.name]), files: [file], allowedMentions: NO_PINGS });
  },

  async button(interaction) {
    const [, action, targetId] = interaction.customId.split(':');
    if (interaction.user.id !== targetId) {
      await interaction.reply({ content: `This dare is for <@${targetId}> — send your own with \`/balidare\`.`, ephemeral: true, allowedMentions: NO_PINGS });
      return;
    }

    if (action === 'land') {
      await interaction.showModal(landingModal(`balidare:land:${targetId}`, 'Show you landed the dare'));
      return;
    }

    const kept = [...interaction.message.attachments.values()];
    await interaction.update({
      ...buildCard({ body: cardBody(interaction.message), status: `🏳️ <@${targetId}> passed on this one.`, videoNames: kept.map(a => a.name) }),
      attachments: kept,
      allowedMentions: NO_PINGS
    });
  },

  async modalSubmit(interaction) {
    const [, , targetId] = interaction.customId.split(':');
    const [video] = interaction.fields.getUploadedFiles('video', true).values();
    const problem = videoProblem(video, interaction.guild);
    if (problem) {
      await interaction.reply({ content: problem, ephemeral: true });
      return;
    }

    await interaction.deferUpdate();
    const file = await videoFile(video, `landing-${targetId}`);
    const kept = [...interaction.message.attachments.values()];
    await interaction.editReply({
      ...buildCard({ body: cardBody(interaction.message), status: `✅ <@${targetId}> landed it!`, videoNames: [...kept.map(a => a.name), file.name] }),
      files: [file],
      attachments: kept,
      allowedMentions: NO_PINGS
    });
  }
};

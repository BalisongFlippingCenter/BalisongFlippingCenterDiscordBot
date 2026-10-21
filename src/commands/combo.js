const { SlashCommandBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { generateCombo, formatCombo, levelChoices } = require('../utils/comboGenerator');
const { buildCard, cardBody, landingModal, videoProblem, videoFile } = require('../utils/challengeCard');

const NO_PINGS = { parse: [] };

function comboBody(ownerId, level) {
  const title = levelChoices.find(choice => choice.value === level).name;
  return `## 🎲 ${title} combo for <@${ownerId}>\n${formatCombo(generateCombo(level))}`;
}

function comboCard(ownerId, level, body) {
  return buildCard({
    body,
    status: 'Land it, then hit **I landed it** and upload your clip.',
    buttons: [
      new ButtonBuilder().setCustomId(`combo:reroll:${ownerId}:${level}`).setLabel('Reroll').setEmoji('🎲').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`combo:land:${ownerId}`).setLabel('I landed it').setEmoji('📹').setStyle(ButtonStyle.Success)
    ]
  });
}

module.exports = {
  channelRule: 'games',

  data: new SlashCommandBuilder()
    .setName('combo')
    .setDescription('Get a random balisong combo for your skill level.')
    .addStringOption(option =>
      option.setName('level')
        .setDescription('Your flipping level')
        .setRequired(true)
        .addChoices(...levelChoices)
    ),

  async execute(interaction) {
    const level = interaction.options.getString('level');
    await interaction.reply({ ...comboCard(interaction.user.id, level, comboBody(interaction.user.id, level)), allowedMentions: NO_PINGS });
  },

  async button(interaction) {
    const [, action, ownerId, level] = interaction.customId.split(':');
    if (interaction.user.id !== ownerId) {
      await interaction.reply({ content: 'This combo belongs to someone else — run `/combo` to get your own.', ephemeral: true });
      return;
    }

    if (action === 'reroll') {
      await interaction.update({ ...comboCard(ownerId, level, comboBody(ownerId, level)), allowedMentions: NO_PINGS });
    } else {
      await interaction.showModal(landingModal(`combo:land:${ownerId}`, 'Show you landed it'));
    }
  },

  async modalSubmit(interaction) {
    const [, , ownerId] = interaction.customId.split(':');
    const [video] = interaction.fields.getUploadedFiles('video', true).values();
    const problem = videoProblem(video, interaction.guild);
    if (problem) {
      await interaction.reply({ content: problem, ephemeral: true });
      return;
    }

    await interaction.deferUpdate();
    const file = await videoFile(video, `landing-${ownerId}`);
    await interaction.editReply({
      ...buildCard({ body: cardBody(interaction.message), status: `✅ <@${ownerId}> landed it!`, videoNames: [file.name] }),
      files: [file],
      allowedMentions: NO_PINGS
    });
  }
};

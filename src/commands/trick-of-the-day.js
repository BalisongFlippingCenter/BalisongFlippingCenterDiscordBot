const { SlashCommandBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { formatMove, playableMoves, findTrick, levelChoices } = require('../utils/comboGenerator');
const { buildCard, cardBody, landingModal, videoProblem, videoFile } = require('../utils/challengeCard');
const { askLatchButton } = require('./trick');

const NO_PINGS = { parse: [] };
const MAX_LANDINGS = 10;

function hash(text) {
  let h = 2166136261;
  for (const char of text) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

function todaysMove(level, date) {
  const pool = playableMoves().filter(move => !level || move.level === level);
  const day = Math.floor(Date.parse(date) / 86400000);
  const cycle = Math.floor(day / pool.length);
  const shuffled = pool
    .map((move, i) => ({ move, key: hash(`${level ?? 'any'}:${cycle}:${i}`) }))
    .sort((a, b) => a.key - b.key);
  return shuffled[day % pool.length].move;
}

function landerIds(fileNames) {
  return fileNames.map(name => name.match(/^landing-(\d+)\./)?.[1]).filter(Boolean);
}

function totdCard(body, trick, variant, fileNames) {
  const landers = landerIds(fileNames);
  const buttons = [askLatchButton(trick, variant)];
  if (fileNames.length < MAX_LANDINGS) {
    buttons.unshift(new ButtonBuilder()
      .setCustomId(`trick-of-the-day:land:${trick.name}:${variant ?? ''}`)
      .setLabel('I landed it')
      .setEmoji('📹')
      .setStyle(ButtonStyle.Success));
  }

  return buildCard({
    body,
    status: landers.length
      ? `✅ Landed by ${landers.map(id => `<@${id}>`).join(', ')}${fileNames.length >= MAX_LANDINGS ? '\n-# This card is full — run the command again for a fresh one.' : ''}`
      : 'Landed it? Hit **I landed it** and add your clip — anyone can.',
    videoNames: fileNames,
    buttons
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trick-of-the-day')
    .setDescription('Today\'s trick — the same for everyone, everywhere.')
    .addStringOption(option => option.setName('level').setDescription('Get the trick of the day for your level').addChoices(...levelChoices)),

  todaysMove,

  async execute(interaction) {
    const level = interaction.options.getString('level');
    const today = new Date().toISOString().slice(0, 10);
    const move = todaysMove(level, today);
    const levelLabel = level ? ` · ${levelChoices.find(choice => choice.value === level).name}` : '';
    const body = `## 📅 Trick of the day · ${today}${levelLabel}\n${formatMove(move)}\n-# Same trick for everyone today — a new one at 00:00 UTC.`;
    await interaction.reply({ ...totdCard(body, move.trick, move.variant, []), allowedMentions: NO_PINGS });
  },

  async button(interaction) {
    const fileNames = [...interaction.message.attachments.values()].map(a => a.name);
    if (landerIds(fileNames).includes(interaction.user.id)) {
      await interaction.reply({ content: 'Your landing is already on this card. 🔥', ephemeral: true });
      return;
    }
    await interaction.showModal(landingModal(interaction.customId, 'Show you landed it'));
  },

  async modalSubmit(interaction) {
    const [, , name, variant] = interaction.customId.split(':');
    const [video] = interaction.fields.getUploadedFiles('video', true).values();
    const problem = videoProblem(video, interaction.guild);
    if (problem) {
      await interaction.reply({ content: problem, ephemeral: true });
      return;
    }

    await interaction.deferUpdate();
    const file = await videoFile(video, `landing-${interaction.user.id}`);
    const kept = [...interaction.message.attachments.values()];
    await interaction.editReply({
      ...totdCard(cardBody(interaction.message), findTrick(name), variant || null, [...kept.map(a => a.name), file.name]),
      files: [file],
      attachments: kept,
      allowedMentions: NO_PINGS
    });
  }
};

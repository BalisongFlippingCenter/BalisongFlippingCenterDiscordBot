const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const bfcApi = require('../utils/bfcApi');
const { formatEnum, currentVersion } = require('../utils/catalogFormat');

const ROUND_MS = 30 * 1000;
const LETTERS = ['A', 'B', 'C', 'D'];
const rounds = new Map();

const pick = list => list[Math.floor(Math.random() * list.length)];
const shuffle = list => [...list].sort(() => Math.random() - 0.5);

function nearby(value, step, unit) {
  const format = v => `${+v.toFixed(2)}${unit}`;
  return {
    answer: format(value),
    options: [-3, -2, -1, 1, 2, 3].map(k => value + k * step).filter(v => v > 0).map(format)
  };
}

function questionTemplates(knives, summary, knife) {
  const current = currentVersion(knife);
  const label = `**${knife.name}** (${knife.makerName})`;
  const others = knives.filter(k => k.slug !== knife.slug);
  return [
    { question: `What pivot system does the ${label} use?`, answer: formatEnum(current.pivotSystem), options: ['Bearings', 'Bushings', 'Washers'] },
    { question: `What are the ${label}'s handles made of?`, answer: summary.handleMaterialSummary, options: others.map(k => k.handleMaterialSummary) },
    { question: `What does the ${label} cost?`, answer: summary.priceRangeSummary, options: others.map(k => k.priceRangeSummary) },
    { question: `Who makes the **${knife.name}**?`, answer: knife.makerName, options: others.map(k => k.makerName) },
    { question: `How much does the ${label} weigh?`, ...nearby(current.weight, 0.4, ' oz') },
    { question: `How long is the ${label} overall?`, ...nearby(current.overallLength, 0.3, '"') }
  ];
}

async function buildQuestion() {
  const knives = await bfcApi.searchKnives('');
  const summary = pick(knives);
  const knife = await bfcApi.getKnife(summary.slug);

  const playable = questionTemplates(knives, summary, knife)
    .map(template => ({ ...template, distractors: shuffle([...new Set(template.options)].filter(o => o && o !== template.answer)).slice(0, 3) }))
    .filter(template => template.answer && template.distractors.length);
  const { question, answer, distractors } = pick(playable);
  const choices = shuffle([answer, ...distractors]);
  return { question, choices, answerIndex: choices.indexOf(answer) };
}

function quizEmbed(question, footer) {
  return new EmbedBuilder().setColor(0x5865F2).setTitle('🧠 Balisong quiz').setDescription(question).setFooter({ text: footer });
}

async function reveal(interaction, messageId, { question, choices, answerIndex }) {
  const round = rounds.get(messageId);
  rounds.delete(messageId);
  const winners = [...round.answers].filter(([, choice]) => choice === answerIndex).map(([userId]) => `<@${userId}>`);
  const embed = quizEmbed(question, `${round.answers.size} ${round.answers.size === 1 ? 'person' : 'people'} answered · run /quiz for another`)
    .addFields(
      { name: 'Answer', value: `${LETTERS[answerIndex]}. ${choices[answerIndex]}` },
      { name: 'Got it right', value: winners.join(', ') || 'Nobody this time 😬' }
    );
  await interaction.editReply({ embeds: [embed], components: [], allowedMentions: { parse: [] } });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('quiz')
    .setDescription('A 30-second balisong quiz question — anyone can answer.'),

  async execute(interaction) {
    await interaction.deferReply();
    const quiz = await buildQuestion();
    const buttons = quiz.choices.map((choice, i) =>
      new ButtonBuilder().setCustomId(`quiz:answer:${i}`).setLabel(`${LETTERS[i]}. ${choice}`.slice(0, 80)).setStyle(ButtonStyle.Secondary));

    const message = await interaction.editReply({
      embeds: [quizEmbed(quiz.question, '⏱️ 30 seconds — everyone gets one guess')],
      components: [new ActionRowBuilder().addComponents(...buttons)]
    });
    rounds.set(message.id, { answerIndex: quiz.answerIndex, answers: new Map() });
    setTimeout(() => reveal(interaction, message.id, quiz).catch(error => console.error('Quiz reveal failed:', error)), ROUND_MS);
  },

  async button(interaction) {
    const round = rounds.get(interaction.message.id);
    if (!round) {
      await interaction.reply({ content: 'This quiz is over — run `/quiz` for a new one.', ephemeral: true });
      return;
    }
    if (round.answers.has(interaction.user.id)) {
      await interaction.reply({ content: 'You already answered this one.', ephemeral: true });
      return;
    }

    const choice = Number(interaction.customId.split(':')[2]);
    round.answers.set(interaction.user.id, choice);
    await interaction.reply({
      content: choice === round.answerIndex ? '✅ Correct! Results when time\'s up.' : '❌ Not quite — the answer is revealed when time\'s up.',
      ephemeral: true
    });
  }
};

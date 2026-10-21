const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const bfcApi = require('../utils/bfcApi');
const { formatEnum, currentVersion } = require('../utils/catalogFormat');

const QUESTION_MS = 20 * 1000;
const REVEAL_MS = 4 * 1000;
const DEFAULT_QUESTIONS = 5;
const LETTERS = ['A', 'B', 'C', 'D'];
const MEDALS = ['🥇', '🥈', '🥉'];
const NO_PINGS = { parse: [] };
const games = new Map();

const pick = list => list[Math.floor(Math.random() * list.length)];
function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function nearby(value, step, unit) {
  const format = v => `${+v.toFixed(2)}${unit}`;
  return {
    answer: format(value),
    options: [-3, -2, -1, 1, 2, 3].map(k => value + k * step).filter(v => v > 0).map(format)
  };
}

const QUESTION_TYPES = {
  pivot: (knife, summary, label) => ({ question: `What pivot system does the ${label} use?`, answer: formatEnum(currentVersion(knife).pivotSystem), options: ['Bearings', 'Bushings', 'Washers'] }),
  handles: (knife, summary, label, others) => ({ question: `What are the ${label}'s handles made of?`, answer: summary.handleMaterialSummary, options: others.map(k => k.handleMaterialSummary) }),
  price: (knife, summary, label, others) => ({ question: `What does the ${label} cost?`, answer: summary.priceRangeSummary, options: others.map(k => k.priceRangeSummary) }),
  maker: (knife, summary, label, others) => ({ question: `Who makes the **${knife.name}**?`, answer: knife.makerName, options: others.map(k => k.makerName) }),
  weight: (knife, summary, label) => ({ question: `How much does the ${label} weigh?`, ...nearby(currentVersion(knife).weight, 0.4, ' oz') }),
  length: (knife, summary, label) => ({ question: `How long is the ${label} overall?`, ...nearby(currentVersion(knife).overallLength, 0.3, '"') })
};

function buildQuestion(type, knife, summary, knives) {
  const label = `**${knife.name}** (${knife.makerName})`;
  const { question, answer, options } = QUESTION_TYPES[type](knife, summary, label, knives.filter(k => k.slug !== knife.slug));
  const distractors = shuffle([...new Set(options)].filter(o => o && o !== answer)).slice(0, 3);
  if (!answer || !distractors.length) return null;
  const choices = shuffle([answer, ...distractors]);
  return { question, choices, answerIndex: choices.indexOf(answer) };
}

async function buildQuiz(count) {
  const knives = await bfcApi.searchKnives('');
  const picked = shuffle(knives).slice(0, count);
  const details = await Promise.all(picked.map(summary => bfcApi.getKnife(summary.slug)));

  let types = [];
  return picked.map((summary, i) => {
    if (!types.length) types = shuffle(Object.keys(QUESTION_TYPES));
    const order = [...types, ...shuffle(Object.keys(QUESTION_TYPES))];
    for (const type of order) {
      const question = buildQuestion(type, details[i], summary, knives);
      if (question) {
        types = types.filter(remaining => remaining !== type);
        return question;
      }
    }
    return null;
  }).filter(Boolean);
}

function questionMessage(game) {
  const { question, choices } = game.questions[game.index];
  const buttons = choices.map((choice, i) =>
    new ButtonBuilder().setCustomId(`quiz:answer:${game.index}:${i}`).setLabel(`${LETTERS[i]}. ${choice}`.slice(0, 80)).setStyle(ButtonStyle.Secondary));
  buttons.push(new ButtonBuilder().setCustomId('quiz:end').setLabel('End quiz').setStyle(ButtonStyle.Danger));

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`🧠 Balisong quiz · Question ${game.index + 1}/${game.questions.length}`)
    .setDescription(question)
    .setFooter({ text: '⏱️ 20 seconds — one guess each' });
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(...buttons)], allowedMentions: NO_PINGS };
}

function revealMessage(game, winners) {
  const { question, choices, answerIndex } = game.questions[game.index];
  const isLast = game.index === game.questions.length - 1;
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`🧠 Balisong quiz · Question ${game.index + 1}/${game.questions.length}`)
    .setDescription(question)
    .addFields(
      { name: 'Answer', value: `${LETTERS[answerIndex]}. ${choices[answerIndex]}` },
      { name: 'Got it right', value: winners.map(id => `<@${id}>`).join(', ') || 'Nobody this time 😬' }
    )
    .setFooter({ text: isLast ? 'Final scores coming up…' : 'Next question coming up…' });
  return { embeds: [embed], components: [], allowedMentions: NO_PINGS };
}

function resultsMessage(game) {
  const standings = [...game.scores].sort((a, b) => b[1] - a[1]);
  const lines = standings.map(([userId, points], i) => `${MEDALS[i] ?? `**${i + 1}.**`} <@${userId}> — ${points} ${points === 1 ? 'point' : 'points'}`);
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🏁 Balisong quiz results')
    .setDescription(lines.join('\n') || 'Nobody answered 😬')
    .setFooter({ text: `${game.restarted ? 'Ended early — the bot restarted · ' : ''}${game.questionsAsked} ${game.questionsAsked === 1 ? 'question' : 'questions'} · ${standings.length} played · run /quiz for another` });
  return { embeds: [embed], components: [], allowedMentions: NO_PINGS };
}

async function finish(game) {
  game.over = true;
  clearTimeout(game.timer);
  games.delete(game.messageId);
  await game.interaction.editReply(resultsMessage(game));
}

function schedule(game, step, delay) {
  game.timer = setTimeout(() => {
    if (!game.over) step(game).catch(error => console.error('Quiz failed:', error));
  }, delay);
}

async function closeQuestion(game) {
  const { answerIndex } = game.questions[game.index];
  const winners = [...game.answers].filter(([, choice]) => choice === answerIndex).map(([userId]) => userId);
  for (const userId of winners) game.scores.set(userId, game.scores.get(userId) + 1);
  game.phase = 'reveal';
  game.questionsAsked = game.index + 1;
  await game.interaction.editReply(revealMessage(game, winners));
  if (!game.over) schedule(game, advance, REVEAL_MS);
}

async function advance(game) {
  if (game.index === game.questions.length - 1) {
    await finish(game);
    return;
  }
  game.index++;
  await askQuestion(game);
}

async function askQuestion(game) {
  game.phase = 'asking';
  game.answers = new Map();
  await game.interaction.editReply(questionMessage(game));
  if (!game.over) schedule(game, closeQuestion, QUESTION_MS);
}

module.exports = {
  channelRule: 'games',

  data: new SlashCommandBuilder()
    .setName('quiz')
    .setDescription('A balisong quiz for the channel — 20 seconds per question, anyone can play.')
    .addIntegerOption(option =>
      option.setName('questions').setDescription(`How many questions (default ${DEFAULT_QUESTIONS})`).setMinValue(3).setMaxValue(10)),

  buildQuestion,
  shuffle,

  async shutdown() {
    await Promise.all([...games.values()].map(game => {
      game.restarted = true;
      return finish(game).catch(error => console.error('Ending a quiz on shutdown failed:', error));
    }));
  },

  async execute(interaction) {
    await interaction.deferReply();
    const questions = await buildQuiz(interaction.options.getInteger('questions') ?? DEFAULT_QUESTIONS);
    const message = await interaction.fetchReply();
    const game = { interaction, messageId: message.id, hostId: interaction.user.id, questions, index: 0, scores: new Map(), questionsAsked: 0 };
    games.set(message.id, game);
    await askQuestion(game);
  },

  async button(interaction) {
    const game = games.get(interaction.message.id);
    if (!game) {
      await interaction.reply({ content: 'This quiz is over — run `/quiz` for a new one.', ephemeral: true });
      return;
    }

    const [, action, questionIndex, choiceIndex] = interaction.customId.split(':');
    if (action === 'end') {
      if (interaction.user.id !== game.hostId) {
        await interaction.reply({ content: 'Only whoever started the quiz can end it.', ephemeral: true });
        return;
      }
      await interaction.deferUpdate();
      await finish(game);
      return;
    }

    if (game.phase !== 'asking' || Number(questionIndex) !== game.index) {
      await interaction.reply({ content: 'That question is closed.', ephemeral: true });
      return;
    }
    if (game.answers.has(interaction.user.id)) {
      await interaction.reply({ content: 'You already answered this one.', ephemeral: true });
      return;
    }

    const choice = Number(choiceIndex);
    game.answers.set(interaction.user.id, choice);
    if (!game.scores.has(interaction.user.id)) game.scores.set(interaction.user.id, 0);
    await interaction.reply({
      content: choice === game.questions[game.index].answerIndex ? '✅ Correct!' : '❌ Not quite — the answer shows when time\'s up.',
      ephemeral: true
    });
  }
};

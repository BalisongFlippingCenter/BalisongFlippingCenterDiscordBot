const {
  SlashCommandBuilder,
  ButtonBuilder,
  ButtonStyle,
  InteractionContextType,
  LabelBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const { buildCard } = require('../utils/challengeCard');
const { playableMoves } = require('../utils/comboGenerator');

const NO_PINGS = { parse: [] };
const LETTERS = ['B', 'A', 'L', 'I'];
const MAX_PLAYERS = 8;
const IDLE_MS = 2 * 60 * 60 * 1000;
const games = new Map();

const pick = list => list[Math.floor(Math.random() * list.length)];
const isOut = player => player.letters >= LETTERS.length;
const alivePlayers = game => game.players.filter(player => !isOut(player));
const setterOf = game => game.players[game.setter];
const pendingPlayers = game => alivePlayers(game).filter(player => player !== setterOf(game) && !game.responses.has(player.id));
const mention = player => `<@${player.id}>`;

function button(action, label, emoji, style = ButtonStyle.Secondary) {
  return new ButtonBuilder().setCustomId(`bali:${action}`).setLabel(label).setEmoji(emoji).setStyle(style);
}

function render(game) {
  const lines = game.players.map(player => {
    const letters = LETTERS.map((letter, i) => (i < player.letters ? letter : '_')).join(' ');
    const turn = ['setting', 'responding'].includes(game.phase) && player === setterOf(game) ? '🎯 ' : '';
    const name = isOut(player) ? `~~${mention(player)}~~ ❌` : mention(player);
    return `${turn}${name} — \`${letters}\``;
  });
  const body = `## 🔤 B.A.L.I.\nHost: <@${game.hostId}>\n\n${lines.join('\n')}`;
  const end = button('end', 'End game', '🛑', ButtonStyle.Danger);

  const phases = {
    lobby: () => ({
      status: `Waiting for players — ${game.players.length}/${MAX_PLAYERS} joined. Miss a trick and earn a letter; spell B-A-L-I and you're out.`,
      buttons: [button('join', 'Join', '🙋', ButtonStyle.Primary), button('start', 'Start', '▶️', ButtonStyle.Success), end]
    }),
    setting: () => ({
      status: `🎯 ${mention(setterOf(game))}, you're setting — land a trick yourself, then type it in or roll one.`,
      buttons: [button('set', 'Set trick', '✍️', ButtonStyle.Primary), button('roll', 'Roll trick', '🎲'), button('skip', 'Skip setter', '⏭️'), end]
    }),
    responding: () => ({
      status: `Trick: **${game.trick}**\nWaiting on ${pendingPlayers(game).map(mention).join(', ')} — hit ✅ or ❌.`,
      buttons: [button('landed', 'Landed', '✅', ButtonStyle.Success), button('missed', 'Missed', '❌', ButtonStyle.Danger), button('skip', 'Skip the rest', '⏭️'), end]
    }),
    over: () => ({
      status: game.winner ? `🏆 ${mention(game.winner)} wins!` : '🛑 Game ended by the host.',
      buttons: []
    })
  };
  return { ...buildCard({ body, ...phases[game.phase]() }), allowedMentions: NO_PINGS };
}

function nextSetter(game) {
  do {
    game.setter = (game.setter + 1) % game.players.length;
  } while (isOut(setterOf(game)));
  game.phase = 'setting';
  game.trick = null;
  game.responses = new Map();
}

function finishRound(game) {
  for (const player of game.players) {
    if (game.responses.get(player.id) === 'missed') player.letters++;
  }
  const alive = alivePlayers(game);
  if (alive.length <= 1) {
    game.phase = 'over';
    game.winner = alive[0];
  } else {
    nextSetter(game);
  }
}

function setTrick(game, trick) {
  game.trick = trick;
  game.phase = 'responding';
}

function setTrickModal() {
  return new ModalBuilder()
    .setCustomId('bali:set')
    .setTitle('Set the trick')
    .addLabelComponents(new LabelBuilder()
      .setLabel('Trick or combo you just landed')
      .setTextInputComponent(new TextInputBuilder().setCustomId('trick').setStyle(TextInputStyle.Short).setMaxLength(200).setRequired(true)));
}

function problemWith(game, action, userId) {
  const player = game.players.find(p => p.id === userId);
  const isHost = userId === game.hostId;
  const isSetter = ['setting', 'responding'].includes(game.phase) && setterOf(game).id === userId;

  switch (action) {
    case 'join':
      if (game.phase !== 'lobby') return 'This game already started — catch the next one.';
      if (player) return 'You\'re already in.';
      if (game.players.length >= MAX_PLAYERS) return `The game is full (${MAX_PLAYERS} players).`;
      return null;
    case 'start':
      if (!isHost) return 'Only the host can start the game.';
      if (game.phase !== 'lobby') return 'The game already started.';
      if (game.players.length < 2) return 'You need at least 2 players to start.';
      return null;
    case 'end':
    case 'skip':
      return isHost ? null : 'Only the host can do that.';
    case 'set':
    case 'roll':
      if (game.phase !== 'setting') return 'The trick is already set.';
      return isSetter ? null : `It's ${mention(setterOf(game))}'s turn to set.`;
    case 'landed':
    case 'missed':
      if (!player || isOut(player)) return 'You\'re not in this round.';
      if (isSetter) return 'You set this one — wait for everyone else.';
      if (game.responses.has(userId)) return 'You already answered this round.';
      return null;
  }
}

function apply(game, action, userId) {
  switch (action) {
    case 'join':
      game.players.push({ id: userId, letters: 0 });
      break;
    case 'start':
      game.phase = 'setting';
      game.setter = 0;
      game.responses = new Map();
      break;
    case 'end':
      game.phase = 'over';
      break;
    case 'roll': {
      const move = pick(playableMoves());
      setTrick(game, `${move.trick.name}${move.variant ? ` (${move.variant})` : ''}`);
      break;
    }
    case 'skip':
      if (game.phase === 'setting') {
        nextSetter(game);
      } else {
        for (const player of pendingPlayers(game)) game.responses.set(player.id, 'missed');
        finishRound(game);
      }
      break;
    case 'landed':
    case 'missed':
      game.responses.set(userId, action);
      if (!pendingPlayers(game).length) finishRound(game);
      break;
  }
}

function turnPing(game) {
  if (game.phase === 'setting') {
    return { users: [setterOf(game)], content: `🎯 ${mention(setterOf(game))}, you're up — set the next trick in B.A.L.I.` };
  }
  if (game.phase === 'responding') {
    const pending = pendingPlayers(game);
    return { users: pending, content: `⚔️ Trick set: **${game.trick}** — ${pending.map(mention).join(', ')}, land it or take a letter.` };
  }
  if (game.phase === 'over' && game.winner) {
    return { users: [game.winner], content: `🏆 ${mention(game.winner)} wins B.A.L.I.!` };
  }
  return null;
}

async function updateGame(interaction, messageId, game) {
  game.lastActive = Date.now();
  if (game.phase === 'over') games.delete(messageId);
  await interaction.update(render(game));

  const ping = turnPing(game);
  const pingKey = `${game.phase}:${game.setter}:${game.trick}`;
  if (ping && pingKey !== game.lastPingKey) {
    game.lastPingKey = pingKey;
    await interaction.followUp({ content: ping.content, allowedMentions: { users: ping.users.map(player => player.id) } });
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bali')
    .setDescription('Start a game of B.A.L.I. — miss a trick, earn a letter.')
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    for (const [messageId, game] of games) {
      if (Date.now() - game.lastActive > IDLE_MS) games.delete(messageId);
    }

    const game = { hostId: interaction.user.id, players: [{ id: interaction.user.id, letters: 0 }], phase: 'lobby', lastActive: Date.now() };
    const response = await interaction.reply({ ...render(game), withResponse: true });
    games.set(response.resource.message.id, game);
  },

  async button(interaction) {
    const game = games.get(interaction.message.id);
    if (!game) {
      await interaction.reply({ content: 'This game has ended or expired — start a new one with `/bali`.', ephemeral: true });
      return;
    }

    const action = interaction.customId.split(':')[1];
    const problem = problemWith(game, action, interaction.user.id);
    if (problem) {
      await interaction.reply({ content: problem, ephemeral: true, allowedMentions: NO_PINGS });
      return;
    }

    if (action === 'set') {
      await interaction.showModal(setTrickModal());
      return;
    }
    apply(game, action, interaction.user.id);
    await updateGame(interaction, interaction.message.id, game);
  },

  async modalSubmit(interaction) {
    const game = games.get(interaction.message.id);
    const problem = game ? problemWith(game, 'set', interaction.user.id) : 'This game has ended or expired.';
    if (problem) {
      await interaction.reply({ content: problem, ephemeral: true, allowedMentions: NO_PINGS });
      return;
    }

    setTrick(game, interaction.fields.getTextInputValue('trick'));
    await updateGame(interaction, interaction.message.id, game);
  }
};

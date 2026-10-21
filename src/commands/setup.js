const { SlashCommandBuilder, ChannelType, InteractionContextType, PermissionFlagsBits } = require('discord.js');
const guildSettings = require('../utils/guildSettings');
const { levelChoices } = require('../utils/comboGenerator');

const POSTABLE_CHANNELS = [ChannelType.GuildText, ChannelType.GuildAnnouncement];
const POST_PERMISSIONS = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages];
const DEFAULT_HOUR = 14;

const levelName = level => levelChoices.find(choice => choice.value === level)?.name;

function nextPostTime(hour, now = new Date()) {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour));
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return Math.floor(next.getTime() / 1000);
}

function describe(settings) {
  const totd = settings?.totd_channel_id
    ? `<#${settings.totd_channel_id}> daily at <t:${nextPostTime(settings.totd_hour)}:t> (${settings.totd_hour}:00 UTC)${settings.totd_level ? ` · ${levelName(settings.totd_level)}` : ''}`
    : 'Off';
  return [
    `📅 **Trick of the day:** ${totd}`,
    `🤖 **Latch:** ${settings?.latch_channel_id ? `<#${settings.latch_channel_id}> only` : 'Any channel'}`,
    `🎮 **Games** (\`/quiz\`, \`/bali\`, \`/combo\`, \`/balidare\`): ${settings?.games_channel_id ? `<#${settings.games_channel_id}> only` : 'Any channel'}`
  ].join('\n');
}

function channelLimitSubcommand(sub, name, what) {
  return sub.setName(name)
    .setDescription(`Keep ${what} to one channel — leave the channel empty to allow every channel.`)
    .addChannelOption(option => option.setName('channel').setDescription(`The only channel ${what} can be used in`).addChannelTypes(...POSTABLE_CHANNELS));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Bot settings for this server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand(sub =>
      sub.setName('trick-of-the-day')
        .setDescription('Post the trick of the day in a channel every day.')
        .addChannelOption(option => option.setName('channel').setDescription('Where to post it').addChannelTypes(...POSTABLE_CHANNELS).setRequired(true))
        .addIntegerOption(option => option.setName('hour').setDescription(`Hour to post at, in UTC (default ${DEFAULT_HOUR}:00 UTC)`).setMinValue(0).setMaxValue(23))
        .addStringOption(option => option.setName('level').setDescription('Only post tricks at this level').addChoices(...levelChoices)))
    .addSubcommand(sub => sub.setName('trick-of-the-day-off').setDescription('Stop posting the trick of the day.'))
    .addSubcommand(sub => channelLimitSubcommand(sub, 'latch-channel', 'Latch'))
    .addSubcommand(sub => channelLimitSubcommand(sub, 'games-channel', 'games'))
    .addSubcommand(sub => sub.setName('view').setDescription('Show this server\'s settings.')),

  nextPostTime,

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const channel = interaction.options.getChannel('channel');

    if (subcommand === 'trick-of-the-day') {
      const me = interaction.guild?.members.me;
      if (!me || !channel.permissionsFor(me).has(POST_PERMISSIONS)) {
        await interaction.reply({ content: `I need **View Channel** and **Send Messages** in <#${channel.id}> to post there.`, ephemeral: true });
        return;
      }
      guildSettings.update(interaction.guildId, {
        totd_channel_id: channel.id,
        totd_hour: interaction.options.getInteger('hour') ?? DEFAULT_HOUR,
        totd_level: interaction.options.getString('level')
      });
    } else if (subcommand === 'trick-of-the-day-off') {
      guildSettings.update(interaction.guildId, { totd_channel_id: null });
    } else if (subcommand === 'latch-channel') {
      guildSettings.update(interaction.guildId, { latch_channel_id: channel?.id ?? null });
    } else if (subcommand === 'games-channel') {
      guildSettings.update(interaction.guildId, { games_channel_id: channel?.id ?? null });
    }

    const saved = subcommand === 'view' ? '' : '✅ Saved.\n\n';
    const catchUp = subcommand === 'trick-of-the-day' ? '\n-# If today\'s post time has already passed, today\'s trick goes out within a minute.' : '';
    await interaction.reply({ content: `${saved}${describe(guildSettings.get(interaction.guildId))}${catchUp}`, ephemeral: true, allowedMentions: { parse: [] } });
  }
};

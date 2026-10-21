const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const loadHandlers = require('./src/handlers');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

loadHandlers(client);

client.once('clientReady', () => {
  console.log(`Logged in as ${client.user.tag} — in ${client.guilds.cache.size} servers`);
});

async function shutdown(signal) {
  console.log(`${signal} received — ending active games`);
  await Promise.all(client.commands.filter(command => command.shutdown).map(command => command.shutdown()));
  await client.destroy();
  process.exit(0);
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);

client.login(process.env.TOKEN);

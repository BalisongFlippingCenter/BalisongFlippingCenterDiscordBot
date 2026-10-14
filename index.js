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

client.login(process.env.TOKEN);

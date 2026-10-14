const fs = require('fs');
const path = require('path');
const { Collection } = require('discord.js');

module.exports = (client) => {

  // Load commands
  client.commands = new Collection();
  const commandFiles = fs.readdirSync(path.join(__dirname, '../commands'))
    .filter(f => f.endsWith('.js'));

  for (const file of commandFiles) {
    const command = require(`../commands/${file}`);
    client.commands.set(command.data.name, command);
  }

  // Load events
  const eventFiles = fs.readdirSync(path.join(__dirname, '../events'))
    .filter(f => f.endsWith('.js'));

  for (const file of eventFiles) {
    const event = require(`../events/${file}`);
    client.on(event.name, (...args) => event.execute(...args));
  }
};
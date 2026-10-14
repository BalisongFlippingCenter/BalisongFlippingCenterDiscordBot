const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
require('dotenv').config();

const commands = fs.readdirSync(path.join(__dirname, 'src/commands'))
  .filter(f => f.endsWith('.js'))
  .map(f => require(`./src/commands/${f}`).data.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  console.log(`Registering ${commands.length} global slash commands...`);
  await rest.put(
    Routes.applicationCommands(process.env.CLIENT_ID),
    { body: commands }
  );
  console.log('Done!');
})();

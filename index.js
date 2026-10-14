// Import the necessary classes from discord.js
const { Client, GatewayIntentBits } = require('discord.js');

require('dotenv').config();

const loadHandlers = require('./src/handlers')
const postSubmitMessage = require("./src/utils/postSubmitMessage")

// Create a new client instance with required gateway intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

loadHandlers(client);

// Run this event listener once when the bot successfully logs in
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    // post bug/issue report message to channel
    await postSubmitMessage(client);
});


// Run this event listener every time a message is sent in a server
client.on('messageCreate', (message) => {
    // Ignore messages sent by bots to prevent infinite loops
    if (message.author.bot) return;

    // Respond "pong!" if the message text is exactly "ping"
    if (message.content.toLowerCase() === 'ping') {
        message.channel.send('pong!');
    }
});

client.login(process.env.TOKEN);

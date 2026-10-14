const { SlashCommandBuilder } = require("discord.js");
const startBugReport = require('../utils/startBugReport');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('submit')
        .setDescription("Submit a bug or issue."),

    async execute(interaction) {
        await startBugReport(interaction);
    }
};

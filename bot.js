require("dotenv").config();
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, MessageFlags } = require("discord.js");
const axios = require("axios");

// ✅ Logging environment variables to confirm they are loaded
console.log("🔍 Checking environment variables...");
["DISCORD_BOT_TOKEN", "STREAM_ELEMENTS_CHANNEL_ID", "LEADERBOARD_CHANNEL_ID", "DONATION_LINK", "CLIENT_ID"].forEach((varName) => {
    console.log(`${varName}:`, process.env[varName] ? "✅ Loaded" : "❌ Missing");
});

// ✅ Exit if required environment variables are missing
if (!process.env.DISCORD_BOT_TOKEN || !process.env.CLIENT_ID) {
    console.error("❌ Missing required environment variables. Exiting...");
    process.exit(1);
}

// ✅ Ensure proper intents for Discord bot
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ✅ Global Variables (Can Be Changed With Commands)
let leaderboardChannelId = process.env.LEADERBOARD_CHANNEL_ID;
let streamElementsApi = `https://api.streamelements.com/kappa/v2/tips/${process.env.STREAM_ELEMENTS_CHANNEL_ID}/leaderboard`;
let updateInterval = 15 * 60 * 1000; // Default: 15 minutes
let updateIntervalId = null;

// ✅ Function to fetch leaderboard data from StreamElements
async function fetchLeaderboard() {
    try {
        const response = await axios.get(streamElementsApi);
        const leaderboard = response.data;

        if (!leaderboard || leaderboard.length === 0) {
            console.log("⚠️ No leaderboard data found.");
            return "**No leaderboard data available.**";
        }

        let message = "**💰 Top Donators 💰**\n";
        leaderboard.forEach((entry, index) => {
            message += `\n**#${index + 1}** - ${entry.username}: $${entry.amount.toFixed(2)}`;
        });

        message += `\n\n🌟 [Donate Here](${process.env.DONATION_LINK})`;
        return message;
    } catch (error) {
        console.error("❌ Error fetching leaderboard:", error.response?.data || error.message);
        return "**⚠️ Failed to fetch leaderboard.**";
    }
}

// ✅ Function to update leaderboard message
async function updateLeaderboardMessage() {
    try {
        const channel = await client.channels.fetch(leaderboardChannelId);
        if (!channel) {
            console.log("⚠️ Leaderboard channel not found.");
            return;
        }

        const messages = await channel.messages.fetch({ limit: 1 });
        const lastMessage = messages.first();

        const leaderboardMessage = await fetchLeaderboard();
        if (lastMessage) {
            await lastMessage.edit(leaderboardMessage);
        } else {
            await channel.send(leaderboardMessage);
        }

        console.log("✅ Leaderboard updated!");
    } catch (error) {
        console.error("❌ Failed to update leaderboard:", error.message);
    }
}

// ✅ Slash Commands Setup
const commands = [
    new SlashCommandBuilder()
        .setName('start')
        .setDescription('Set leaderboard updates to every 5 minutes.'),
    
    new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Set leaderboard updates back to every 15 minutes.'),

    new SlashCommandBuilder()
        .setName('setleaderboard')
        .setDescription('Set the channel where the leaderboard updates.')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The leaderboard channel')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('setapi')
        .setDescription('Set the StreamElements API URL.')
        .addStringOption(option =>
            option.setName('apiurl')
                .setDescription('The new StreamElements API URL')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('help')
        .setDescription('List all available commands.')
];

// ✅ Register Slash Commands
const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);
(async () => {
    try {
        console.log("🚀 Registering slash commands...");
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        console.log("✅ Slash commands registered!");
    } catch (error) {
        console.error("❌ Failed to register commands:", error);
    }
})();

// ✅ Bot Ready Event
client.once("ready", async () => {
    console.log(`✅ Logged in as ${client.user.tag}!`);
    console.log("✅ Default Leaderboard updates every 15 minutes.");
    updateLeaderboardMessage();
    updateIntervalId = setInterval(updateLeaderboardMessage, updateInterval);
});

// ✅ Slash Command Handling
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    if (commandName === "start") {
        clearInterval(updateIntervalId);
        updateInterval = 5 * 60 * 1000; // Set to 5 minutes
        updateIntervalId = setInterval(updateLeaderboardMessage, updateInterval);
        await interaction.reply({ content: "✅ Leaderboard updates set to **every 5 minutes**.", flags: MessageFlags.Ephemeral });
    }

    if (commandName === "stop") {
        clearInterval(updateIntervalId);
        updateInterval = 15 * 60 * 1000; // Back to 15 minutes
        updateIntervalId = setInterval(updateLeaderboardMessage, updateInterval);
        await interaction.reply({ content: "✅ Leaderboard updates set **back to every 15 minutes**.", flags: MessageFlags.Ephemeral });
    }

    if (commandName === "setleaderboard") {
        const channel = interaction.options.getChannel("channel");
        leaderboardChannelId = channel.id;
        await interaction.reply({ content: `✅ Leaderboard channel set to <#${channel.id}>.`, flags: MessageFlags.Ephemeral });
    }

    if (commandName === "setapi") {
        const apiUrl = interaction.options.getString("apiurl");
        streamElementsApi = apiUrl;
        await interaction.reply({ content: `✅ StreamElements API set to: ${apiUrl}\n🔗 [StreamElements API Docs](https://dev.streamelements.com/docs/api-docs/ae133ffaf8c1a-personal-access-using-jwt-secert-token-to-access-the-api)`, flags: MessageFlags.Ephemeral });
    }

    if (commandName === "help") {
        await interaction.reply({
            content: "**📜 Leaderboard Bot Commands:**\n" +
                "`/start` - Update leaderboard every **5 minutes**\n" +
                "`/stop` - Update leaderboard every **15 minutes (default)**\n" +
                "`/setleaderboard [channel]` - Set the leaderboard update channel\n" +
                "`/setapi [url]` - Set StreamElements API URL\n" +
                "`/help` - Show this command list",
            flags: MessageFlags.Ephemeral
        });
    }
});

// ✅ Start the bot with the environment token
client.login(process.env.DISCORD_BOT_TOKEN);
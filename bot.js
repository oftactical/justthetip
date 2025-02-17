require("dotenv").config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require("discord.js");
const axios = require("axios");

console.log("🔍 Checking environment variables...");
["DISCORD_BOT_TOKEN", "STREAM_ELEMENTS_CHANNEL_ID", "LEADERBOARD_CHANNEL_ID", "DONATION_LINK"].forEach((varName) => {
    console.log(`${varName}:`, process.env[varName] ? "✅ Loaded" : "❌ Missing");
});

// ✅ Exit if required environment variables are missing
if (!process.env.DISCORD_BOT_TOKEN || !process.env.STREAM_ELEMENTS_CHANNEL_ID || !process.env.LEADERBOARD_CHANNEL_ID) {
    console.error("❌ Missing required environment variables. Exiting...");
    process.exit(1);
}

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

// ✅ Restore API URL from `.env`
const STREAM_ELEMENTS_API = `https://api.streamelements.com/kappa/v2/tips/678d81945b43e4feb515e179/leaderboard`;

let leaderboardChannelId = process.env.LEADERBOARD_CHANNEL_ID;
let updateInterval = 15 * 60 * 1000; // Default: 15 minutes
let updateIntervalId = null;

// ✅ Fetch Leaderboard Data
async function fetchLeaderboard() {
    try {
        const response = await axios.get(STREAM_ELEMENTS_API);
        const leaderboard = response.data;

        if (!leaderboard || leaderboard.length === 0) {
            console.log("⚠️ No leaderboard data found.");
            return "**No leaderboard data available.**";
        }

        let message = "**💰 Top Donators 💰**\n";
        leaderboard.forEach((entry, index) => {
            message += `\n**#${index + 1}** - ${entry.username}: $${entry.amount.toFixed(2)}`;
        });

        message += `\n\n[🌟 CLick To Tip](${process.env.DONATION_LINK})`;
        return message;
    } catch (error) {
        console.error("❌ Error fetching leaderboard:", error.response?.data || error.message);
        return "**⚠️ Failed to fetch leaderboard.**";
    }
}

// ✅ Update Leaderboard Message
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

// ✅ Register Slash Commands
const commands = [
    new SlashCommandBuilder()
        .setName("start")
        .setDescription("Set leaderboard updates to every 5 minutes."),
    new SlashCommandBuilder()
        .setName("stop")
        .setDescription("Set leaderboard updates back to every 15 minutes."),
    new SlashCommandBuilder()
        .setName("help")
        .setDescription("Show available bot commands."),
];

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);

async function registerCommands() {
    try {
        console.log("🔄 Registering slash commands...");
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        console.log("✅ Slash commands registered!");
    } catch (error) {
        console.error("❌ Failed to register slash commands:", error);
    }
}

// ✅ Bot Ready Event
client.once("ready", async () => {
    console.log(`✅ Logged in as ${client.user.tag}!`);
    console.log("✅ Default Leaderboard updates every 15 minutes.");
    await registerCommands();
    updateLeaderboardMessage();
    updateIntervalId = setInterval(updateLeaderboardMessage, updateInterval);
});

// ✅ Slash Command Handling
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    switch (interaction.commandName) {
        case "start":
            if (updateIntervalId) clearInterval(updateIntervalId);
            updateInterval = 5 * 60 * 1000;
            updateIntervalId = setInterval(updateLeaderboardMessage, updateInterval);
            await interaction.reply({ content: "✅ Leaderboard updates set to **every 5 minutes**.", ephemeral: true });
            break;

        case "stop":
            if (updateIntervalId) clearInterval(updateIntervalId);
            updateInterval = 15 * 60 * 1000;
            updateIntervalId = setInterval(updateLeaderboardMessage, updateInterval);
            await interaction.reply({ content: "✅ Leaderboard updates set **back to every 15 minutes**.", ephemeral: true });
            break;

        case "help":
            await interaction.reply({
                content: "**📜 Leaderboard Bot Commands:**\n" +
                    "`/start` - Update leaderboard every **5 minutes**\n" +
                    "`/stop` - Update leaderboard every **15 minutes (default)**\n" +
                    "`/help` - Show this command list",
                ephemeral: true,
            });
            break;
    }
});

client.login(process.env.DISCORD_BOT_TOKEN);

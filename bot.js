require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const axios = require("axios");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const STREAM_ELEMENTS_API = `https://api.streamelements.com/kappa/v2/tips/${process.env.STREAM_ELEMENTS_CHANNEL_ID}/leaderboard`;

let leaderboardChannelId = process.env.LEADERBOARD_CHANNEL_ID;
let updateInterval = 15 * 60 * 1000; // Default: 15 minutes
let updateIntervalId = null;

async function fetchLeaderboard() {
    try {
        const response = await axios.get(STREAM_ELEMENTS_API);
        const leaderboard = response.data;

        if (!leaderboard || leaderboard.length === 0) {
            console.log("⚠️ No leaderboard data found.");
            return "No leaderboard data available.";
        }

        let message = "**💰 Top Donators 💰**\n";
        leaderboard.forEach((entry, index) => {
            message += `\n**#${index + 1}** - ${entry.username}: $${entry.amount.toFixed(2)}`;
        });

        message += `\n\n🌟 Donate Here: ${process.env.DONATION_LINK}`;
        return message;
    } catch (error) {
        console.error("❌ Error fetching leaderboard:", error);
        return "⚠️ Failed to fetch leaderboard.";
    }
}

async function updateLeaderboardMessage() {
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
}

client.once("ready", async () => {
    console.log(`✅ Logged in as ${client.user.tag}!`);
    console.log("✅ Default Leaderboard updates every 15 minutes.");
    updateLeaderboardMessage();
    updateIntervalId = setInterval(updateLeaderboardMessage, updateInterval);
});

client.on("messageCreate", async (message) => {
    if (!message.content.startsWith("!")) return;

    const command = message.content.toLowerCase();

    if (command === "!start") {
        clearInterval(updateIntervalId);
        updateInterval = 5 * 60 * 1000; // Change to 5 minutes
        updateIntervalId = setInterval(updateLeaderboardMessage, updateInterval);
        message.reply("✅ Leaderboard updates set to every 5 minutes.");
    }

    if (command === "!stop") {
        clearInterval(updateIntervalId);
        updateInterval = 15 * 60 * 1000; // Back to 15 minutes
        updateIntervalId = setInterval(updateLeaderboardMessage, updateInterval);
        message.reply("✅ Leaderboard updates set back to every 15 minutes.");
    }

    if (command === "!help") {
        message.reply("**📜 Leaderboard Bot Commands:**\n" +
            "`!start` - Update leaderboard every 5 minutes\n" +
            "`!stop` - Update leaderboard every 15 minutes (default)\n" +
            "`!help` - Show this command list");
    }
});

client.login(process.env.DISCORD_BOT_TOKEN);
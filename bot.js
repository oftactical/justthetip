require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const axios = require("axios");
const express = require("express");

// ✅ Express web server for UptimeRobot monitoring
const app = express();
app.get("/", (req, res) => res.send("Leaderboard Bot is running!"));
app.listen(3000, () => console.log("✅ Keep-alive server running on port 3000"));

// ✅ Logging environment variables to confirm they are loaded
console.log("🔍 Checking environment variables...");
["DISCORD_BOT_TOKEN", "STREAM_ELEMENTS_CHANNEL_ID", "LEADERBOARD_CHANNEL_ID", "DONATION_LINK"].forEach((varName) => {
    console.log(`${varName}:`, process.env[varName] ? "✅ Loaded" : "❌ Missing");
});

// ✅ Exit if required environment variables are missing
if (!process.env.DISCORD_BOT_TOKEN || !process.env.STREAM_ELEMENTS_CHANNEL_ID || !process.env.LEADERBOARD_CHANNEL_ID) {
    console.error("❌ Missing required environment variables. Exiting...");
    process.exit(1);
}

// ✅ Initialize Discord bot with correct intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ✅ Construct StreamElements API URL dynamically
const STREAM_ELEMENTS_CHANNEL_ID = process.env.STREAM_ELEMENTS_CHANNEL_ID.trim(); // Ensure no extra spaces or `=`
const STREAM_ELEMENTS_API = `https://api.streamelements.com/kappa/v2/tips/678d81945b43e4feb515e179/leaderboard`;

let leaderboardChannelId = process.env.LEADERBOARD_CHANNEL_ID;
let updateInterval = 15 * 60 * 1000; // Default: 15 minutes
let updateIntervalId = null;
let lastLeaderboardMessage = ""; // Store last leaderboard message to prevent duplicate updates

// ✅ Function to fetch leaderboard data from StreamElements
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

        message += `\n\n🌟 [Donate Here](${process.env.DONATION_LINK})`;
        return message;
    } catch (error) {
        console.error("❌ Error fetching leaderboard:", error.response?.data || error.message);
        return "**⚠️ Failed to fetch leaderboard.**";
    }
}

// ✅ Function to update leaderboard message in Discord
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

        // ✅ Prevent duplicate updates if leaderboard hasn't changed
        if (leaderboardMessage === lastLeaderboardMessage) {
            console.log("✅ Leaderboard unchanged, skipping update.");
            return;
        }

        if (lastMessage) {
            await lastMessage.edit(leaderboardMessage);
        } else {
            await channel.send(leaderboardMessage);
        }

        lastLeaderboardMessage = leaderboardMessage; // ✅ Save last message to prevent redundant updates
        console.log("✅ Leaderboard updated!");
    } catch (error) {
        console.error("❌ Failed to update leaderboard:", error.message);
    }
}

// ✅ Bot startup and automatic leaderboard updates
client.once("ready", async () => {
    console.log(`✅ Logged in as ${client.user.tag}!`);
    console.log("✅ Default Leaderboard updates every 15 minutes.");
    updateLeaderboardMessage();
    updateIntervalId = setInterval(updateLeaderboardMessage, updateInterval);
});

// ✅ Handle commands dynamically
client.on("messageCreate", async (message) => {
    if (!message.content.startsWith("!")) return;

    const command = message.content.toLowerCase();

    if (command === "!start") {
        if (updateIntervalId) clearInterval(updateIntervalId);
        updateInterval = 5 * 60 * 1000; // Change to 5 minutes
        updateIntervalId = setInterval(updateLeaderboardMessage, updateInterval);
        message.reply("✅ Leaderboard updates set to **every 5 minutes**.");
    }

    if (command === "!stop") {
        if (updateIntervalId) clearInterval(updateIntervalId);
        updateInterval = 15 * 60 * 1000; // Back to 15 minutes
        updateIntervalId = setInterval(updateLeaderboardMessage, updateInterval);
        message.reply("✅ Leaderboard updates set **back to every 15 minutes**.");
    }

    if (command === "!help") {
        message.reply("**📜 Leaderboard Bot Commands:**\n" +
            "`!start` - Update leaderboard every **5 minutes**\n" +
            "`!stop` - Update leaderboard every **15 minutes (default)**\n" +
            "`!help` - Show this command list");
    }
});

// ✅ Start the bot with the environment token
client.login(process.env.DISCORD_BOT_TOKEN);

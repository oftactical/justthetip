require("dotenv").config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionsBitField } = require("discord.js");
const axios = require("axios");
const express = require("express");

// ✅ Keep-Alive Web Server (For UptimeRobot)
const app = express();
app.get("/", (req, res) => res.send("TheTipBot is running!"));
app.listen(3000, () => console.log("✅ Keep-alive server running on port 3000"));

// ✅ Validate Required Environment Variables
console.log("🔍 Checking environment variables...");
["DISCORD_BOT_TOKEN", "CLIENT_ID", "DONATION_LINK"].forEach((varName) => {
    if (!process.env[varName]) {
        console.error(`❌ ERROR: Missing environment variable: ${varName}`);
        process.exit(1);
    }
});

// ✅ Load Client ID from Environment Variables
const CLIENT_ID = process.env.CLIENT_ID;

// ✅ Initialize Discord Client
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ✅ Variables (Updated via Commands)
let streamElementsChannelId = null;
let leaderboardChannelId = null; // Now user-configurable
let updateInterval = 15 * 60 * 1000; // Default: 15 minutes
let updateIntervalId = null;
let lastLeaderboardMessage = "";

// ✅ Define Slash Commands
const commands = [
    new SlashCommandBuilder().setName("start").setDescription("Update leaderboard every 5 minutes"),
    new SlashCommandBuilder().setName("stop").setDescription("Update leaderboard every 15 minutes (default)"),
    new SlashCommandBuilder().setName("help").setDescription("Show all available leaderboard commands"),
    new SlashCommandBuilder()
        .setName("setchannel")
        .setDescription("Set the StreamElements Channel ID")
        .addStringOption(option =>
            option.setName("channel_id")
                .setDescription("StreamElements Channel ID (24-character ID)")
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName("setleaderboard")
        .setDescription("Set the Discord channel for leaderboard updates")
        .addChannelOption(option =>
            option.setName("channel")
                .setDescription("Select the Discord channel to send leaderboard updates")
                .setRequired(true)),
].map(command => command.toJSON());

// ✅ Register Slash Commands
const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);

async function registerCommands() {
    try {
        console.log("⏳ Registering slash commands...");
        if (!CLIENT_ID) {
            throw new Error("❌ CLIENT_ID is missing! Set it as an environment variable.");
        }

        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log("✅ Slash commands registered successfully!");
    } catch (error) {
        console.error("❌ Failed to register slash commands:", error);
    }
}

// ✅ Function to Update StreamElements API Channel ID
async function setStreamElementsChannel(channelId) {
    streamElementsChannelId = channelId.trim();
    console.log(`✅ StreamElements Channel ID Updated: ${streamElementsChannelId}`);
}

// ✅ Function to Fetch Leaderboard Data
async function fetchLeaderboard() {
    if (!streamElementsChannelId) {
        return "**⚠️ StreamElements Channel ID Not Set. Use `/setchannel` to configure.**";
    }

    const STREAM_ELEMENTS_API = `https://api.streamelements.com/kappa/v2/tips/${streamElementsChannelId}/leaderboard`;

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

// ✅ Function to Update Leaderboard Message
async function updateLeaderboardMessage() {
    if (!leaderboardChannelId) {
        console.log("⚠️ Leaderboard channel not set. Use `/setleaderboard` to configure.");
        return;
    }

    try {
        const channel = await client.channels.fetch(leaderboardChannelId);
        if (!channel) {
            console.log("⚠️ Leaderboard channel not found.");
            return;
        }

        const messages = await channel.messages.fetch({ limit: 1 });
        const lastMessage = messages.first();
        const leaderboardMessage = await fetchLeaderboard();

        if (leaderboardMessage === lastLeaderboardMessage) {
            console.log("✅ Leaderboard unchanged, skipping update.");
            return;
        }

        if (lastMessage) {
            await lastMessage.edit(leaderboardMessage);
        } else {
            await channel.send(leaderboardMessage);
        }

        lastLeaderboardMessage = leaderboardMessage;
        console.log("✅ Leaderboard updated!");
    } catch (error) {
        console.error("❌ Failed to update leaderboard:", error.message);
    }
}

// ✅ Handle Slash Commands (Now with `/setchannel` & `/setleaderboard`)
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === "start") {
        if (updateIntervalId) clearInterval(updateIntervalId);
        updateInterval = 5 * 60 * 1000; // Change to 5 minutes
        updateIntervalId = setInterval(updateLeaderboardMessage, updateInterval);
        await interaction.reply({ content: "✅ Leaderboard updates set to **every 5 minutes**.", ephemeral: true });
    }

    if (interaction.commandName === "stop") {
        if (updateIntervalId) clearInterval(updateIntervalId);
        updateInterval = 15 * 60 * 1000; // Back to 15 minutes
        updateIntervalId = setInterval(updateLeaderboardMessage, updateInterval);
        await interaction.reply({ content: "✅ Leaderboard updates set **back to every 15 minutes**.", ephemeral: true });
    }

    if (interaction.commandName === "setchannel") {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: "❌ You must be a server admin to use this command.", ephemeral: true });
        }

        const newChannelId = interaction.options.getString("channel_id");

        if (!/^[0-9a-fA-F]{24}$/.test(newChannelId)) {
            return interaction.reply({ content: "❌ Invalid StreamElements Channel ID. Must be a **24-character alphanumeric ID**.", ephemeral: true });
        }

        await setStreamElementsChannel(newChannelId);
        await interaction.reply({
            content: `✅ StreamElements Channel ID updated to: **${newChannelId}**\n📖 Learn more: [StreamElements API Docs](https://dev.streamelements.com/docs/api-docs/ae133ffaf8c1a-personal-access-using-jwt-secert-token-to-access-the-api)`,
            ephemeral: true
        });
    }

    if (interaction.commandName === "setleaderboard") {
        const newChannel = interaction.options.getChannel("channel");

        leaderboardChannelId = newChannel.id;
        console.log(`✅ Leaderboard Channel Updated: ${newChannel.id}`);

        await interaction.reply({ content: `✅ Leaderboard updates will now be sent to: <#${newChannel.id}>`, ephemeral: true });
    }

    if (interaction.commandName === "help") {
        await interaction.reply({
            content: "**📜 Leaderboard Bot Commands:**\n" +
                "`/start` - Update leaderboard every **5 minutes**\n" +
                "`/stop` - Update leaderboard every **15 minutes (default)**\n" +
                "`/setchannel <StreamElements ID>` - Change the StreamElements API\n" +
                "`/setleaderboard <Discord Channel>` - Change the leaderboard channel\n" +
                "`/help` - Show this command list",
            ephemeral: true
        });
    }
});

// ✅ Start Bot
client.once("ready", async () => {
    console.log(`✅ Logged in as ${client.user.tag}!`);
    await updateLeaderboardMessage();
});

// ✅ Start Bot
client.login(process.env.DISCORD_BOT_TOKEN);
registerCommands();
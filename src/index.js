require('dotenv').config(); // Load environment variables from a .env file (DISCORD_TOKEN expected)

const { Client, IntentsBitField, PermissionsBitField } = require('discord.js');  
const storage = require('./storage'); // Module responsible for persisting donation / guild state

// Create a new Discord client instance with the intents the bot needs.
// Intents tell Discord what events the bot wants to receive.
const client = new Client({ 
    intents: [
        IntentsBitField.Flags.Guilds,         // Access to guild (server) related events
        IntentsBitField.Flags.GuildMembers,   // Access to member information (display names, roles)
        IntentsBitField.Flags.GuildMessages,  // Receive guild message events
        IntentsBitField.Flags.MessageContent, // Read the actual message content (required for content checks)
    ],
});

// Simple message response for testing:
// Listens for messageCreate events and replies to "hello" (ignores other bots).
client.on('messageCreate', (message) => {
    if (message.author.bot) {
        return; // Ignore messages from other bots to avoid loops
    }
    if (message.content === 'hello') {
        message.reply('Hello there!'); // Quick check that the bot is responsive
    }
});


// Slash command handling for all registered commands.
// interactionCreate fires for interactions such as slash (chat input) commands.
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return; // Only handle chat input (slash) commands

    const { commandName } = interaction;

    // Dispatch to the correct handler based on the invoked command name
    if (commandName === 'donate') {
        await donate(interaction);
    } else if (commandName === 'refund') {
        await refund(interaction);
    } else if (commandName === 'buy') {
        await buy(interaction);
    } else if (commandName === 'flush') {
        await flush(interaction);
    } else if (commandName === 'contributed') {
        await contributed(interaction);
    } else if (commandName === 'leaderboard') {
        await leaderboard(interaction);
    }
});

// Donate command handler
// Records a user's donation amount and optional note via the storage module.
async function donate(interaction) {
    const amount = interaction.options.getInteger('amount');
    const note = interaction.options.getString('note') || '';

    if (!amount || amount <= 0) {
        // Validation: ensure amount is positive
        return interaction.reply({ content: 'Please provide a positive amount of AUEC.', ephemeral: true });
    }

    try {
        // Prefer the member's display name in the guild, fallback to username
        const memberName = (interaction.member && interaction.member.displayName) ? interaction.member.displayName : interaction.user.username;
        const result = await storage.addDonation(interaction.guildId, interaction.user.id, memberName, amount, note);

        // Build a friendly reply showing the donation and totals
        let reply = `Recorded ${amount} AUEC from **${memberName}.**\nYour total: ${result.userTotal} AUEC\nGuild deposit total: ${result.guildTotal} AUEC`;
        if (note) reply += `\nNote: **${note}**`;
        return interaction.reply({ content: reply });
    } catch (err) {
        console.error('Donation error:', err);
        return interaction.reply({ content: 'Failed to record donation. Try again later.', ephemeral: true });
    }
}

// Refund command handler
// Subtracts a specified amount from a user's recorded contributions.
async function refund(interaction) {
    const amount = interaction.options.getInteger('amount');
    const note = interaction.options.getString('note') || '';

    if (!amount || amount <= 0) {
        return interaction.reply({ content: 'Please provide a positive amount of AUEC to refund.', ephemeral: true });
    }

    try {
        const memberName = (interaction.member && interaction.member.displayName) ? interaction.member.displayName : interaction.user.username;
        const result = await storage.refundDonation(interaction.guildId, interaction.user.id, memberName, amount, note);
        let reply = `Refunded ${amount} AUEC for **${memberName}**.\nYour total: ${result.userTotal} AUEC\nGuild deposit total: ${result.guildTotal} AUEC`;
        if (note) reply += `\nNote: **${note}**`;
        return interaction.reply({ content: reply });
    } catch (err) {
        console.error('Refund error:', err);
        return interaction.reply({ content: err.message || 'Failed to process refund.', ephemeral: true });
    }
}

// Buy command handler
// Admin-only: records a purchase (reduces the guild deposit) with a note describing what's bought.
async function buy(interaction) {
    // Check admin permission
    if (!interaction.memberPermissions || !interaction.memberPermissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({ content: 'Only admins can use this command.', ephemeral: true });
    }

    const amount = interaction.options.getInteger('amount');
    const note = interaction.options.getString('note');

    if (!amount || amount <= 0) {
        return interaction.reply({ content: 'Please provide a positive amount of AUEC.', ephemeral: true });
    }
    if (!note || note.trim().length === 0) {
        return interaction.reply({ content: 'Please provide a note describing what was bought.', ephemeral: true });
    }

    try {
        const adminName = (interaction.member && interaction.member.displayName) ? interaction.member.displayName : interaction.user.username;
        const result = await storage.adminBuy(interaction.guildId, interaction.user.id, adminName, amount, note);
        const reply = `Recorded purchase of ${amount} AUEC by **${adminName}**.\n**Bought: ${note}**\nGuild deposit total: ${result.guildTotal} AUEC`;
        return interaction.reply({ content: reply });
    } catch (err) {
        console.error('Buy error:', err);
        return interaction.reply({ content: err.message || 'Failed to record purchase.', ephemeral: true });
    }
}

// Flush command handler
// Admin-only: clears the guild deposit (e.g., transferring out funds) with a required note/reason.
async function flush(interaction) {
    if (!interaction.memberPermissions || !interaction.memberPermissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({ content: 'Only admins can use this command.', ephemeral: true });
    }

    const note = interaction.options.getString('note');

    if (!note || note.trim().length === 0) {
        return interaction.reply({ content: 'Please provide a reason / note for the flush.', ephemeral: true });
    }

    try {
        const adminName = (interaction.member && interaction.member.displayName) ? interaction.member.displayName : interaction.user.username;
        const result = await storage.flushGuild(interaction.guildId, interaction.user.id, adminName, note);
        const reply = `Flushed guild deposit by **${adminName}**.\nReason: **${note}**\nGuild deposit total: ${result.guildTotal} AUEC`;
        return interaction.reply({ content: reply });
    } catch (err) {
        console.error('Flush error:', err);
        return interaction.reply({ content: err.message || 'Failed to flush guild deposit.', ephemeral: true });
    }
}

// Contributed command handler
// Shows the calling user's total contributions and the guild total.
async function contributed(interaction) {
    try {
        const memberName = (interaction.member && interaction.member.displayName) ? interaction.member.displayName : interaction.user.username;
        const userTotal = await storage.getUserTotal(interaction.guildId, interaction.user.id);
        const guildTotal = await storage.getGuildTotal(interaction.guildId);
        const reply = `**${memberName}**, you have contributed **${userTotal}** AUEC.\nGuild deposit total: **${guildTotal}** AUEC`;
        return interaction.reply({ content: reply });
    } catch (err) {
        console.error('Contributed error:', err);
        return interaction.reply({ content: 'Failed to retrieve contribution data.', ephemeral: true });
    }
}

// Leaderboard command handler
// Retrieves and formats the top contributors for the guild.
async function leaderboard(interaction) {
    try {
        const leaderboard = await storage.getLeaderboard(interaction.guildId);
        if (leaderboard.length === 0) {
            return interaction.reply({ content: 'No contributions recorded yet.' });
        }
        let reply = '**Guild Deposit Leaderboard**\n\n';
        leaderboard.forEach((user, index) => {
            reply += `${index + 1}. **${user.name}** - ${user.total} AUEC\n`;
        });
        const guildTotal = await storage.getGuildTotal(interaction.guildId);
        reply += `\n**Guild Total: ${guildTotal} AUEC**`;
        return interaction.reply({ content: reply });
    } catch (err) {
        console.error('Leaderboard error:', err);
        return interaction.reply({ content: 'Failed to retrieve leaderboard data.', ephemeral: true });
    }
}

// Login the bot using the token from environment variables.
// On success, prints "Bot is online"; on failure logs and exits.
client.login(process.env.DISCORD_TOKEN)
  .then(() => console.log('Bot is online'))
  .catch(err => {
    console.error('Failed to login:', err);
    process.exit(1);
  });



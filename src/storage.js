const fs = require('fs').promises;
const path = require('path');

const DB_PATH = path.join(__dirname, 'data.json');

async function loadData() {
    try {
        const raw = await fs.readFile(DB_PATH, 'utf8');
        return JSON.parse(raw);
    } catch {
        return {}; // empty DB
    }
}

async function saveData(data) {
    await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

async function addDonation(guildId, userId, username, amount, note = '') {
    const data = await loadData();
    if (!data[guildId]) {
        data[guildId] = { total: 0, users: {}, ledger: [] };
    }
    const guild = data[guildId];
    guild.total = (guild.total || 0) + amount;
    guild.users[userId] = (guild.users[userId] || { name: username, total: 0 });
    guild.users[userId].name = username;
    guild.users[userId].total += amount;
    guild.ledger.push({
        ts: new Date().toISOString(),
        userId,
        username,
        amount,
        note,
        type: 'donation',
    });
    await saveData(data);
    return { guildTotal: guild.total, userTotal: guild.users[userId].total };
}

async function refundDonation(guildId, userId, username, amount, note = '') {
    const data = await loadData();
    if (!data[guildId] || !data[guildId].users || !data[guildId].users[userId]) {
        throw new Error('No recorded contributions found for you in this guild.');
    }
    if (amount <= 0) {
        throw new Error('Refund amount must be a positive integer.');
    }

    const guild = data[guildId];
    const user = guild.users[userId];

    if (amount > user.total) {
        throw new Error('Refund amount exceeds your contributed total.');
    }

    user.total -= amount;
    guild.total = (guild.total || 0) - amount;

    guild.ledger.push({
        ts: new Date().toISOString(),
        userId,
        username,
        amount: -amount,
        note,
        type: 'refund',
    });

    await saveData(data);
    return { guildTotal: guild.total, userTotal: user.total };
}

// Admin-only: record a purchase paid from the guild deposit
async function adminBuy(guildId, adminId, adminName, amount, note = '') {
    if (amount <= 0) {
        throw new Error('Purchase amount must be a positive integer.');
    }
    const data = await loadData();
    if (!data[guildId]) {
        throw new Error('No guild deposit exists or insufficient funds.');
    }
    const guild = data[guildId];
    const total = (guild.total || 0);
    if (amount > total) {
        throw new Error('Not enough guild deposit to cover this purchase.');
    }
    guild.total = total - amount;

    guild.ledger.push({
        ts: new Date().toISOString(),
        adminId,
        adminName,
        amount: -amount,
        note,
        type: 'purchase',
    });

    await saveData(data);
    return { guildTotal: guild.total };
}

// Admin-only: flush the guild deposit and reset all user contributions
async function flushGuild(guildId, adminId, adminName, note = '') {
    const data = await loadData();
    if (!data[guildId]) {
        throw new Error('No guild data to flush.');
    }
    const guild = data[guildId];
    const prevTotal = (guild.total || 0);

    // create ledger entry even if prevTotal is 0
    guild.ledger.push({
        ts: new Date().toISOString(),
        adminId,
        adminName,
        amount: -prevTotal,
        note,
        type: 'flush',
    });

    // reset totals
    guild.total = 0;
    if (guild.users) {
        for (const uid of Object.keys(guild.users)) {
            guild.users[uid].total = 0;
        }
    }

    await saveData(data);
    return { guildTotal: guild.total };
}

async function getGuildTotal(guildId) {
    const data = await loadData();
    return (data[guildId] && data[guildId].total) || 0;
}

async function getUserTotal(guildId, userId) {
    const data = await loadData();
    return (data[guildId] && data[guildId].users && data[guildId].users[userId] && data[guildId].users[userId].total) || 0;
}

async function getLeaderboard(guildId) {
    const data = await loadData();
    if (!data[guildId] || !data[guildId].users) {
        return [];
    }
    const users = Object.entries(data[guildId].users)
        .map(([userId, userData]) => ({
            userId,
            name: userData.name,
            total: userData.total,
        }))
        .filter(u => u.total > 0)
        .sort((a, b) => b.total - a.total);
    return users;
}

module.exports = {
    addDonation,
    getGuildTotal,
    getUserTotal,
    refundDonation,
    adminBuy,
    flushGuild,
    getLeaderboard,
};
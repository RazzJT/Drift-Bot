require('dotenv').config();
const { REST, Routes,  } = require('discord.js');

const commands = [
    {
        name: 'hey',
        description: 'Replies with hey!',
    },
    {
        name: 'donate',
        description: 'Donate AUEC to guild deposit',
        options: [
            {
                name: 'amount',
                description: 'Amount of AUEC to donate',
                type: 4, // INTEGER
                required: true,
            },
            {
                name: 'note',
                description: 'Optional note',
                type: 3, // STRING
                required: false,
            },
        ],
    },
    {
        name: 'refund',
        description: 'Refund AUEC from your own contributions',
        options: [
            {
                name: 'amount',
                description: 'Amount of AUEC to refund (must not exceed your contributed total)',
                type: 4, // INTEGER
                required: true,
            },
            {
                name: 'note',
                description: 'Optional note for the refund',
                type: 3, // STRING
                required: false,
            },
        ],
    },
    {
        name: 'buy',
        description: 'Record a purchase paid from the guild deposit (admin only)',
        options: [
            {
                name: 'amount',
                description: 'Amount of AUEC spent',
                type: 4, // INTEGER
                required: true,
            },
            {
                name: 'note',
                description: 'What was bought (required)',
                type: 3, // STRING
                required: true,
            },
        ],
    },
    {
        name: 'flush',
        description: 'Flush (clear) the guild deposit and reset contributions (admin only)',
        options: [
            {
                name: 'note',
                description: 'Reason / description for the flush (required)',
                type: 3, // STRING
                required: true,
            },
        ],
    },
    {
        name: 'contributed',
        description: 'Check your contribution total to the guild deposit',
    },
    {
        name: 'leaderboard',
        description: 'View the top contributors to the guild deposit',
    },
];

 const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('Registering commands...');
    
        await rest.put(
            Routes.applicationGuildCommands(
                process.env.CLIENT_ID,
                process.env.GUILD_ID
            ),
            
            { body: commands },
        
        )

    console.log('Commands registered successfully!');
    
} catch (error) {
        console.log('There was an error:', error);
    }
})();
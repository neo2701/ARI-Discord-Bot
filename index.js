// Discord bot that periodically fetches ARMA Reforger server stats and updates
// presence + a status message, and exposes a /server slash command.

const { Client, Events, GatewayIntentBits, ActivityType, REST, Routes, EmbedBuilder } = require('discord.js');
require('dotenv').config();
// Using GameDig-based stats now
const { fetchServerStats } = require('./gamedig');

// ----- Environment Variables -----
// DISCORD_TOKEN          - Bot token
// APPLICATION_ID         - Bot application (client) id
// GUILD_ID               - Guild to register guild-only slash commands (faster deploy)
// STATUS_CHANNEL_ID      - Channel containing the status message
// STATUS_MESSAGE_ID      - (Optional) Existing message to edit. If absent, bot will create one and log its ID.
// STATS_REFRESH_SECONDS  - (Optional) Refresh interval (default 60)

const token = process.env.DISCORD_TOKEN;
const appId = process.env.APPLICATION_ID;
const guildId = process.env.GUILD_ID;
const statusChannelId = process.env.STATUS_CHANNEL_ID;
let statusMessageId = process.env.STATUS_MESSAGE_ID; // may be undefined -> we'll create
const refreshSeconds = parseInt(process.env.STATS_REFRESH_SECONDS || '60', 10);

if (!token) {
	console.error('Missing DISCORD_TOKEN in environment. Exiting.');
	process.exit(1);
}
if (!appId) {
	console.error('Missing APPLICATION_ID in environment. Exiting.');
	process.exit(1);
}

// Create client
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Simple in-memory cache of last stats
let lastStats = null;

// Register (or update) slash commands (guild-scoped for instant availability)
async function registerCommands() {
	if (!guildId) {
		console.warn('GUILD_ID not provided; skipping guild command registration. (Global commands can take up to an hour to appear.)');
	}
	const commands = [
		{
			name: 'server',
			description: 'Show current ARMA Reforger server status & player list.'
		}
	];
	const rest = new REST({ version: '10' }).setToken(token);
	try {
		if (guildId) {
			await rest.put(Routes.applicationGuildCommands(appId, guildId), { body: commands });
			console.log('Registered guild slash commands.');
		} else {
			await rest.put(Routes.applicationCommands(appId), { body: commands });
			console.log('Registered global slash commands.');
		}
	} catch (err) {
		console.error('Failed to register slash commands:', err);
	}
}

// Format an embed from stats
function buildEmbed(stats) {
	const now = new Date();
	const playerCount = `${stats.players}/${stats.maxPlayers}`;
	const capacity = stats.capacityPct?.toFixed(1) || '0.0';
	const ping = stats.online && stats.ping != null ? `${stats.ping} ms` : '—';
	const version = stats.version || 'Unknown';
	const mapName = stats.map || 'Unknown';
	const host = stats.host || 'Unknown';
	const port = stats.port || 'Unknown';

	// Helper: progress bar (10 segments)
	function bar(pct) {
		const total = 10;
		const filled = Math.min(total, Math.round((pct / 100) * total));
		const filledChar = '▰';
		const emptyChar = '▱';
		return filledChar.repeat(filled) + emptyChar.repeat(total - filled);
	}

	const capacityBar = bar(stats.capacityPct || 0);
	// Dynamic additions
	let uptimeStr = 'N/A';
	if (stats.uptimeSeconds) {
		const d = Math.floor(stats.uptimeSeconds / 86400);
		const h = Math.floor((stats.uptimeSeconds % 86400) / 3600);
		const m = Math.floor((stats.uptimeSeconds % 3600) / 60);
		uptimeStr = `${d}d ${h}h ${m}m`;
	}
	const cpuLoadStr = stats.cpuAvgLoad != null ? `${stats.cpuAvgLoad.toFixed(1)}%` : 'N/A';
	const cpuHzStr = stats.cpuAvgHz != null ? `${stats.cpuAvgHz} MHz` : '';

	const color = stats.online ? 0x00a86b : 0xcc3333;
	const statusLine = stats.online ? '🟢 Online' : '🔴 Offline';

	const embed = new EmbedBuilder()
		.setColor(color)
		.setTitle(`**${stats.name}**`)
		.setDescription(`**Status:** ${statusLine}${!stats.online && stats.reason ? ` (${stats.reason})` : ''}\n**Last Check:** ${now.toLocaleTimeString()}\n\u200B`)
		.addFields(
			{ name: ':bust_in_silhouette: Players', value: `${playerCount}\n${capacityBar} (${capacity}%)`, inline: true },
			{ name: ':map: Map', value: `${mapName}\nVersion: ${version}`, inline: true },
			// { name: ':ping_pong: Ping', value: ping, inline: true },
			// { name: 'CPU', value: `${cpuLoadStr}\n${cpuHzStr}`, inline: true },
			// { name: 'Uptime', value: uptimeStr, inline: true },
			// { name: 'Address', value: `${host}:${port}`, inline: true },
			// { name: 'Password', value: stats.password ? 'Yes 🔒' : 'No 🔓', inline: true },
		)
		.setFooter({ text: `Updated • ${now.toLocaleString()}` });
	return embed;
}

async function updatePresenceAndMessage() {
	try {
		const stats = await fetchServerStats();
		lastStats = stats;
		const playersStr = `${stats.players}/${stats.maxPlayers}`;
		if (client.user) {
			if (stats.online) {
				client.user.setActivity({ name: `Server Online | Players ${playersStr}`, type: ActivityType.Custom });
			} else {
				client.user.setActivity({ name: 'Server Offline', type: ActivityType.Custom });
			}
		}
		if (statusChannelId) {
			const channel = await client.channels.fetch(statusChannelId).catch(() => null);
			if (channel && channel.isTextBased()) {
				let msg = null;
				if (statusMessageId) {
					msg = await channel.messages.fetch(statusMessageId).catch(() => null);
				}
				const content = ``;
				if (msg) {
					await msg.edit({ content, embeds: [buildEmbed(stats)] });
				} else {
					const newMsg = await channel.send({ content, embeds: [buildEmbed(stats)] });
					if (!statusMessageId) {
						statusMessageId = newMsg.id;
						console.log('Created status message. Set STATUS_MESSAGE_ID to:', statusMessageId);
					}
				}
			}
		}
	} catch (err) {
		console.error('Error updating presence/message:', err.message);
	}
}

client.once(Events.ClientReady, async ready => {
	console.log(`Ready! Logged in as ${ready.user.tag}`);
	await registerCommands();
	await updatePresenceAndMessage();
	setInterval(updatePresenceAndMessage, refreshSeconds * 1000);
});

client.on(Events.InteractionCreate, async (interaction) => {
	if (!interaction.isChatInputCommand()) return;
	if (interaction.commandName === 'server') {
		await interaction.deferReply({ ephemeral: true });
		try {
			if (!lastStats) {
				await updatePresenceAndMessage();
			}
			if (lastStats) {
				await interaction.editReply({ embeds: [buildEmbed(lastStats)] });
			} else {
				await interaction.editReply('No stats available right now. Try again shortly.');
			}
		} catch (err) {
			console.error('/server command error:', err);
			if (interaction.deferred || interaction.replied) {
				await interaction.editReply('Failed to fetch stats.');
			}
		}
	}
});

client.login(token);

// Export for testing if needed
module.exports = { client, updatePresenceAndMessage };
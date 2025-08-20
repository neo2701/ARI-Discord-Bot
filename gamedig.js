const { GameDig } = require('gamedig');

// Minimal GameDig wrapper returning only fields the bot currently uses.
async function fetchServerStats() {
    const host = process.env.SERVER_HOST;
    const port = Number(process.env.SERVER_QUERY_PORT) || undefined;
    if (!host) {
        return offline('No host provided');
    }
    try {
        const state = await GameDig.query({ type: 'armareforger', host, port });
        const players = state.players?.length || 0;
        const maxPlayers = state.maxplayers || state.maxPlayers || 0;
        return {
            online: true,
            status: 'online',
            name: state.name || 'Server',
            map: state.map || state.raw?.map || 'Unknown',
            players,
            maxPlayers,
            capacityPct: maxPlayers ? (players / maxPlayers) * 100 : 0,
            _raw: state // retained for potential future expansion
        };
    } catch (err) {
        return offline(err.message);
    }
}

function offline(reason) {
    return {
        online: false,
        status: 'offline',
        reason,
        name: 'Server Offline',
        map: 'Unknown',
        players: 0,
        maxPlayers: 0,
        capacityPct: 0,
        _raw: null
    };
}

module.exports = { fetchServerStats };
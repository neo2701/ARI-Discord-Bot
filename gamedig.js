const { GameDig } = require('gamedig');

// Translate GameDig response to structure used previously in buildEmbed.
async function fetchServerStats() {
    const host = process.env.SERVER_HOST;
    const port = Number(process.env.SERVER_QUERY_PORT) || undefined;
    if (!host) {
        return offline('No host provided');
    }
    try {
        const state = await GameDig.query({ type: 'armareforger', host, port });
        // console.log(state);
        const players = state.players?.length || 0;
        const maxPlayers = state.maxplayers || state.maxPlayers || 0;
        const playerNames = (state.players || []).map(p => p.name).filter(Boolean);
        return {
            online: true,
            status: 'online',
            name: state.name || 'Server',
            map: state.map || state.raw?.map || 'Unknown',
            password: !!state.password || false,
            players,
            maxPlayers,
            playerNames,
            version: state.version,
            // ping: state.ping,
            host,
            port: port || state.query?.port || state.raw?.queryPort,
            connect: `${host}:${port || ''}`,
            uptimeSeconds: null,
            capacityPct: maxPlayers ? (players / maxPlayers) * 100 : 0,
            cpuAvgLoad: null,
            cpuAvgHz: null,
            shellPingMs: null,
            tcpPingMs: null,
            _raw: state
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
        password: false,
        players: 0,
        maxPlayers: 0,
        playerNames: [],
        version: undefined,
        ping: undefined,
        host: process.env.SERVER_HOST,
        port: process.env.SERVER_QUERY_PORT,
        connect: undefined,
        uptimeSeconds: null,
        capacityPct: 0,
        cpuAvgLoad: null,
        cpuAvgHz: null,
        shellPingMs: null,
        tcpPingMs: null,
        _raw: null
    };
}

module.exports = { fetchServerStats };
// stats.js - fetch and normalize ARMA Reforger server stats
// The source API returns HTML-wrapped JSON (<pre>...</pre>). We strip tags then parse.

const SERVER_URL = process.env.ARMA_SERVER_API || 'https://qonzer.live/qV3/index.php?g=armareforger&q=74.63.203.34:2001&p=2&e=1';
const DYNAMIC_URL = process.env.DYNAMIC_SERVER_API || 'https://gl-sgp12-ln.qonzer.net/dynamicServerData.json?v=1755357541952';
const ENABLE_SHELL_PING = (process.env.ENABLE_SHELL_PING || 'true').toLowerCase() === 'true';
const ENABLE_TCP_PING = (process.env.ENABLE_TCP_PING || 'true').toLowerCase() === 'true';

const { exec } = require('child_process');
const net = require('net');

function isValidHost(host) {
  return /^[A-Za-z0-9_.:-]+$/.test(host || '');
}

function shellPing(host) {
  return new Promise(resolve => {
    if (!ENABLE_SHELL_PING) return resolve(undefined);
    if (!isValidHost(host)) return resolve(undefined);
    exec(`ping -c 1 -n ${host}`, { timeout: 5000 }, (err, stdout) => {
      if (err) return resolve(undefined);
      const match = stdout.match(/time=([0-9.]+)/);
      if (match) return resolve(parseFloat(match[1]));
      resolve(undefined);
    });
  });
}

function tcpPing(host, port) {
  return new Promise(resolve => {
    if (!ENABLE_TCP_PING) return resolve(undefined);
    if (!isValidHost(host)) return resolve(undefined);
    const start = Date.now();
    const socket = net.connect({ host, port: Number(port) || 80 });
    const timeout = setTimeout(() => { socket.destroy(); resolve(undefined); }, 4000);
    socket.once('connect', () => {
      clearTimeout(timeout);
      const ms = Date.now() - start;
      socket.destroy();
      resolve(ms);
    });
    socket.once('error', () => {
      clearTimeout(timeout);
      resolve(undefined);
    });
  });
}

async function fetchServerStats() {
  let text;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(SERVER_URL, { signal: controller.signal });
    clearTimeout(timeout);
    text = await res.text();
  } catch (e) {
    return offlineStats('Network error');
  }

  // Remove <pre> wrappers and attempt to isolate JSON braces in case of trailing markup
  let cleaned = text.replace(/<pre>/ig, '')
    .replace(/<pre\/>/ig, '')
    .replace(/<\/pre>/ig, '');

  // Sometimes junk might precede/append JSON; attempt to extract between first { and last }
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first === -1 || last === -1) {
    return offlineStats('No JSON found');
  }
  cleaned = cleaned.slice(first, last + 1);

  let raw;
  try {
    raw = JSON.parse(cleaned);
  } catch (err) {
    return offlineStats('Failed JSON parse');
  }
  // raw.players appears to be an array of player objects; player count may be separate.
  const playersArray = Array.isArray(raw.raw?.players) ? raw.raw.players : Array.isArray(raw.players) ? raw.players : [];
  const players = playersArray.length;
  const maxPlayers = raw.raw?.maxplayers ?? raw.maxplayers ?? raw.maxPlayers ?? 0;
  // Player names may appear in raw.playersDetail or similar structures; attempt to extract
  let playerNames = [];
  if (Array.isArray(raw.playersDetail)) {
    playerNames = raw.playersDetail.map(p => p.name).filter(Boolean);
  } else if (Array.isArray(playersArray)) { // fallback if players is array of objects
    playerNames = playersArray.map(p => (typeof p === 'string' ? p : p.name)).filter(Boolean);
  }
  // Sanitize & limit player names
  playerNames = playerNames.map(n => n.trim()).filter(n => n.length > 0 && n.length <= 32).slice(0, 100);

  // Additional metadata for richer embeds
  const version = raw.version || raw.raw?.version;
  const ping = raw.ping; // API-provided ping
  const connect = raw.connect; // ip:port
  const host = connect ? connect.split(':')[0] : undefined;
  const port = raw.queryPort || (connect ? connect.split(':')[1] : undefined);
  const uptimeSeconds = null; // Not provided by this API
  const capacityPct = maxPlayers ? (players / maxPlayers) * 100 : 0;
  // Fetch dynamic server performance data (non-fatal if fails)
  let dyn = null;
  try {
    const dynRes = await fetch(DYNAMIC_URL, { method: 'GET' });
    const dynText = await dynRes.text();
    dyn = JSON.parse(dynText);
  } catch (_) {
    dyn = null;
  }

  // Attempt to interpret dynamic data structure
  let cpuAvgLoad = null;
  let cpuAvgHz = null;
  let uptimeSecondsDyn = null;
  if (Array.isArray(dyn)) {
    // dyn[0] appears to be array with aggregate load
    if (Array.isArray(dyn[0]) && dyn[0][0]) {
      cpuAvgLoad = dyn[0][0].load ?? null;
      cpuAvgHz = dyn[0][0].avgHz ?? null;
    }
    // Uptime appears near end: search recursively for object with 'uptime'
    const flat = JSON.stringify(dyn);
    // Not robust parse; below we try structured extraction too
    for (const segment of dyn) {
      if (Array.isArray(segment)) {
        for (const obj of segment) {
          if (obj && typeof obj === 'object' && 'uptime' in obj) {
            uptimeSecondsDyn = obj.uptime;
          }
          if (obj && typeof obj === 'object' && obj.updhms) {
            // Could convert later if needed
          }
        }
      } else if (segment && typeof segment === 'object' && 'uptime' in segment) {
        uptimeSecondsDyn = segment.uptime;
      }
    }
  }

  // Perform host pings (non-blocking heavy operations could be parallel; here sequential for simplicity)
  let shellPingMs, tcpPingMs;
  if (host) {
    try { shellPingMs = await shellPing(host); } catch (_) { shellPingMs = undefined; }
    if (!shellPingMs && port) {
      try { tcpPingMs = await tcpPing(host, port); } catch (_) { tcpPingMs = undefined; }
    } else if (port) {
      // Optionally still get tcp ping for comparison
      try { tcpPingMs = await tcpPing(host, port); } catch (_) { tcpPingMs = undefined; }
    }
  }

  return {
    online: true,
    status: 'online',
    name: raw.name || 'Server',
    map: raw.map || 'Unknown',
    password: !!raw.password,
    players: Number(players) || 0,
    maxPlayers: Number(maxPlayers) || 0,
    playerNames,
    version,
    ping,
    host,
    port,
    connect,
    uptimeSeconds: uptimeSecondsDyn ?? uptimeSeconds,
    capacityPct,
    cpuAvgLoad,
    cpuAvgHz,
    shellPingMs,
    tcpPingMs,
    _raw: raw
  };
}

function offlineStats(reason) {
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
    host: undefined,
    port: undefined,
    connect: undefined,
    uptimeSeconds: null,
    capacityPct: 0,
    _raw: null
  };
}

module.exports = { fetchServerStats };

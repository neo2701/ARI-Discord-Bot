# ARI Discord Bot

Discord bot for ARMA Reforger server status (players + map).

## Quick Start
```bash
cp .env.example .env   # fill values
npm install
npm start
```

## Required ENV
```
DISCORD_TOKEN=...
APPLICATION_ID=...
GUILD_ID=...
STATUS_CHANNEL_ID=...
STATUS_MESSAGE_ID=...      # optional (will be created if missing)
SERVER_HOST=74.63.203.34   # Game server host
SERVER_QUERY_PORT=2001
STATS_REFRESH_SECONDS=60
```

## Docker
```bash
docker compose up --build -d
```

## Command
`/server` – returns current cached stats.

## License
MIT

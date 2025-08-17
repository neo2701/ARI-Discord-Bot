# ARI Discord Bot

Discord bot that periodically fetches ARMA Reforger server stats and:
- Updates its presence with current player counts
- Edits (or creates) a status message in a channel
- Offers a `/server` slash command for on-demand stats (ephemeral response)

## Features
- Periodic polling (configurable interval)
- Slash command registration (guild-scoped for instant availability)
- Graceful handling of missing data
- Player list (first 20 names) shown in embed if available

## Requirements
- Node.js 18+ (for built-in `fetch`)
- A Discord application & bot token

## Environment Variables
Create a `.env` file (never commit secrets):

```
DISCORD_TOKEN=YOUR_BOT_TOKEN
APPLICATION_ID=YOUR_APP_ID
GUILD_ID=YOUR_GUILD_ID              # Recommended for fast command updates
STATUS_CHANNEL_ID=CHANNEL_ID_FOR_STATUS_MESSAGE
STATUS_MESSAGE_ID=OPTIONAL_EXISTING_MESSAGE_ID
STATS_REFRESH_SECONDS=60            # Optional (default 60)
ARMA_SERVER_API=https://qonzer.live/qV3/index.php?g=armareforger&q=74.63.203.34:2001&p=2&e=1
```

If `STATUS_MESSAGE_ID` is not provided the bot will send a new message and log the new ID (copy it into your `.env` for future runs to edit instead of creating new messages).

## Install & Run

```
npm install
npm start
```

Or for development (auto-restart not included—add nodemon if desired):

```
npm run dev
```

## Slash Commands
Currently provided:
- `/server` – Shows the latest cached stats (forces an update if none yet). Reply is ephemeral to avoid clutter.

## Customization
- Adjust `STATS_REFRESH_SECONDS` to change polling frequency.
- Change `ARMA_SERVER_API` to point at a different server or wrapper endpoint.

## Future Ideas
- Add command to switch between multiple tracked servers
- Persist last stats to disk for restart continuity
- Add uptime and performance metrics

## License
MIT (add a LICENSE file if needed)

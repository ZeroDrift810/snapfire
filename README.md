# iMoveChainz Discord Bot

**Keeper of Knowledge** for iMoveChainz Lab - Premium Madden/Football IQ Bot

## Quick Start

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript
npm run deploy       # Register Discord commands
npm run start        # Start bot (production)
```

For development:
```bash
npm run dev          # Start with hot reload (tsx)
```

## Configuration

1. Copy `.env.example` to `.env`
2. Add your Discord credentials:

```env
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
DISCORD_GUILD_ID=your_guild_id
```

Get credentials at https://discord.com/developers/applications:
- **BOT_TOKEN**: Bot > Reset Token
- **CLIENT_ID**: OAuth2 > General > Application ID
- **GUILD_ID**: Your server ID (right-click server > Copy ID)

## Commands

| Command | Description |
|---------|-------------|
| `/concept` | Look up football concepts (PASS, RUN, RPO, SCREEN, TRICK) |
| `/coverage` | Look up defensive coverages (Cover 0-4, special shells) |
| `/scheme` | Premium SnapFire/Shinobi plays with routes & reads |

## Knowledge Base

| Category | Count | Description |
|----------|-------|-------------|
| Concepts | 267 | General football concepts |
| Coverages | 62 | Defensive coverage shells |
| Schemes | 890 | Premium play schemes |

### Scheme Breakdown
- **SnapFire Offense** (451 plays) - Offensive playbook
- **Shinobi Defense** (439 plays) - Defensive playbook

## Project Structure

```
src/
├── index.ts              # Bot entry point
├── deploy-commands.ts    # Command registration
├── commands/             # Slash command handlers
│   ├── concept.ts
│   ├── coverage.ts
│   └── scheme.ts
└── knowledge/
    ├── types.ts          # TypeScript interfaces
    └── loader.ts         # Knowledge base loader

data/                     # Knowledge base JSON files
master_data/              # Source playbook data
assets/play_art/          # Play diagram images
tools/                    # Data export utilities
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run start` | Run compiled bot (production) |
| `npm run dev` | Run with tsx (development) |
| `npm run deploy` | Register slash commands with Discord |
| `npm run export-playbook` | Generate scheme data from master playbooks |

## Tech Stack

- **Runtime**: Node.js >= 18.0.0
- **Language**: TypeScript 5.3
- **Framework**: discord.js 14.14
- **Dev Tools**: tsx, rimraf

## Branding

- **SnapFire Offense**: Orange theme (#E36414)
- **Shinobi Defense**: Dark grey theme (#2C3E50)

## License

MIT

# iMoveChainz Discord Bot

**Keeper of Knowledge** for iMoveChainz Lab. Football IQ for Madden and CFB.

This bot is fully button-driven. There are no slash commands. Players open a posted hub
panel and navigate entirely by tapping: pick a track, filter, page through, and tap a play
to see its breakdown with the matching in-game play art.

## Quick Start

```bash
npm install          # Install dependencies
npm run smoke        # Validate all routing and buttons (no Discord needed)
npm run build        # Compile TypeScript
npm run start        # Start the bot (production)
```

For development:
```bash
npm run dev          # Start with tsx (hot path)
```

Once the bot is running, post the hub panel into a channel (one time per channel):
```bash
# set HUB_CHANNEL_ID in .env first
npm run post-hub
```
The buttons on the posted message are stateless, so the running bot handles every tap
afterward. No re-posting needed.

## Configuration

1. Copy `.env.example` to `.env`
2. Add your Discord credentials and the hub channel:

```env
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
HUB_CHANNEL_ID=channel_id_for_the_hub_panel
```

Get credentials at https://discord.com/developers/applications:
- **BOT_TOKEN**: Bot > Reset Token
- **CLIENT_ID**: OAuth2 > General > Application ID
- **HUB_CHANNEL_ID**: right-click the target channel > Copy ID

## How players use it

1. They see the **hub panel** in the channel with six tracks: Terms, Coverages,
   Concepts, Fronts, Usering, Playbook.
2. Tapping a track opens a **private session** (only they see it).
3. In a session they page through a list and pick an item from the menu. Playbook
   filters by SnapFire / Shinobi.
4. The **detail page** teaches it: what it is, how it lines up, the void or the read,
   how to beat or apply it, and the in-game user tip. Playbook entries attach play art.
5. **Related terms are tappable** ("tap to learn"): jump from a coverage to the concept
   that beats it, or to the glossary definition of any term. Back and Home move around.

## Knowledge Base

Teaching content is sourced from the iMoveChainz V2 system (the 192-page strategy book,
the defensive front/coverage tables, and the play databases).

| Track | Count | Description |
|-------|-------|-------------|
| Terms (glossary) | 52 | Plain-language definitions, every term explained |
| Coverages | 12 | Correct shells, the void, how to beat each, in-game user tip |
| Concepts | 11 | Offensive concepts with the conflict-defender read |
| Fronts | 7 | Defensive fronts and what beats each |
| Usering | 11 | The iMoveChainz DB-usering system (Madden application) |
| Playbook | 890 | SnapFire offense + Shinobi defense schemes with play art |

Authored knowledge lives in `content/*.json`. The playbook/art lives in `data/` + `assets/`.

## Project Structure

```
src/
├── index.ts            # Bot entry point (gateway + interaction routing)
├── router.ts           # Pure resolve() + live handler for buttons/select menus
├── ui/
│   ├── ids.ts          # customId grammar + track/facet definitions
│   └── views.ts        # hub, list, and teaching-card / scheme detail builders
├── content/
│   └── cards.ts        # Teaching-card loader (glossary/coverage/concept/front/usering)
└── knowledge/
    ├── types.ts        # TypeScript interfaces + branding
    └── loader.ts       # Scheme (playbook) loader

content/                # Authored teaching knowledge (the sourced V2 content)
│   ├── glossary.json
│   ├── coverages.json
│   ├── concepts.json
│   ├── fronts.json
│   └── usering.json

scripts/
├── post-hub.ts         # Post the hub panel to a channel (operator script)
└── smoke-test.ts       # Walk every route/button; render every card + scheme; verify links

data/                   # Scheme (playbook) JSON
master_data/            # Source playbook data
assets/play_art/        # Play diagram images (matched to in-game art)
tools/                  # Data export utilities
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run smoke` | Validate all routing and buttons offline (no Discord connection) |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run start` | Run compiled bot (production) |
| `npm run dev` | Run with tsx (development) |
| `npm run post-hub` | Post the hub panel to `HUB_CHANNEL_ID` |
| `npm run export-playbook` | Regenerate scheme data from master playbooks |

## Tech Stack

- **Runtime**: Node.js >= 18.0.0
- **Language**: TypeScript 5.3
- **Framework**: discord.js 14.x
- **Dev Tools**: tsx, rimraf

## Branding

- **SnapFire Offense**: Orange theme (#E36414)
- **Shinobi Defense**: Dark grey theme (#2C3E50)

## License

MIT

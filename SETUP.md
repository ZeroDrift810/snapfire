# iMoveChainz Bot - Setup Instructions

## Step 1: Extract Files

Extract all files to: `D:\Projects\iMoveChainzBot\`

## Step 2: Install Node.js

Download from: https://nodejs.org/ (Version 18 or higher)

## Step 3: Install Dependencies

```powershell
cd D:\Projects\iMoveChainzBot
npm install
```

## Step 4: Configure Discord Bot

1. Visit: https://discord.com/developers/applications
2. Create New Application
3. Go to "Bot" section:
   - Reset Token → Copy it
4. Go to "OAuth2" → "General":
   - Copy Application ID
5. Edit `.env` file and add:
   ```
   DISCORD_BOT_TOKEN=your_token_here
   DISCORD_CLIENT_ID=your_client_id_here
   DISCORD_GUILD_ID=your_server_id (optional)
   ```

## Step 5: Deploy Commands

```powershell
npm run deploy
```

## Step 6: Start the Bot

```powershell
npm run dev
```

## Test in Discord

- `/concept mesh`
- `/coverage cover_2`
- `/scheme mesh`

## Files Included

- ✅ Source code (TypeScript)
- ✅ Configuration files
- ✅ Sample data (3 concepts, 3 coverages, 3 schemes)
- ✅ Package.json with all dependencies

## Need Help?

Check README.md for full documentation.

## Current Status

Phase 3 Complete - Bot connects and shows placeholder embeds.
Phase 4-5 upcoming: Full command implementation with autocomplete.

---

**Created:** December 1, 2025
**Version:** 1.0.0

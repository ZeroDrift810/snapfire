# 🖥️ Cross-PC Setup Guide for iMoveChainz Bot

## Overview

This guide explains how to set up iMoveChainz Bot across **two separate PCs**:

- **PC 1 (Export Machine)** - Where you process your playbook data
- **PC 2 (Bot Machine)** - Where the Discord bot runs

---

## 🖥️ PC 1: Export Machine (Data Forge)

### Purpose
Generate `Scheme_Knowledge.json` from your master playbook files and manage play art images.

### What You Need on PC 1

**Software:**
- Node.js (LTS version recommended)
- Git (optional, for version control)

**Files/Folders:**
```
D:\iMoveChainzBot\              # Or G:\iMoveChainzBot - your choice!
├── master_data/
│   ├── offense_complete_v2.json    # Your 451 offensive plays
│   ├── defense_complete_v2.json    # Your 439 defensive plays
│   └── images/                     # Optional: store raw PNGs here
│       ├── play1.png
│       ├── play2.png
│       └── ...
├── tools/
│   └── export_playbook_data.ts     # Export script
├── data/                           # Output folder (created by export)
├── package.json
├── tsconfig.json
└── node_modules/                   # After npm install
```

### Setup Steps for PC 1

#### 1. Extract Project Files
Extract the updated files to `G:\iMoveChainzBot` (or D:\ if you prefer).

#### 2. Install Dependencies
```powershell
cd G:\iMoveChainzBot
npm install
```

This installs:
- TypeScript
- ts-node (for running .ts files directly)
- Other dev dependencies

#### 3. Place Your Playbook Files
Copy your playbook JSONs:
```powershell
# If coming from elsewhere
copy path\to\offense_complete_v2.json G:\iMoveChainzBot\master_data\
copy path\to\defense_complete_v2.json G:\iMoveChainzBot\master_data\
```

#### 4. (Optional) Organize Play Art Images
If you have play diagrams (PNG files), put them in:
```
G:\iMoveChainzBot\master_data\images\
```

These match the `file_name` field in your JSON files.

#### 5. Run the Export Script
```powershell
cd G:\iMoveChainzBot
npm run export:playbook
```

**Output:**
```
================================================================================
iMoveChainz Playbook Export
================================================================================

📖 Reading offense data from G:\iMoveChainzBot\master_data\offense_complete_v2.json
   Found 451 offensive plays

📖 Reading defense data from G:\iMoveChainzBot\master_data\defense_complete_v2.json
   Found 439 defensive plays

Processing 451 items for SNAPFIRE...
  ✓ Created 451 SNAPFIRE schemes

Processing 439 items for SHINOBI...
  ✓ Created 439 SHINOBI schemes

================================================================================
Export Summary
================================================================================
Schemes exported: 890
  🔥 SnapFire: 451
  🥷 Shinobi:  439

✅ Export complete!
📄 Output: G:\iMoveChainzBot\data\Scheme_Knowledge.json
```

#### 6. Prepare Files for Transfer

**What to copy to PC 2:**
1. `data/Scheme_Knowledge.json` (the export output)
2. Play art images → will go into `assets/play_art/` on PC 2

**Package them:**
```powershell
# Create a transfer folder
mkdir G:\TransferToPC2

# Copy the scheme data
copy G:\iMoveChainzBot\data\Scheme_Knowledge.json G:\TransferToPC2\

# Copy images (if you have them)
xcopy G:\iMoveChainzBot\master_data\images\*.png G:\TransferToPC2\play_art\ /I
```

Transfer via USB drive, network share, or cloud storage.

---

## 🖥️ PC 2: Bot Machine (Discord Runtime)

### Purpose
Run the Discord bot and serve knowledge to your community.

### What You Need on PC 2

**Software:**
- Node.js (LTS version)
- Discord bot credentials (token, client ID)

**Files/Folders:**
```
D:\iMoveChainzBot\              # Bot installation
├── src/
│   ├── index.ts
│   ├── deploy-commands.ts
│   ├── knowledge/
│   │   ├── types.ts           # UPDATED
│   │   └── loader.ts
│   └── commands/
│       ├── concept.ts
│       ├── coverage.ts
│       └── scheme.ts          # UPDATED
├── data/
│   ├── Scheme_Knowledge.json   # FROM PC 1
│   ├── Concept_Knowledge.json  # Optional
│   └── Coverage_Knowledge.json # Optional
├── assets/
│   └── play_art/               # FROM PC 1
│       ├── play1.png
│       ├── play2.png
│       └── ...
├── .env
├── package.json
└── node_modules/
```

### Setup Steps for PC 2

#### 1. Extract Bot Files
Extract the complete bot project to `D:\iMoveChainzBot` on PC 2.

#### 2. Install Dependencies
```powershell
cd D:\iMoveChainzBot
npm install
```

This installs:
- discord.js
- dotenv
- TypeScript
- Other runtime dependencies

#### 3. Transfer Files from PC 1

**From your transfer folder/drive:**
```powershell
# Copy scheme data
copy E:\TransferToPC2\Scheme_Knowledge.json D:\iMoveChainzBot\data\

# Copy play art images
mkdir D:\iMoveChainzBot\assets\play_art
xcopy E:\TransferToPC2\play_art\*.png D:\iMoveChainzBot\assets\play_art\ /I
```

**Verify files are in place:**
```powershell
dir D:\iMoveChainzBot\data\Scheme_Knowledge.json
dir D:\iMoveChainzBot\assets\play_art\
```

#### 4. Configure Discord Credentials

Edit `.env`:
```powershell
copy .env.example .env
notepad .env
```

Add your credentials:
```
DISCORD_BOT_TOKEN=your_actual_token_here
DISCORD_CLIENT_ID=your_actual_client_id_here
DISCORD_GUILD_ID=your_test_server_id
```

#### 5. Deploy Commands
```powershell
npm run deploy
```

#### 6. Start the Bot
```powershell
npm run dev
```

You should see:
```
🚀 Starting iMoveChainz Bot...

================================================================================
✅ iMoveChainz Bot is online!
   Logged in as: YourBot#1234
================================================================================

📚 Loading iMoveChainz Knowledge Bases...
✓ Loaded 0 Concepts entries
✓ Loaded 0 Coverages entries
✓ Loaded 890 Schemes entries

📊 Knowledge Base Stats:
   Concepts:  0
   Coverages: 0
   Schemes:   890
     🔥 SnapFire: 451
     🥷 Shinobi:  439

🎯 Ready to serve knowledge!
```

#### 7. Test in Discord

```
/scheme post wheel shallow
```

You should see:
- 🔥 Orange embed (SnapFire)
- Structured routes with receiver positions
- Formatted read progression (1️⃣, 2️⃣, 3️⃣)
- Strategy notes
- **Play art diagram attached!** (if image exists)

---

## 🔄 Updating Workflow

### When You Update Playbook Data

**On PC 1:**
1. Update `master_data/offense_complete_v2.json` or `defense_complete_v2.json`
2. Run `npm run export:playbook`
3. Transfer new `Scheme_Knowledge.json` to PC 2

**On PC 2:**
1. Stop the bot (Ctrl+C)
2. Replace `data/Scheme_Knowledge.json` with new version
3. Restart bot (`npm run dev`)

No need to redeploy commands unless you change command definitions.

---

## 📁 Drive Preference Note

**You mentioned avoiding C: drive.** This guide uses:
- **PC 1:** `G:\iMoveChainzBot` (export machine)
- **PC 2:** `D:\iMoveChainzBot` (bot machine)

Feel free to adjust paths as needed. Just make sure:
- Node.js can access the folders
- Discord bot has read access to `assets/play_art/`
- File paths in `.env` are correct

---

## 📊 File Size Reference

Your data is quite large:
- `offense_complete_v2.json`: ~1.1 MB
- `defense_complete_v2.json`: ~1.4 MB
- `Scheme_Knowledge.json`: ~3-5 MB (exported)
- Play art images: Varies (typically 50-200 KB each)

Make sure you have adequate storage on both machines.

---

## ✅ Success Checklist

### PC 1 (Export Machine)
- [ ] Node.js installed
- [ ] Project extracted to G: drive
- [ ] `npm install` completed
- [ ] Master data files in `master_data/`
- [ ] Export script runs successfully
- [ ] `Scheme_Knowledge.json` generated in `data/`
- [ ] Files packaged for transfer

### PC 2 (Bot Machine)
- [ ] Node.js installed
- [ ] Bot project extracted to D: drive
- [ ] `npm install` completed
- [ ] `Scheme_Knowledge.json` copied to `data/`
- [ ] Play art PNGs copied to `assets/play_art/`
- [ ] `.env` configured with Discord credentials
- [ ] Commands deployed
- [ ] Bot running and loading 890 schemes
- [ ] `/scheme` command works in Discord
- [ ] Images attach properly

---

## 🎉 You're Done!

Your iMoveChainz Bot is now running with:
- 890 detailed schemes
- Structured route data
- Read progressions
- Strategy notes  
- Play art diagrams

**Enjoy serving premium football IQ to your community!** 🏈

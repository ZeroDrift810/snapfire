# 🆕 iMoveChainz Bot - Updated Files Package

## 📦 What's Included

This package contains the **updated files** with improved data structure and image support:

### Updated Files (3)
1. **src/knowledge/types.ts**
   - Added `SchemeRoute` interface
   - Changed `SchemeKnowledge` structure:
     - `play_setup: string` → `routes: SchemeRoute[]`
     - Added `reads: string[]`
     - Added `image_file?: string`

2. **tools/export_playbook_data.ts**
   - Complete rewrite for new structure
   - Extracts structured route data
   - Formats read progressions with emojis
   - Captures image filenames from JSON

3. **src/commands/scheme.ts**
   - Updated to display structured routes
   - Shows formatted read progressions
   - Attaches play art images with `AttachmentBuilder`

### Documentation (3)
- **CROSS_PC_SETUP.md** - Complete guide for 2-PC workflow
- **PACKAGE_JSON_UPDATES.md** - How to add export script
- **README_UPDATED_FILES.md** - This file

### New Folder Required
- **assets/play_art/** - Where play diagram PNGs go (on bot machine)

---

## 🚀 How to Apply These Updates

### Quick Update (Existing Bot)

If you already have the bot running at `D:\iMoveChainzBot`:

```powershell
# Navigate to your project
cd D:\iMoveChainzBot

# Stop the bot if running (Ctrl+C)

# Backup your current files (optional but recommended)
copy src\knowledge\types.ts src\knowledge\types.ts.backup
copy src\commands\scheme.ts src\commands\scheme.ts.backup
copy tools\export_playbook_data.ts tools\export_playbook_data.ts.backup

# Extract the update package and copy files
# Replace these 3 files:
#   - src/knowledge/types.ts
#   - tools/export_playbook_data.ts
#   - src/commands/scheme.ts

# Create assets folder for images
mkdir assets\play_art

# Update package.json (see PACKAGE_JSON_UPDATES.md)
notepad package.json

# Install any new dependencies
npm install

# Run the export to generate new data
npm run export:playbook

# Restart the bot
npm run dev
```

---

## 📋 Comparison: Old vs New

### Old Structure (What you had)
```json
{
  "name": "snapfire_mesh_return",
  "display_name": "Mesh Return",
  "system": "SNAPFIRE",
  "formation_family": "Gun Bunch",
  "play_setup": "1. PA Mesh\n2. Motion RB\n3. Read safety",
  "usage_notes": "Best vs Cover 3"
}
```

### New Structure (What you're getting)
```json
{
  "name": "snapfire_post_wheel_shallow",
  "display_name": "Post Wheel Shallow",
  "system": "SNAPFIRE",
  "formation_family": "Shotgun Empty Ace",
  "routes": [
    {
      "receiver": "X",
      "route": "Post",
      "note": "Deep middle attack"
    },
    {
      "receiver": "Z",
      "route": "Wheel",
      "note": "Deep sideline"
    },
    {
      "receiver": "Slot",
      "route": "Shallow Cross",
      "note": "Underneath crossing"
    }
  ],
  "reads": [
    "**Pre-Snap:** Identify safety rotation",
    "**1️⃣ Primary:** Post route attacking deep middle",
    "**2️⃣ Secondary:** Wheel route if safety jumps to post",
    "**3️⃣ Checkdown:** Shallow cross for guaranteed completion"
  ],
  "usage_notes": "**Beats:** Cover 2, Cover 1, Man coverage\n**Coach's Key:** QB must read safety rotation quickly",
  "image_file": "play1_2025-12-01T08-43-44-295Z.png"
}
```

---

## 🎨 Visual Comparison

### Old Discord Embed
```
📚 Mesh Return
Setup Instructions: 1. PA Mesh, 2. Motion RB, 3. Read safety
Usage Notes: Best vs Cover 3
```

### New Discord Embed
```
🔥 Post Wheel Shallow
Formation: Shotgun Empty Ace

📋 Assignments
• X: Post (Deep middle attack)
• Z: Wheel (Deep sideline)
• Slot: Shallow Cross (Underneath crossing)

🧠 Reads / Keys
**Pre-Snap:** Identify safety rotation
**1️⃣ Primary:** Post route attacking deep middle
**2️⃣ Secondary:** Wheel route if safety jumps to post
**3️⃣ Checkdown:** Shallow cross

💡 Strategy
**Beats:** Cover 2, Cover 1, Man coverage
**Coach's Key:** QB must read safety rotation quickly

[Play art diagram attached as image]

Footer: 🔥 SnapFire Offense // iMoveChainz
```

---

## ✅ What's Better

1. **Structured Data** - Routes are queryable, not just text
2. **Clean Formatting** - Pre-formatted with emojis and markdown
3. **Image Support** - Attach play diagrams automatically
4. **Better UX** - Easier to read and understand
5. **More Detail** - Full route trees and read progressions

---

## 🔧 Troubleshooting

**Bot won't start after update:**
- Make sure all 3 files were copied correctly
- Run `npm install` to ensure dependencies are installed
- Check console for TypeScript errors

**Export script fails:**
- Verify `master_data/offense_complete_v2.json` exists
- Verify `master_data/defense_complete_v2.json` exists
- Check file paths in the script

**Images don't show:**
- Verify PNG files are in `assets/play_art/`
- Check that filenames match `image_file` values in JSON
- Ensure bot has read access to assets folder

**Autocomplete not working:**
- The update doesn't change autocomplete
- If broken, run `npm run deploy` again
- Restart Discord client

---

## 📞 Need Help?

Check the other documentation files:
- **CROSS_PC_SETUP.md** - Detailed 2-PC workflow
- **PACKAGE_JSON_UPDATES.md** - Script configuration

---

## 🎉 Ready to Update!

These improvements will make your bot **significantly better** with:
- 890 detailed schemes (all your plays!)
- Structured route data
- Visual play diagrams
- Professional formatting

Follow the steps above and you'll be running the enhanced version in minutes!

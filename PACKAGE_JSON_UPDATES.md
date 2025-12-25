# package.json Updates

## Add to Your Existing package.json

### 1. Add Export Script

In the `"scripts"` section, add:

```json
"export:playbook": "ts-node tools/export_playbook_data.ts"
```

Your full scripts section should look like:

```json
"scripts": {
  "build": "tsc",
  "start": "node dist/index.js",
  "dev": "tsx src/index.ts",
  "deploy": "tsx src/deploy-commands.ts",
  "export:playbook": "ts-node tools/export_playbook_data.ts",
  "clean": "rimraf dist",
  "rebuild": "npm run clean && npm run build"
}
```

### 2. Add ts-node Dependency

In the `"devDependencies"` section, add:

```json
"ts-node": "^10.9.2"
```

Your devDependencies should include:

```json
"devDependencies": {
  "@types/node": "^20.10.6",
  "rimraf": "^5.0.5",
  "ts-node": "^10.9.2",
  "tsx": "^4.7.0",
  "typescript": "^5.3.3"
}
```

### 3. Install New Dependency

After updating package.json, run:

```powershell
npm install
```

This will install ts-node.

---

## Alternative: Using tsx Instead

If you prefer to use `tsx` (which you already have), change the script to:

```json
"export:playbook": "tsx tools/export_playbook_data.ts"
```

This works too and doesn't require installing ts-node!

---

## Complete Example package.json

```json
{
  "name": "imovechainz-bot",
  "version": "1.0.0",
  "description": "Keeper of Knowledge for iMoveChainz Lab",
  "main": "dist/index.js",
  "type": "commonjs",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts",
    "deploy": "tsx src/deploy-commands.ts",
    "export:playbook": "tsx tools/export_playbook_data.ts",
    "clean": "rimraf dist",
    "rebuild": "npm run clean && npm run build"
  },
  "keywords": ["discord", "bot", "madden", "football", "snapfire", "shinobi"],
  "author": "Himkage",
  "license": "MIT",
  "dependencies": {
    "discord.js": "^14.14.1",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "@types/node": "^20.10.6",
    "rimraf": "^5.0.5",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

---

## Running the Export

Once updated, you can run:

```powershell
npm run export:playbook
```

This will:
1. Read `master_data/offense_complete_v2.json`
2. Read `master_data/defense_complete_v2.json`
3. Transform into bot format
4. Output `data/Scheme_Knowledge.json`

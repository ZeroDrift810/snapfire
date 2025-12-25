/**
 * Command Deployment Script
 */

import { REST, Routes } from 'discord.js';
import * as dotenv from 'dotenv';

dotenv.config();

const { DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID } = process.env;

if (!DISCORD_BOT_TOKEN || !DISCORD_CLIENT_ID) {
  console.error('❌ DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID not set in .env');
  process.exit(1);
}

// Type assertions after validation
const token: string = DISCORD_BOT_TOKEN;
const clientId: string = DISCORD_CLIENT_ID;
// Only use guildId if it's a non-empty string
const guildId: string | undefined = DISCORD_GUILD_ID && DISCORD_GUILD_ID.trim() ? DISCORD_GUILD_ID.trim() : undefined;

const commands = [
  { name: 'concept', description: 'Look up a general football concept', options: [{ name: 'name', description: 'Concept name', type: 3, required: true, autocomplete: true }] },
  { name: 'coverage', description: 'Look up defensive coverage information', options: [{ name: 'name', description: 'Coverage name', type: 3, required: true, autocomplete: true }] },
  { name: 'scheme', description: '🔥 Premium SnapFire/Shinobi plays', options: [{ name: 'name', description: 'Scheme name', type: 3, required: true, autocomplete: true }] }
];

async function deployCommands() {
  console.log('');
  console.log('='.repeat(80));
  console.log('iMoveChainz Bot - Command Deployment');
  console.log('='.repeat(80));
  console.log('');
  
  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log(`🔄 Registering ${commands.length} slash commands...`);
    const route = guildId
      ? Routes.applicationGuildCommands(clientId, guildId)
      : Routes.applicationCommands(clientId);
    
    const data = await rest.put(route, { body: commands }) as any[];
    console.log(`✅ Successfully registered ${data.length} commands!`);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

deployCommands();

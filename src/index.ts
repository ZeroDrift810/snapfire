/**
 * iMoveChainz Discord Bot - Main Entry Point
 *
 * "Keeper of Knowledge" for iMoveChainz Lab.
 * Fully button-driven: a posted hub message is the only entry point. There are no
 * slash commands and no autocomplete. Players navigate entirely by tapping.
 */

import { Client, Events, GatewayIntentBits, Interaction, MessageFlags } from 'discord.js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { getKnowledgeStats, loadKnowledgeBases, reloadKnowledgeBases } from './knowledge/loader';
import { cardStats, loadCards, reloadCards } from './content/cards';
import { handleInteraction } from './router';

dotenv.config();

const { DISCORD_BOT_TOKEN } = process.env;

if (!DISCORD_BOT_TOKEN) {
  console.error('❌ DISCORD_BOT_TOKEN is not set in .env file');
  process.exit(1);
}

// Knowledge loads at boot so the first interaction is instant.
loadKnowledgeBases();
loadCards();

// Hot-reload: re-read content/ (teaching cards) and data/ (playbook) when their files
// change, so a content edit or a content-only deploy takes effect with NO restart.
// Debounced so a burst of file writes (e.g. a git checkout) triggers one reload.
function watchKnowledge(): void {
  const root = path.resolve(__dirname, '..');
  let timer: NodeJS.Timeout | null = null;
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        reloadCards();
        reloadKnowledgeBases();
        console.log('♻️  knowledge hot-reloaded (content/ + data/)');
      } catch (e) {
        console.error('hot-reload failed (keeping previous in-memory data):', e);
      }
    }, 500);
  };
  for (const dir of ['content', 'data']) {
    try {
      fs.watch(path.join(root, dir), schedule);
    } catch (e) {
      console.warn(`could not watch ${dir}/ for hot-reload:`, (e as Error).message);
    }
  }
}
watchKnowledge();

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, (readyClient) => {
  const stats = getKnowledgeStats();
  const cs = cardStats();
  console.log('');
  console.log('='.repeat(80));
  console.log('✅ iMoveChainz Bot is online');
  console.log(`   Logged in as: ${readyClient.user.tag}`);
  console.log(`   Teaching cards: ${cs.glossary} terms, ${cs.coverage} coverages, ${cs.concept} concepts, ${cs.run} run, ${cs.front} fronts, ${cs.usering} usering, ${cs.situational} situational`);
  console.log(`   Playbook: ${stats.schemes} schemes (🔥 ${stats.snapfire} SnapFire, 🥷 ${stats.shinobi} Shinobi)`);
  console.log('='.repeat(80));
  console.log('');
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  try {
    await handleInteraction(interaction);
  } catch (error) {
    console.error('Error handling interaction:', error);
    try {
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'Something glitched on that tap. Try again in a sec.',
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (replyError) {
      console.error('Could not send error message:', replyError);
    }
  }
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

console.log('🚀 Starting iMoveChainz Bot...');
client.login(DISCORD_BOT_TOKEN);

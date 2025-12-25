/**
 * iMoveChainz Discord Bot - Main Entry Point
 * 
 * "Keeper of Knowledge" for iMoveChainz Lab
 * Serves SnapFire Offense 🔥 and Shinobi Defense 🥷 knowledge
 */

import { Client, GatewayIntentBits, Events, Interaction, ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import * as dotenv from 'dotenv';
import { loadKnowledgeBases, getKnowledgeStats } from './knowledge/loader';
import { handleConceptCommand, handleConceptAutocomplete } from './commands/concept';
import { handleCoverageCommand, handleCoverageAutocomplete } from './commands/coverage';
import { handleSchemeCommand, handleSchemeAutocomplete } from './commands/scheme';

// Load environment variables
dotenv.config();

const { DISCORD_BOT_TOKEN } = process.env;

if (!DISCORD_BOT_TOKEN) {
  console.error('❌ DISCORD_BOT_TOKEN is not set in .env file');
  process.exit(1);
}

// ============================================================================
// BOT INITIALIZATION
// ============================================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds
  ]
});

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * Bot ready event
 */
client.once(Events.ClientReady, (readyClient) => {
  console.log('');
  console.log('='.repeat(80));
  console.log(`✅ iMoveChainz Bot is online!`);
  console.log(`   Logged in as: ${readyClient.user.tag}`);
  console.log(`   Bot ID: ${readyClient.user.id}`);
  console.log('='.repeat(80));
  console.log('');

  // Load knowledge bases
  loadKnowledgeBases();

  // Display stats
  const stats = getKnowledgeStats();
  console.log('📊 Knowledge Base Stats:');
  console.log(`   Concepts:  ${stats.concepts}`);
  console.log(`   Coverages: ${stats.coverages}`);
  console.log(`   Schemes:   ${stats.schemes}`);
  console.log(`     🔥 SnapFire: ${stats.snapfire}`);
  console.log(`     🥷 Shinobi:  ${stats.shinobi}`);
  console.log('');
  console.log('🎯 Ready to serve knowledge!');
  console.log('');
});

/**
 * Interaction handler (slash commands and autocomplete)
 */
client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  try {
    // Handle slash command execution
    if (interaction.isChatInputCommand()) {
      await handleSlashCommand(interaction);
    }
    
    // Handle autocomplete
    else if (interaction.isAutocomplete()) {
      await handleAutocomplete(interaction);
    }

  } catch (error) {
    console.error('Error handling interaction:', error);
    
    // Try to respond with error message
    try {
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ An error occurred while processing your request.',
          ephemeral: true
        });
      }
    } catch (replyError) {
      console.error('Could not send error message to user:', replyError);
    }
  }
});

// ============================================================================
// SLASH COMMAND HANDLER
// ============================================================================

async function handleSlashCommand(interaction: ChatInputCommandInteraction) {
  const { commandName } = interaction;

  console.log(`[${new Date().toISOString()}] /${commandName} by ${interaction.user.tag}`);

  switch (commandName) {
    case 'concept':
      await handleConceptCommand(interaction);
      break;

    case 'coverage':
      await handleCoverageCommand(interaction);
      break;

    case 'scheme':
      await handleSchemeCommand(interaction);
      break;

    default:
      await interaction.reply({
        content: '❌ Unknown command.',
        ephemeral: true
      });
  }
}

// ============================================================================
// AUTOCOMPLETE HANDLER
// ============================================================================

async function handleAutocomplete(interaction: AutocompleteInteraction) {
  const { commandName } = interaction;

  try {
    switch (commandName) {
      case 'concept':
        await handleConceptAutocomplete(interaction);
        break;

      case 'coverage':
        await handleCoverageAutocomplete(interaction);
        break;

      case 'scheme':
        await handleSchemeAutocomplete(interaction);
        break;

      default:
        await interaction.respond([]);
    }
  } catch (error) {
    console.error('Error responding to autocomplete:', error);
    // Silently fail for autocomplete - don't disrupt user experience
  }
}

// ============================================================================
// ERROR HANDLERS
// ============================================================================

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

// ============================================================================
// START BOT
// ============================================================================

console.log('');
console.log('🚀 Starting iMoveChainz Bot...');
console.log('');

client.login(DISCORD_BOT_TOKEN);

/**
 * Post an engagement item to a channel.
 *
 * This is an operator script (for OpenClaw or cron), not a user command. It logs in,
 * posts the requested engagement item, and exits.
 *
 *   npm run autopost -- <item> [channelId]
 *
 * Items: term-of-the-day | coverage-of-the-week | beat-this-look
 * Channel: the [channelId] arg, else AUTOPOST_CHANNEL_ID, else HUB_CHANNEL_ID in .env.
 *
 * The buttons on the posted message are stateless; the running bot handles every tap.
 */

import { Client, Events, GatewayIntentBits, TextChannel } from 'discord.js';
import * as dotenv from 'dotenv';
import { loadKnowledgeBases } from '../src/knowledge/loader';
import { loadCards } from '../src/content/cards';
import { AUTOPOST_ITEMS, AutopostItem, BUILDERS } from '../src/engagement/items';

dotenv.config();

const { DISCORD_BOT_TOKEN, AUTOPOST_CHANNEL_ID, HUB_CHANNEL_ID } = process.env;

const item = process.argv[2] as AutopostItem | undefined;
const channelId = process.argv[3] || AUTOPOST_CHANNEL_ID || HUB_CHANNEL_ID;

function usage(msg: string): never {
  console.error(`❌ ${msg}`);
  console.error(`   usage: npm run autopost -- <item> [channelId]`);
  console.error(`   items: ${AUTOPOST_ITEMS.join(' | ')}`);
  process.exit(1);
}

if (!DISCORD_BOT_TOKEN) usage('DISCORD_BOT_TOKEN is not set in .env');
if (!item || !(item in BUILDERS)) usage(`unknown item: ${item ?? '(none)'}`);
if (!channelId) usage('no channel: pass a channelId or set AUTOPOST_CHANNEL_ID / HUB_CHANNEL_ID');

loadKnowledgeBases();
loadCards();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async () => {
  try {
    const channel = await client.channels.fetch(channelId as string);
    if (!channel || !channel.isTextBased()) {
      console.error('❌ Channel not found or not text based:', channelId);
      process.exit(1);
    }
    const msg = BUILDERS[item as AutopostItem]();
    await (channel as TextChannel).send({ embeds: msg.embeds, components: msg.components });
    console.log(`✅ Posted "${item}" to channel ${channelId}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to post:', err);
    process.exit(1);
  }
});

client.login(DISCORD_BOT_TOKEN);

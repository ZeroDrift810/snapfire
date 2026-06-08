/**
 * Post the iMoveChainz hub panel to a channel.
 *
 * This is an operator script, not a user command. It logs in, posts the public hub
 * message (the only entry point into the button UI), and exits. Run it once per channel
 * you want the panel in:
 *
 *   HUB_CHANNEL_ID=<channel id>  npm run post-hub
 *
 * The buttons on the posted message are stateless, so the running bot handles every tap
 * afterward with no further posting needed.
 */

import { Client, Events, GatewayIntentBits, TextChannel } from 'discord.js';
import * as dotenv from 'dotenv';
import { loadKnowledgeBases } from '../src/knowledge/loader';
import { buildHubPublic } from '../src/ui/views';

dotenv.config();

const { DISCORD_BOT_TOKEN, HUB_CHANNEL_ID } = process.env;

if (!DISCORD_BOT_TOKEN) {
  console.error('❌ DISCORD_BOT_TOKEN is not set in .env');
  process.exit(1);
}
if (!HUB_CHANNEL_ID) {
  console.error('❌ HUB_CHANNEL_ID is not set. Pass the target channel id.');
  process.exit(1);
}

loadKnowledgeBases();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async () => {
  try {
    const channel = await client.channels.fetch(HUB_CHANNEL_ID);
    if (!channel || !channel.isTextBased()) {
      console.error('❌ Channel not found or not text based:', HUB_CHANNEL_ID);
      process.exit(1);
    }
    const hub = buildHubPublic();
    await (channel as TextChannel).send({
      embeds: hub.embeds,
      components: hub.components,
    });
    console.log(`✅ Hub posted to channel ${HUB_CHANNEL_ID}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to post hub:', err);
    process.exit(1);
  }
});

client.login(DISCORD_BOT_TOKEN);

/**
 * Post the Operator Control Hub to a staff channel.
 *
 * Operator script. Posts the owner-gated control panel. Run once per staff channel.
 *
 *   STAFF_CHANNEL_ID=<id>  npm run post-operator-hub
 *
 * Only OWNER_DISCORD_ID can actually use the buttons (enforced at click time), so it is
 * safe even in a shared staff channel. Put it in a PRIVATE channel anyway.
 */

import { Client, Events, GatewayIntentBits, TextChannel } from 'discord.js';
import * as dotenv from 'dotenv';
import { buildOperatorHub } from '../src/operator/operator';

dotenv.config();

const { DISCORD_BOT_TOKEN, STAFF_CHANNEL_ID, OWNER_DISCORD_ID } = process.env;

if (!DISCORD_BOT_TOKEN) {
  console.error('❌ DISCORD_BOT_TOKEN is not set in .env');
  process.exit(1);
}
if (!STAFF_CHANNEL_ID) {
  console.error('❌ STAFF_CHANNEL_ID is not set (the private channel to post the panel in).');
  process.exit(1);
}
if (!OWNER_DISCORD_ID) {
  console.warn('⚠️  OWNER_DISCORD_ID is not set. The panel will refuse all clicks until you set it.');
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async () => {
  try {
    const channel = await client.channels.fetch(STAFF_CHANNEL_ID);
    if (!channel || !channel.isTextBased()) {
      console.error('❌ Channel not found or not text based:', STAFF_CHANNEL_ID);
      process.exit(1);
    }
    const hub = buildOperatorHub();
    await (channel as TextChannel).send({ embeds: hub.embeds, components: hub.components });
    console.log(`✅ Operator hub posted to channel ${STAFF_CHANNEL_ID}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to post operator hub:', err);
    process.exit(1);
  }
});

client.login(DISCORD_BOT_TOKEN);

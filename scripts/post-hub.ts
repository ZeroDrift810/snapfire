/**
 * Post the iMoveChainz hub panel to a channel.
 *
 * This is an operator script, not a user command. It logs in, deletes any prior hub
 * panel this bot posted in the channel (so re-running replaces instead of duplicating),
 * posts a fresh public hub message, and exits:
 *
 *   HUB_CHANNEL_ID=<channel id>  npm run post-hub
 *
 * The buttons on the posted message are stateless, so the running bot handles every tap
 * afterward with no further posting needed. Idempotent: safe to re-run after adding a
 * track or changing the hub, it sweeps the old panel first.
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
    const tc = channel as TextChannel;

    // Idempotent: delete any prior public hub panel THIS bot posted here, identified by
    // its `imc:open:` buttons (robust against title/copy changes), so a re-run replaces
    // the panel instead of stacking duplicates. Needs Read Message History + Manage Messages.
    try {
      const recent = await tc.messages.fetch({ limit: 50 });
      const prior = recent.filter(
        (m) =>
          m.author.id === client.user!.id &&
          m.components.some((row: any) =>
            (row.components ?? []).some(
              (c: any) => typeof c.customId === 'string' && c.customId.startsWith('imc:open:')
            )
          )
      );
      for (const [, msg] of prior) await msg.delete().catch(() => {});
      if (prior.size) console.log(`   removed ${prior.size} prior hub panel(s)`);
    } catch (e) {
      console.warn(
        '   could not sweep prior panels (needs Read Message History + Manage Messages):',
        (e as Error).message
      );
    }

    const hub = buildHubPublic();
    await tc.send({ embeds: hub.embeds, components: hub.components });
    console.log(`✅ Hub posted to channel ${HUB_CHANNEL_ID}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to post hub:', err);
    process.exit(1);
  }
});

client.login(DISCORD_BOT_TOKEN);

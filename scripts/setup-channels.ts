/**
 * Create the channels the iMoveChainz setup needs.
 *
 * Idempotent: skips any channel/category that already exists by name. Prints the channel
 * ids and a ready-to-paste .env block.
 *
 *   npm run setup-channels            # uses the bot's only guild
 *   GUILD_ID=<id> npm run setup-channels
 *
 * Creates, under a category "iMoveChainz Lab":
 *   #the-lab           public   -> player hub + engagement autoposts
 *   #operator-control  private  -> Operator Control Hub (owner-gated)
 *   #openclaw-ops      private  -> where OpenClaw watches for delegate requests
 *
 * Private channels deny @everyone view and allow the bot. The server owner and admins
 * (you) still see them.
 */

import {
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  PermissionFlagsBits,
} from 'discord.js';
import * as dotenv from 'dotenv';

dotenv.config();

const { DISCORD_BOT_TOKEN, GUILD_ID } = process.env;

if (!DISCORD_BOT_TOKEN) {
  console.error('❌ DISCORD_BOT_TOKEN is not set in .env');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async () => {
  try {
    // Prefer an explicitly-requested guild the bot is actually in; otherwise its only guild.
    let guild = GUILD_ID ? client.guilds.cache.get(GUILD_ID) : undefined;
    if (!guild) guild = client.guilds.cache.first();
    if (!guild) {
      console.error('❌ Bot is not in any guild. Invite it first.');
      process.exit(1);
    }
    const g = await guild.fetch();
    console.log(`Guild: ${g.name} (${g.id})`);

    await g.channels.fetch();
    const botId = client.user!.id;
    const everyone = g.roles.everyone.id;

    function findByName(name: string, type: ChannelType) {
      return g.channels.cache.find((c) => c?.name === name && c?.type === type) || null;
    }

    // Category
    let category = findByName('iMoveChainz Lab', ChannelType.GuildCategory);
    if (!category) {
      category = await g.channels.create({ name: 'iMoveChainz Lab', type: ChannelType.GuildCategory });
      console.log(`  + category iMoveChainz Lab`);
    } else {
      console.log(`  = category iMoveChainz Lab (exists)`);
    }

    const privateOverwrites = [
      { id: everyone, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: botId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
    ];

    async function ensure(name: string, isPrivate: boolean) {
      let ch = findByName(name, ChannelType.GuildText);
      if (ch) {
        console.log(`  = #${name} (exists) -> ${ch.id}`);
        return ch.id;
      }
      ch = await g.channels.create({
        name,
        type: ChannelType.GuildText,
        parent: category!.id,
        permissionOverwrites: isPrivate ? privateOverwrites : undefined,
      });
      console.log(`  + #${name} ${isPrivate ? '(private)' : '(public)'} -> ${ch.id}`);
      return ch.id;
    }

    const lab = await ensure('the-lab', false);
    const operator = await ensure('operator-control', true);
    const openclaw = await ensure('openclaw-ops', true);

    console.log('');
    console.log('Paste into .env:');
    console.log('-----------------------------------------');
    console.log(`HUB_CHANNEL_ID=${lab}`);
    console.log(`AUTOPOST_CHANNEL_ID=${lab}`);
    console.log(`STAFF_CHANNEL_ID=${operator}`);
    console.log(`OPENCLAW_CHANNEL_ID=${openclaw}`);
    console.log('# OWNER_DISCORD_ID=<your discord user id>  <- still needed for the operator buttons');
    console.log('-----------------------------------------');
    process.exit(0);
  } catch (err: any) {
    if (err?.code === 50013) {
      console.error('❌ Missing Permissions. The bot needs the "Manage Channels" permission in this server.');
      console.error('   Grant it (Server Settings > Roles, or re-invite with the permission) and run again.');
    } else {
      console.error('❌ Failed to create channels:', err);
    }
    process.exit(1);
  }
});

client.login(DISCORD_BOT_TOKEN);

/**
 * Operator Control Hub.
 *
 * A staff-only button panel for running the bot and driving OpenClaw from Discord.
 * Two kinds of button:
 *   DIRECT  — the bot does it itself, instantly (post engagement / hub).
 *   DELEGATE — the bot hands a task to OpenClaw by posting an instruction into the
 *              OpenClaw ops channel, which OpenClaw watches and acts on.
 *
 * Owner-gated: only OWNER_DISCORD_ID may use the buttons. These are side-effecting, so
 * they are handled in a dedicated live path (handleOperator), NOT through the pure
 * resolve() router used for navigation.
 *
 * Config (env):
 *   OWNER_DISCORD_ID    who may use the panel
 *   STAFF_CHANNEL_ID    where the panel is posted (private/staff)
 *   AUTOPOST_CHANNEL_ID where DIRECT posts go (falls back to HUB_CHANNEL_ID)
 *   OPENCLAW_CHANNEL_ID where DELEGATE instructions are posted for OpenClaw
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  TextChannel,
} from 'discord.js';
import { GENERIC_BRAND } from '../knowledge/types';
import { ID } from '../ui/ids';
import { buildHubPublic } from '../ui/views';
import { AutopostMessage, buildBeatThisLook, buildCoverageOfWeek, buildTermOfDay } from '../engagement/items';

const OPS_COLOR = 0x34495e;

interface DirectAction {
  action: string;
  label: string;
  emoji: string;
  build: () => AutopostMessage;
}

const DIRECT_ACTIONS: DirectAction[] = [
  { action: 'post-term', label: 'Term of the Day', emoji: '📖', build: buildTermOfDay },
  { action: 'post-coverage', label: 'Coverage of the Week', emoji: '🛡️', build: buildCoverageOfWeek },
  { action: 'post-beat', label: 'Beat This Look', emoji: '🎯', build: buildBeatThisLook },
];

interface DelegateAction {
  action: string;
  label: string;
  emoji: string;
  instruction: string;
}

const DELEGATE_ACTIONS: DelegateAction[] = [
  {
    action: 'ask-deploy',
    label: 'Smoke + Deploy',
    emoji: '🚀',
    instruction:
      'Build the iMoveChainz bot, run `npm run smoke`, and ONLY if it prints PASS, restart it. Report the smoke result and any errors. If smoke fails, do not restart.',
  },
  {
    action: 'ask-status',
    label: 'Status Check',
    emoji: '📟',
    instruction:
      'Give me a status check on the iMoveChainz bot: pm2 status, the last 20 log lines, and a fresh `npm run smoke` result.',
  },
  {
    action: 'ask-announce',
    label: 'Draft Announcement',
    emoji: '📣',
    instruction:
      'Draft an announcement for the latest iMoveChainz content drop in the teaching voice (no hype, no "AI", no em dashes) and send it to me for approval before posting anywhere.',
  },
  {
    action: 'ask-briefing',
    label: 'Daily Briefing',
    emoji: '☀️',
    instruction:
      'Give me a daily briefing: iMoveChainz bot health, anything in the logs worth noting, and community activity worth a response.',
  },
];

export function buildOperatorHub(): {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
} {
  const embed = new EmbedBuilder()
    .setColor(OPS_COLOR)
    .setTitle('🛠️ Operator Control')
    .setDescription(
      [
        'Operator-only. Direct posts run instantly. OpenClaw tasks are handed off to your ops agent.',
        '',
        '**Direct (the bot posts it now)**',
        ...DIRECT_ACTIONS.map((a) => `${a.emoji} ${a.label}`),
        '',
        '**OpenClaw (handed to your agent)**',
        ...DELEGATE_ACTIONS.map((a) => `${a.emoji} ${a.label}`),
      ].join('\n')
    )
    .setFooter({ text: GENERIC_BRAND.footer });

  const directRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...DIRECT_ACTIONS.map((a) =>
      new ButtonBuilder()
        .setCustomId(ID.op(a.action))
        .setLabel(a.label)
        .setEmoji(a.emoji)
        .setStyle(ButtonStyle.Success)
    ),
    new ButtonBuilder()
      .setCustomId(ID.op('post-hub'))
      .setLabel('Post Hub')
      .setEmoji('🧩')
      .setStyle(ButtonStyle.Secondary)
  );

  const delegateRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    DELEGATE_ACTIONS.map((a) =>
      new ButtonBuilder()
        .setCustomId(ID.op(a.action))
        .setLabel(a.label)
        .setEmoji(a.emoji)
        .setStyle(ButtonStyle.Primary)
    )
  );

  return { embeds: [embed], components: [directRow, delegateRow] };
}

/** All operator-button customIds, for the smoke test to confirm they are intentional. */
export function operatorActionIds(): string[] {
  return [
    ...DIRECT_ACTIONS.map((a) => ID.op(a.action)),
    ID.op('post-hub'),
    ...DELEGATE_ACTIONS.map((a) => ID.op(a.action)),
  ];
}

async function ephemeral(interaction: ButtonInteraction, content: string): Promise<void> {
  await interaction.reply({ content, flags: MessageFlags.Ephemeral });
}

/** Owner-gated, side-effecting handler for the operator hub buttons. */
export async function handleOperator(interaction: ButtonInteraction): Promise<void> {
  const owner = process.env.OWNER_DISCORD_ID;
  if (!owner || interaction.user.id !== owner) {
    await ephemeral(interaction, 'This panel is operator-only.');
    return;
  }

  const action = interaction.customId.split(':')[2];

  // DIRECT: the bot posts it itself.
  const direct = DIRECT_ACTIONS.find((a) => a.action === action);
  if (direct) {
    const target = process.env.AUTOPOST_CHANNEL_ID || process.env.HUB_CHANNEL_ID;
    if (!target) {
      await ephemeral(interaction, 'Set AUTOPOST_CHANNEL_ID (or HUB_CHANNEL_ID) first.');
      return;
    }
    const channel = await interaction.client.channels.fetch(target).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      await ephemeral(interaction, `Target channel not reachable: ${target}`);
      return;
    }
    const msg = direct.build();
    await (channel as TextChannel).send({ embeds: msg.embeds, components: msg.components });
    await ephemeral(interaction, `Posted ${direct.label} to <#${target}>.`);
    return;
  }

  if (action === 'post-hub') {
    const target = process.env.AUTOPOST_CHANNEL_ID || process.env.HUB_CHANNEL_ID;
    if (!target) {
      await ephemeral(interaction, 'Set AUTOPOST_CHANNEL_ID (or HUB_CHANNEL_ID) first.');
      return;
    }
    const channel = await interaction.client.channels.fetch(target).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      await ephemeral(interaction, `Target channel not reachable: ${target}`);
      return;
    }
    const hub = buildHubPublic();
    await (channel as TextChannel).send({ embeds: hub.embeds, components: hub.components });
    await ephemeral(interaction, `Posted the hub panel to <#${target}>.`);
    return;
  }

  // DELEGATE: hand the task to OpenClaw.
  const delegate = DELEGATE_ACTIONS.find((a) => a.action === action);
  if (delegate) {
    const opsChannel = process.env.OPENCLAW_CHANNEL_ID;
    if (!opsChannel) {
      await ephemeral(interaction, 'Set OPENCLAW_CHANNEL_ID first (the channel OpenClaw watches).');
      return;
    }
    const channel = await interaction.client.channels.fetch(opsChannel).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      await ephemeral(interaction, `OpenClaw channel not reachable: ${opsChannel}`);
      return;
    }
    // EXE/@Techkage runs with requireMention=true, so ping the agent if configured.
    const agentId = process.env.OPENCLAW_AGENT_ID;
    const mention = agentId ? `<@${agentId}> ` : '';
    await (channel as TextChannel).send({
      content: `${mention}🦞 Operator request: ${delegate.instruction}`,
      allowedMentions: { users: agentId ? [agentId] : [] },
    });
    await ephemeral(interaction, `Sent to OpenClaw: ${delegate.label}.`);
    return;
  }

  await ephemeral(interaction, 'Unknown operator action.');
}

/**
 * Playcall interaction handler.
 *
 * Side-effecting (it mutates drive state, rolls outcomes, renders diagrams), so it is handled
 * outside the pure resolve() router exactly like the operator hub. Owns every `imc:pc:*` button
 * and the `imc:pc:pick` select. Replies ephemeral when launched from a public message (a fresh
 * private drive) and updates in place once the drive is running.
 */

import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, EmbedBuilder, Interaction, MessageFlags, StringSelectMenuInteraction } from 'discord.js';
import { ViewPayload } from '../ui/views';
import { chooseOffense, endGame, getGame, newGame, resolveDown } from './game';
import { buildCallView, buildDirView, buildOverView, PC_ID } from './views';
import { Dir } from './engine';

function toMessage(p: ViewPayload) {
  return { embeds: p.embeds, components: p.components, files: p.files ?? [], attachments: p.attachments ?? [] };
}

async function deliver(interaction: ButtonInteraction | StringSelectMenuInteraction, payload: ViewPayload, forceReply = false): Promise<void> {
  const msg = toMessage(payload);
  const isEphemeral = Boolean(interaction.message?.flags?.has(MessageFlags.Ephemeral));
  if (forceReply || !isEphemeral) {
    await interaction.reply({ ...msg, flags: MessageFlags.Ephemeral });
  } else {
    await interaction.update(msg);
  }
}

export async function handlePlaycall(interaction: Interaction): Promise<void> {
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId !== PC_ID.pick) return;
    const userId = interaction.user.id;
    let g = getGame(userId);
    if (!g || g.status === 'over') g = newGame(userId);
    const offId = interaction.values[0];
    if (!chooseOffense(g, offId)) {
      await deliver(interaction, buildCallView(g));
      return;
    }
    await deliver(interaction, buildDirView(g, offId));
    return;
  }

  if (!interaction.isButton()) return;
  const id = interaction.customId;
  const userId = interaction.user.id;

  // New / restart a drive.
  if (id === PC_ID.new) {
    const g = newGame(userId);
    await deliver(interaction, buildCallView(g));
    return;
  }

  // End the drive.
  if (id === PC_ID.quit) {
    const g = getGame(userId);
    if (g && g.plays.length) {
      g.status = 'over';
      g.endline = g.endline ?? 'You ended the drive.';
      await deliver(interaction, buildOverView(g));
    } else {
      endGame(userId);
      const embed = new EmbedBuilder().setColor(0x34495e).setTitle('Drive ended.').setDescription('Run it back whenever you want.').setFooter({ text: '🎮 Playcall // iMoveChainz' });
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(PC_ID.new).setLabel('New Drive').setEmoji('🔄').setStyle(ButtonStyle.Success));
      await deliver(interaction, { embeds: [embed], components: [row], files: [], attachments: [] });
    }
    return;
  }

  // Direction chosen -> resolve the down.  imc:pc:dir:<offId>:<l|r>
  if (id.startsWith('imc:pc:dir:')) {
    const parts = id.split(':'); // imc, pc, dir, offId, d
    const offId = parts[3];
    const d = parts[4];
    let g = getGame(userId);
    if (!g) {
      g = newGame(userId);
      await deliver(interaction, buildCallView(g));
      return;
    }
    // If state drifted (stale button), re-sync to the chosen offense.
    if (g.status !== 'await_dir' || g.pendingOff !== offId) {
      if (g.status === 'over') {
        await deliver(interaction, buildOverView(g));
        return;
      }
      if (!chooseOffense(g, offId)) {
        await deliver(interaction, buildCallView(g));
        return;
      }
    }
    const dir: Dir = d === 'l' ? -1 : 1;
    resolveDown(g, dir);
    // resolveDown mutates g.status at runtime; read it through the live object.
    const over = getGame(userId)?.status === 'over';
    await deliver(interaction, over ? buildOverView(g) : buildCallView(g));
    return;
  }
}

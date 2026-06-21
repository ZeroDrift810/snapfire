/**
 * Playcall interaction handler.
 *
 * Side-effecting (drive state, RNG, live render), so it is handled outside the pure resolve()
 * router like the operator hub. Owns every `imc:pc:*` button + the offense/defense selects. The
 * interaction is DEFERRED first (instant ack), then the payload is built (which renders the ~2s
 * animated GIF) and edited in, so the render never trips Discord's 3s response limit.
 */

import { ButtonInteraction, Interaction, MessageFlags, StringSelectMenuInteraction } from 'discord.js';
import { ViewPayload } from '../ui/views';
import { chooseOffense, endGame, getGame, newGame, resolveAsDefense, resolveDown } from './game';
import { buildDirView, buildOverView, buildStartView, buildTurnView, PC_ID } from './views';
import { Dir } from './engine';

function toMessage(p: ViewPayload) {
  return { embeds: p.embeds, components: p.components, files: p.files ?? [], attachments: p.attachments ?? [] };
}

async function deliver(interaction: ButtonInteraction | StringSelectMenuInteraction, build: () => ViewPayload, forceReply = false): Promise<void> {
  const isEphemeral = Boolean(interaction.message?.flags?.has(MessageFlags.Ephemeral));
  if (forceReply || !isEphemeral) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  } else {
    await interaction.deferUpdate();
  }
  await interaction.editReply(toMessage(build()));
}

export async function handlePlaycall(interaction: Interaction): Promise<void> {
  if (interaction.isStringSelectMenu()) {
    await handleSelect(interaction);
    return;
  }
  if (interaction.isButton()) {
    await handleButton(interaction);
  }
}

async function handleSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const userId = interaction.user.id;
  const value = interaction.values[0];

  if (interaction.customId === PC_ID.pick) {
    let g = getGame(userId);
    if (!g || g.mode !== 'offense' || g.status === 'over') g = newGame(userId, 'offense');
    if (!chooseOffense(g, value)) {
      await deliver(interaction, () => buildTurnView(g!));
      return;
    }
    await deliver(interaction, () => buildDirView(g!, value));
    return;
  }

  if (interaction.customId === PC_ID.defpick) {
    let g = getGame(userId);
    if (!g || g.mode !== 'defense' || g.status === 'over') g = newGame(userId, 'defense');
    const game = g;
    resolveAsDefense(game, value);
    await deliver(interaction, () => (getGame(userId)?.status === 'over' ? buildOverView(game) : buildTurnView(game)));
    return;
  }
}

async function handleButton(interaction: ButtonInteraction): Promise<void> {
  const id = interaction.customId;
  const userId = interaction.user.id;

  // Open the side chooser.
  if (id === PC_ID.new) {
    await deliver(interaction, buildStartView);
    return;
  }

  // Start a drive on the chosen side.  imc:pc:start:<off|def>
  if (id.startsWith('imc:pc:start:')) {
    const mode = id.endsWith(':def') ? 'defense' : 'offense';
    const g = newGame(userId, mode);
    await deliver(interaction, () => buildTurnView(g));
    return;
  }

  // End the drive.
  if (id === PC_ID.quit) {
    const g = getGame(userId);
    if (g && g.plays.length) {
      g.status = 'over';
      g.endline = g.endline ?? 'You ended the drive.';
      await deliver(interaction, () => buildOverView(g));
    } else {
      endGame(userId);
      await deliver(interaction, buildStartView);
    }
    return;
  }

  // Offense direction chosen -> resolve the down.  imc:pc:dir:<offId>:<l|r>
  if (id.startsWith('imc:pc:dir:')) {
    const parts = id.split(':');
    const offId = parts[3];
    const d = parts[4];
    let g = getGame(userId);
    if (!g || g.mode !== 'offense') {
      const fresh = newGame(userId, 'offense');
      await deliver(interaction, () => buildTurnView(fresh));
      return;
    }
    const game = g;
    if (game.status !== 'await_dir' || game.pendingOff !== offId) {
      if (game.status === 'over') {
        await deliver(interaction, () => buildOverView(game));
        return;
      }
      if (!chooseOffense(game, offId)) {
        await deliver(interaction, () => buildTurnView(game));
        return;
      }
    }
    const dir: Dir = d === 'l' ? -1 : 1;
    resolveDown(game, dir);
    await deliver(interaction, () => (getGame(userId)?.status === 'over' ? buildOverView(game) : buildTurnView(game)));
    return;
  }
}

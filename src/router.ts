/**
 * Interaction router.
 *
 * `resolve()` is pure: a customId (+ optional select value) maps to a payload and a
 * delivery mode. The live handler and the smoke test both call it, so what gets tested
 * is exactly what runs in production. No slash-command or autocomplete path by design.
 */

import {
  ButtonInteraction,
  Interaction,
  MessageFlags,
  StringSelectMenuInteraction,
} from 'discord.js';
import { buildDetail, buildGoto, buildHubSession, buildList, ViewPayload } from './ui/views';
import { DEFAULT_FILTER, isTrack, parseId, Track } from './ui/ids';
import { handleOperator } from './operator/operator';
import { handlePlaycall } from './playcall/handler';

export type Mode = 'open' | 'update';

export interface Resolved {
  payload: ViewPayload;
  mode: Mode;
}

function toFilterPage(filter: string, pageRaw: string): { filter: string; page: number } {
  const page = Number.parseInt(pageRaw, 10);
  return { filter, page: Number.isFinite(page) ? page : 0 };
}

/** Pure dispatch. Returns null for any id this bot does not own. */
export function resolve(customId: string, selectValue?: string): Resolved | null {
  const t = parseId(customId);
  if (t[0] !== 'imc') return null;

  switch (t[1]) {
    case 'open': {
      const track = t[2];
      if (!isTrack(track)) return null;
      return {
        payload: buildList(track as Track, DEFAULT_FILTER[track as Track], 0),
        mode: 'open',
      };
    }

    case 'hub':
      return { payload: buildHubSession(), mode: 'update' };

    case 'list': {
      const track = t[2];
      if (!isTrack(track)) return null;
      const { filter, page } = toFilterPage(t[3] ?? '', t[4] ?? '0');
      return { payload: buildList(track as Track, filter, page), mode: 'update' };
    }

    case 'pg': {
      // imc:pg:<track>:<filter>:<dir>:<page> — dir disambiguates the customId only.
      const track = t[2];
      if (!isTrack(track)) return null;
      const { filter, page } = toFilterPage(t[3] ?? '', t[5] ?? '0');
      return { payload: buildList(track as Track, filter, page), mode: 'update' };
    }

    case 'pick': {
      const track = t[2];
      if (!isTrack(track)) return null;
      if (!selectValue) return null;
      const { filter, page } = toFilterPage(t[3] ?? '', t[4] ?? '0');
      return { payload: buildDetail(track as Track, selectValue, filter, page), mode: 'update' };
    }

    case 'goto': {
      const id = t.slice(2).join(':');
      if (!id) return null;
      return { payload: buildGoto(id), mode: 'update' };
    }

    case 'show': {
      // Public-safe deep link from an autopost: open a specific card privately.
      const track = t[2];
      if (!isTrack(track)) return null;
      const id = t[3];
      if (!id) return null;
      return {
        payload: buildDetail(track as Track, id, DEFAULT_FILTER[track as Track], 0),
        mode: 'open',
      };
    }

    default:
      return null;
  }
}

function toMessage(payload: ViewPayload) {
  return {
    embeds: payload.embeds,
    components: payload.components,
    files: payload.files ?? [],
    attachments: payload.attachments,
  };
}

async function apply(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  resolved: Resolved
): Promise<void> {
  const msg = toMessage(resolved.payload);
  if (resolved.mode === 'open') {
    await interaction.reply({ ...msg, flags: MessageFlags.Ephemeral });
  } else {
    await interaction.update(msg);
  }
}

/** Live entry point, wired to interactionCreate. Buttons and select menus only. */
export async function handleInteraction(interaction: Interaction): Promise<void> {
  // Playcall game buttons + select are side-effecting (drive state, RNG, live render); own them.
  if ((interaction.isButton() || interaction.isStringSelectMenu()) && interaction.customId.startsWith('imc:pc:')) {
    await handlePlaycall(interaction);
    return;
  }

  if (interaction.isButton()) {
    // Operator hub buttons are owner-gated and side-effecting; handled separately.
    if (interaction.customId.startsWith('imc:op:')) {
      await handleOperator(interaction);
      return;
    }
    const resolved = resolve(interaction.customId);
    if (!resolved) return;
    await apply(interaction, resolved);
    return;
  }

  if (interaction.isStringSelectMenu()) {
    const resolved = resolve(interaction.customId, interaction.values[0]);
    if (!resolved) return;
    await apply(interaction, resolved);
    return;
  }
}

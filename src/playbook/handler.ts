/**
 * CFB Playbook handler — owns imc:pb:* (the side -> set -> formation -> play drill-down).
 *
 * `imc:pb:open` (the hub button) replies with a fresh ephemeral session; every other
 * pb interaction updates the message in place. Selects carry the chosen index in
 * interaction.values[0]; buttons carry all state in the customId (see playbook/views.ts).
 */
import { ButtonInteraction, MessageFlags, StringSelectMenuInteraction } from 'discord.js';
import { ViewPayload } from '../ui/views';
import { decodeSide, pbDetail, pbFamilies, pbForms, pbHome, pbPlays, pbSets } from './views';

function num(s: string | undefined): number {
  const n = Number.parseInt(s ?? '', 10);
  return Number.isFinite(n) ? n : 0;
}

/** Pure dispatch: customId (+ select value) -> payload + delivery mode. */
export function resolvePlaybook(
  customId: string,
  selectValue?: string
): { payload: ViewPayload; mode: 'open' | 'update' } | null {
  const t = customId.split(':');
  if (t[0] !== 'imc' || t[1] !== 'pb') return null;
  const val = num(selectValue);

  switch (t[2]) {
    case 'open':
      return { payload: pbHome(), mode: 'open' };
    case 'home':
      return { payload: pbHome(), mode: 'update' };
    case 'sets':
      return { payload: pbSets(decodeSide(t[3])), mode: 'update' };
    case 'sset': // select -> value = setIdx -> families
      return { payload: pbFamilies(decodeSide(t[3]), val, 0), mode: 'update' };
    case 'fams':
      return { payload: pbFamilies(decodeSide(t[3]), num(t[4]), num(t[5])), mode: 'update' };
    case 'sfam': // select -> value = famIdx -> formations in that family
      return { payload: pbForms(decodeSide(t[3]), num(t[4]), val, 0), mode: 'update' };
    case 'forms':
      return { payload: pbForms(decodeSide(t[3]), num(t[4]), num(t[5]), num(t[6])), mode: 'update' };
    case 'sform': // select -> value = GLOBAL formIdx -> plays
      return { payload: pbPlays(decodeSide(t[3]), num(t[4]), val, 0), mode: 'update' };
    case 'plays':
      return { payload: pbPlays(decodeSide(t[3]), num(t[4]), num(t[5]), num(t[6])), mode: 'update' };
    case 'splay': // select -> value = playIdx
      return { payload: pbDetail(decodeSide(t[3]), num(t[4]), num(t[5]), val), mode: 'update' };
    case 'play':
      return { payload: pbDetail(decodeSide(t[3]), num(t[4]), num(t[5]), num(t[6])), mode: 'update' };
    default:
      return null;
  }
}

/** Live entry point for imc:pb:* buttons and selects. */
export async function handlePlaybook(interaction: ButtonInteraction | StringSelectMenuInteraction): Promise<void> {
  const selectValue = interaction.isStringSelectMenu() ? interaction.values[0] : undefined;
  const resolved = resolvePlaybook(interaction.customId, selectValue);
  if (!resolved) return;
  const msg = {
    embeds: resolved.payload.embeds,
    components: resolved.payload.components,
    files: resolved.payload.files ?? [],
    attachments: resolved.payload.attachments,
  };
  if (resolved.mode === 'open') {
    await interaction.reply({ ...msg, flags: MessageFlags.Ephemeral });
  } else {
    await interaction.update(msg);
  }
}

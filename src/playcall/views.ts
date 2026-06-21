/**
 * Playcall game views.
 *
 * Returns the same ViewPayload shape the rest of the bot uses, so the live handler and the smoke
 * test build identical payloads with no Discord connection. Every resolved play attaches a LIVE
 * HimkageVision diagram of the exact matchup, now decorated with real field position (numbered
 * yards, line of scrimmage, first-down line, end zone) and a slam-in outcome banner.
 */

import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } from 'discord.js';
import { ViewPayload } from '../ui/views';
import { OFFENSE, DEFENSE } from './catalog';
import { renderPlayGif } from './render';
import { eventFor } from './field';
import { Game, PlayRecord, fieldLabel, ordinal, situationLine } from './game';

const OFFENSE_COLOR = 0xe36414; // SnapFire orange
const DEFENSE_COLOR = 0x2c3e50; // Shinobi dark
const FOOTER = '🎮 Playcall // iMoveChainz';

export const PC_ID = {
  new: 'imc:pc:new', // open the side chooser
  start: (mode: 'off' | 'def') => `imc:pc:start:${mode}`,
  pick: 'imc:pc:pick', // offense select; value = offense id
  dir: (offId: string, d: 'l' | 'r') => `imc:pc:dir:${offId}:${d}`,
  defpick: 'imc:pc:defpick', // defense select; value = defense id
  quit: 'imc:pc:quit',
};

function truncate(s: string, max: number): string {
  return !s ? '' : s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

/** Live animated diagram of the exact matchup, decorated with the field state at the snap. */
function diagram(rec: PlayRecord): AttachmentBuilder {
  const event = eventFor(rec.note, rec.outcome.kind, rec.outcome.explosive, rec.off.kind === 'run');
  const gif = renderPlayGif(rec.model, { ballOn: rec.ballOn, toGo: rec.toGoAtSnap, event });
  return new AttachmentBuilder(gif, { name: 'play.gif' });
}

function quitButton(): ButtonBuilder {
  return new ButtonBuilder().setCustomId(PC_ID.quit).setLabel('End Drive').setEmoji('🛑').setStyle(ButtonStyle.Secondary);
}

function offenseSelectRow(): ActionRowBuilder<StringSelectMenuBuilder> {
  const select = new StringSelectMenuBuilder()
    .setCustomId(PC_ID.pick)
    .setPlaceholder('Call your play')
    .addOptions(
      OFFENSE.map((o) => ({ label: truncate(o.label, 100), value: o.id, description: truncate(`${o.kind === 'run' ? 'Run' : 'Pass'} · ${o.blurb}`, 100), emoji: o.emoji }))
    );
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

function defenseSelectRow(): ActionRowBuilder<StringSelectMenuBuilder> {
  const select = new StringSelectMenuBuilder()
    .setCustomId(PC_ID.defpick)
    .setPlaceholder('Call your defense')
    .addOptions(
      DEFENSE.map((d) => ({ label: truncate(d.label, 100), value: d.id, description: truncate(`${d.blitz ? 'Pressure · ' : ''}${d.blurb}`, 100), emoji: d.emoji }))
    );
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

function driveLog(g: Game, max = 6): string {
  if (!g.plays.length) return '';
  return g.plays
    .slice(-max)
    .map((p) => {
      const tag = p.outcome.turnover ? '🔁' : p.note === 'TOUCHDOWN' ? '🏈' : p.outcome.explosive ? '💥' : p.outcome.yards <= 0 ? '🛑' : '✅';
      const y = p.outcome.kind === 'SACK' || p.outcome.yards < 0 ? `${p.outcome.yards}` : `+${p.outcome.yards}`;
      return `${tag} ${ordinal(p.downAtSnap)}&${p.toGoAtSnap} ${fieldLabel(p.ballOn)}: ${p.off.emoji} ${p.off.label} vs ${p.def.label} → ${y}`;
    })
    .join('\n');
}

/** Side chooser shown when a drive is (re)started. */
export function buildStartView(): ViewPayload {
  const embed = new EmbedBuilder()
    .setColor(0x34495e)
    .setTitle('🎮 Playcall')
    .setDescription(['Pick your side. The other side is called by the bot, and the engine draws every snap.', '', '🔥 **Offense (SnapFire):** move the chains and score.', '🥷🏿 **Defense (Shinobi):** force stops and takeaways.'].join('\n'))
    .setFooter({ text: FOOTER });
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(PC_ID.start('off')).setLabel('Play Offense').setEmoji('🔥').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(PC_ID.start('def')).setLabel('Play Defense').setEmoji('🥷🏿').setStyle(ButtonStyle.Primary)
  );
  return { embeds: [embed], components: [row], files: [], attachments: [] };
}

/** Main per-down view: the last play (with its live diagram) + the picker for your side. */
export function buildTurnView(g: Game): ViewPayload {
  const color = g.mode === 'offense' ? OFFENSE_COLOR : DEFENSE_COLOR;
  const embed = new EmbedBuilder().setColor(color).setFooter({ text: FOOTER });
  const files: AttachmentBuilder[] = [];

  if (g.last) {
    const p = g.last;
    embed.setTitle(p.outcome.text).setDescription([`**${situationLine(g)}**`, '', `_${p.outcome.why}_`].join('\n'));
    const yourCall = g.mode === 'offense' ? { name: 'Your call', value: `${p.off.emoji} ${p.off.label}` } : { name: 'Your defense', value: `${p.def.emoji} ${p.def.label}` };
    const theirCall = g.mode === 'offense' ? { name: 'Defense', value: `${p.def.emoji} ${p.def.label}` } : { name: 'Offense', value: `${p.off.emoji} ${p.off.label}` };
    embed.addFields({ ...yourCall, inline: true }, { ...theirCall, inline: true }, { name: 'Drive', value: driveLog(g) || '—', inline: false });
    files.push(diagram(p));
    embed.setImage('attachment://play.gif');
  } else {
    embed
      .setTitle(g.mode === 'offense' ? '🔥 SnapFire Drive' : '🥷🏿 Shinobi Stand')
      .setDescription(
        g.mode === 'offense'
          ? [`**${situationLine(g)}**`, '', 'You are on offense. The Shinobi bot answers every call.', 'Pick a play, choose a side, move the chains.'].join('\n')
          : [`**${situationLine(g)}**`, '', 'The SnapFire bot has the ball. Call your front and coverage.', 'Force a stop or a takeaway before they score.'].join('\n')
      );
  }

  const picker = g.mode === 'offense' ? offenseSelectRow() : defenseSelectRow();
  return { embeds: [embed], components: [picker, new ActionRowBuilder<ButtonBuilder>().addComponents(quitButton())], files, attachments: [] };
}

/** Offense mode: after picking a play, choose a direction. */
export function buildDirView(g: Game, offId: string): ViewPayload {
  const off = OFFENSE.find((o) => o.id === offId)!;
  const embed = new EmbedBuilder()
    .setColor(OFFENSE_COLOR)
    .setTitle(`${off.emoji} ${off.label}`)
    .setDescription([`**${situationLine(g)}**`, '', `_${off.blurb}_`, '', 'Pick your side.'].join('\n'))
    .setFooter({ text: FOOTER });
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(PC_ID.dir(offId, 'l')).setLabel('Left').setEmoji('◀️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(PC_ID.dir(offId, 'r')).setLabel('Right').setEmoji('▶️').setStyle(ButtonStyle.Primary)
  );
  const back = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(PC_ID.new).setLabel('Different play').setEmoji('↩️').setStyle(ButtonStyle.Secondary),
    quitButton()
  );
  return { embeds: [embed], components: [row, back], files: [], attachments: [] };
}

/** Drive over: mode-aware result, summary, and the final play's diagram. */
export function buildOverView(g: Game): ViewPayload {
  const lastNote = g.last?.note ?? '';
  const stop = lastNote === 'TURNOVER ON DOWNS' || lastNote === 'INTERCEPTED' || lastNote === 'FUMBLE LOST' || lastNote === 'SAFETY';
  const good = g.mode === 'offense' ? g.points > 0 : stop; // offense wants points; defense wants a stop

  const embed = new EmbedBuilder()
    .setColor(good ? 0x57f287 : 0xed4245)
    .setTitle((good ? '🏆 ' : '🧱 ') + (g.endline ?? 'Drive over.'))
    .setFooter({ text: FOOTER });

  const files: AttachmentBuilder[] = [];
  if (g.last) {
    files.push(diagram(g.last));
    embed.setImage('attachment://play.gif');
  }

  const yards = g.plays.reduce((s, p) => s + Math.max(0, p.outcome.yards), 0);
  const scoreLine = g.mode === 'offense' ? `**Result:** ${g.points} points` : `**Points allowed:** ${g.points}`;
  embed.setDescription([scoreLine, `**Plays:** ${g.plays.length}  ·  **Yards:** ${yards}`, '', driveLog(g, 8) || '—'].join('\n'));

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(PC_ID.new).setLabel('New Drive').setEmoji('🔄').setStyle(ButtonStyle.Success));
  return { embeds: [embed], components: [row], files, attachments: [] };
}

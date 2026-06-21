/**
 * Playcall game views.
 *
 * Returns the same ViewPayload shape the rest of the bot uses, so the live handler and the smoke
 * test build identical payloads with no Discord connection. Every resolved play attaches a LIVE
 * HimkageVision diagram of the exact matchup (rendered from the engine model, never a pre-baked
 * image), which is the whole point: you see your call drawn against the front and coverage you
 * actually faced.
 */

import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } from 'discord.js';
import { ViewPayload } from '../ui/views';
import { OFFENSE } from './catalog';
import { renderPlayPng } from './render';
import { Game, PlayRecord, fieldLabel, ordinal, situationLine } from './game';
import { PlayModel } from './engine';

const OFFENSE_COLOR = 0xe36414; // SnapFire orange
const FOOTER = '🎮 Playcall // iMoveChainz';

export const PC_ID = {
  new: 'imc:pc:new',
  pick: 'imc:pc:pick', // select menu; value = offense id
  dir: (offId: string, d: 'l' | 'r') => `imc:pc:dir:${offId}:${d}`,
  quit: 'imc:pc:quit',
};

function truncate(s: string, max: number): string {
  return !s ? '' : s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

function diagram(model: PlayModel, g = 0.62): AttachmentBuilder {
  const png = renderPlayPng(model, g);
  return new AttachmentBuilder(png, { name: 'play.png' });
}

function offenseSelectRow(): ActionRowBuilder<StringSelectMenuBuilder> {
  const select = new StringSelectMenuBuilder()
    .setCustomId(PC_ID.pick)
    .setPlaceholder('Call your play')
    .addOptions(
      OFFENSE.map((o) => ({
        label: truncate(`${o.label}`, 100),
        value: o.id,
        description: truncate(`${o.kind === 'run' ? 'Run' : 'Pass'} · ${o.blurb}`, 100),
        emoji: o.emoji,
      }))
    );
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

function quitButton(): ButtonBuilder {
  return new ButtonBuilder().setCustomId(PC_ID.quit).setLabel('End Drive').setEmoji('🛑').setStyle(ButtonStyle.Secondary);
}

function driveLog(g: Game, max = 6): string {
  if (!g.plays.length) return '';
  const recent = g.plays.slice(-max);
  const lines = recent.map((p) => {
    const where = fieldLabel(p.ballOn);
    const tag = p.outcome.turnover ? '🔁' : p.outcome.explosive ? '💥' : p.outcome.yards <= 0 ? '🛑' : '✅';
    const y = p.outcome.kind === 'SACK' || p.outcome.yards < 0 ? `${p.outcome.yards}` : `+${p.outcome.yards}`;
    return `${tag} ${ordinal(p.down)}&${typeof p.toGo === 'number' ? p.toGo : p.toGo} ${where}: ${p.off.emoji} ${p.off.label} vs ${p.def.label} → ${y}`;
  });
  return lines.join('\n');
}

/** The main "call your play" view. Shows the previous result + its live diagram when mid-drive. */
export function buildCallView(g: Game): ViewPayload {
  const embed = new EmbedBuilder().setColor(OFFENSE_COLOR).setFooter({ text: FOOTER });
  const files: AttachmentBuilder[] = [];

  if (g.last) {
    const p = g.last;
    embed
      .setTitle(`${p.outcome.text}`)
      .setDescription([`**${situationLine(g)}**`, '', `_${p.outcome.why}_`].join('\n'));
    embed.addFields(
      { name: 'Your call', value: `${p.off.emoji} ${p.off.label}`, inline: true },
      { name: 'Defense', value: `${p.def.emoji} ${p.def.label}`, inline: true },
      { name: 'Drive', value: driveLog(g) || '—', inline: false }
    );
    files.push(diagram(p.model));
    embed.setImage('attachment://play.png');
  } else {
    embed
      .setTitle('🏈 Playcall — SnapFire Drive')
      .setDescription(
        [
          `**${situationLine(g)}**`,
          '',
          'You are on offense. The Shinobi defense answers every call.',
          'Pick a play, choose a side, and move the chains. Score before the drive dies.',
        ].join('\n')
      );
  }

  return { embeds: [embed], components: [offenseSelectRow(), new ActionRowBuilder<ButtonBuilder>().addComponents(quitButton())], files, attachments: [] };
}

/** After picking a play: choose a direction to run/throw it. */
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

/** Drive over: final result, summary, and the last play's diagram. */
export function buildOverView(g: Game): ViewPayload {
  const embed = new EmbedBuilder()
    .setColor(g.points > 0 ? 0x57f287 : 0xed4245)
    .setTitle(g.points > 0 ? '🏆 ' + (g.endline ?? 'Drive scored.') : '🧱 ' + (g.endline ?? 'Drive over.'))
    .setFooter({ text: FOOTER });

  const files: AttachmentBuilder[] = [];
  if (g.last) {
    files.push(diagram(g.last.model, g.last.outcome.explosive ? 0.85 : 0.62));
    embed.setImage('attachment://play.png');
  }

  const yards = g.plays.reduce((s, p: PlayRecord) => s + Math.max(0, p.outcome.yards), 0);
  embed.setDescription(
    [`**Result:** ${g.points} points`, `**Plays:** ${g.plays.length}  ·  **Yards:** ${yards}`, '', driveLog(g, 8) || '—'].join('\n')
  );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(PC_ID.new).setLabel('New Drive').setEmoji('🔄').setStyle(ButtonStyle.Success)
  );
  return { embeds: [embed], components: [row], files, attachments: [] };
}

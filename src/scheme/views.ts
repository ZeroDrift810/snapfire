/**
 * Scheme Builder views.
 *
 * The authoring flow: setup (base scheme + tempo) -> pick up to 12 core concepts in three grouped
 * multi-selects -> the Scheme Identity card (identity + concepts by bucket + balance vs the
 * recommended counts + the custom-playbook roadmap). Same ViewPayload shape as the rest of the bot.
 */

import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } from 'discord.js';
import { ViewPayload } from '../ui/views';
import { allSchemes, allTempos, getScheme, getTempo } from './data';
import { balance, conceptsByBucket, CORE_TARGET, GROUPS, groupConcepts, roadmap, SchemeBuild } from './builder';

const GOLD = 0xe6b400;
const FOOTER = '🧩 Scheme Builder // iMoveChainz';

export const SB_ID = {
  new: 'imc:sb:new',
  scheme: 'imc:sb:scheme',
  tempo: 'imc:sb:tempo',
  toConcepts: 'imc:sb:concepts',
  group: (g: string) => `imc:sb:grp:${g}`,
  review: 'imc:sb:review',
  edit: 'imc:sb:edit',
  exportImage: 'imc:sb:img',
  exportPdf: 'imc:sb:pdf',
};

function truncate(s: string, max: number): string {
  return !s ? '' : s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

/** Step 1: choose a base scheme + tempo. */
export function buildSetupView(b: SchemeBuild): ViewPayload {
  const embed = new EmbedBuilder()
    .setColor(GOLD)
    .setTitle('🧩 Build a Scheme')
    .setDescription(
      [
        'Declare your identity, then pick your core concepts. This is the same process pros use to build a custom playbook.',
        '',
        `**Base scheme:** ${b.schemeId ? getScheme(b.schemeId)?.name : '_pick one_'}`,
        `**Tempo:** ${b.tempoId ? getTempo(b.tempoId)?.name : '_pick one_'}`,
        '',
        'Set these, then move on to your 12 core concepts.',
      ].join('\n')
    )
    .setFooter({ text: FOOTER });

  const schemeSel = new StringSelectMenuBuilder()
    .setCustomId(SB_ID.scheme)
    .setPlaceholder('Base scheme')
    .addOptions(allSchemes().map((s) => ({ label: truncate(s.name, 100), value: s.id, default: s.id === b.schemeId })));
  const tempoSel = new StringSelectMenuBuilder()
    .setCustomId(SB_ID.tempo)
    .setPlaceholder('Tempo')
    .addOptions(allTempos().map((t) => ({ label: truncate(t.name, 100), value: t.id, default: t.id === b.tempoId })));

  const next = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(SB_ID.toConcepts).setLabel('Pick Concepts').setEmoji('➡️').setStyle(ButtonStyle.Primary)
  );
  return { embeds: [embed], components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(schemeSel), new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(tempoSel), next], attachments: [] };
}

/** Step 2: pick concepts in three grouped multi-selects, with a running tally. */
export function buildConceptView(b: SchemeBuild): ViewPayload {
  const selected = new Set(b.concepts);
  const rows: ActionRowBuilder<StringSelectMenuBuilder>[] = GROUPS.map((g) => {
    const opts = groupConcepts(g.id);
    const sel = new StringSelectMenuBuilder()
      .setCustomId(SB_ID.group(g.id))
      .setPlaceholder(g.label)
      .setMinValues(0)
      .setMaxValues(Math.min(opts.length, 25))
      .addOptions(
        opts.slice(0, 25).map((c) => ({
          label: truncate(c.name, 100),
          value: c.id,
          description: truncate(`${c.bucketLabel}${c.examples[0] ? ` · e.g. ${c.examples[0].play}` : ''}`, 100),
          default: selected.has(c.id),
        }))
      );
    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(sel);
  });

  const count = b.concepts.length;
  const embed = new EmbedBuilder()
    .setColor(GOLD)
    .setTitle(`🧩 Core Concepts — ${count}/${CORE_TARGET}`)
    .setDescription(
      [
        'Pick the concepts you will lean on (the soft cap is 12). Each bucket has a recommended range; the review will flag anything off.',
        '',
        balance(b)
          .map((bk) => `${bk.status === 'ok' ? '✅' : bk.status === 'low' ? '🔻' : '🔺'} **${bk.label}:** ${bk.count} _(rec ${bk.recommended[0]}-${bk.recommended[1]})_`)
          .join('\n'),
      ].join('\n')
    )
    .setFooter({ text: FOOTER });

  const review = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(SB_ID.review).setLabel('Build Identity Card').setEmoji('📋').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(SB_ID.new).setLabel('Restart').setEmoji('🔄').setStyle(ButtonStyle.Secondary)
  );
  return { embeds: [embed], components: [...rows, review], attachments: [] };
}

/** Step 3: the Scheme Identity card. */
export function buildIdentityView(b: SchemeBuild): ViewPayload {
  const scheme = b.schemeId ? getScheme(b.schemeId)?.name : 'Custom Scheme';
  const tempo = b.tempoId ? getTempo(b.tempoId)?.name : 'Tempo not set';
  const embed = new EmbedBuilder()
    .setColor(GOLD)
    .setTitle(`🧩 ${scheme}`)
    .setDescription(`**Tempo:** ${tempo}  ·  **Core concepts:** ${b.concepts.length}/${CORE_TARGET}`)
    .setFooter({ text: FOOTER });

  for (const g of conceptsByBucket(b)) {
    embed.addFields({ name: g.label, value: truncate(g.concepts.map((c) => `\`${c.name}\``).join('  '), 1024), inline: false });
  }

  const bal = balance(b).filter((bk) => bk.count > 0 || bk.status !== 'ok');
  embed.addFields({
    name: '⚖️ Balance',
    value: truncate(bal.map((bk) => `${bk.status === 'ok' ? '✅' : bk.status === 'low' ? '🔻' : '🔺'} ${bk.label}: ${bk.count} (${bk.recommended[0]}-${bk.recommended[1]})`).join('\n') || 'No concepts yet.', 1024),
    inline: false,
  });

  const rm = roadmap(b).slice(0, 6);
  if (rm.length) {
    embed.addFields({
      name: '🏈 Custom playbook roadmap',
      value: truncate(rm.map((r) => `**${r.formation}** — carries ${r.conceptCount} of your concepts (${r.total} plays)`).join('\n'), 1024),
      inline: false,
    });
    embed.addFields({ name: 'Reference plays (M24)', value: truncate(exampleLine(b), 1024), inline: false });
  }

  const exports = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(SB_ID.exportImage).setLabel('Export Card').setEmoji('🖼️').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(SB_ID.exportPdf).setLabel('Export PDF').setEmoji('📄').setStyle(ButtonStyle.Success)
  );
  const actions = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(SB_ID.edit).setLabel('Edit Concepts').setEmoji('✏️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(SB_ID.new).setLabel('New Scheme').setEmoji('🔄').setStyle(ButtonStyle.Secondary)
  );
  return { embeds: [embed], components: [exports, actions], attachments: [] };
}

function exampleLine(b: SchemeBuild): string {
  const lines: string[] = [];
  for (const g of conceptsByBucket(b)) {
    for (const c of g.concepts) {
      const ex = c.examples.slice(0, 2).map((e) => e.play);
      if (ex.length) lines.push(`**${c.name}:** ${ex.join(', ')}`);
      if (lines.length >= 8) return lines.join('\n');
    }
  }
  return lines.join('\n') || '—';
}

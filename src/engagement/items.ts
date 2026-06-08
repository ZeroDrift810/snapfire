/**
 * Engagement autoposts.
 *
 * Recurring, on-brand community content built from the same authored knowledge the
 * bot serves (content/*.json). Deterministic by design: a date-based rotation picks
 * the feature, so the same day always shows the same term/coverage (no randomness,
 * no off-message AI improvisation). OpenClaw (or cron) triggers these via the
 * autopost script; the buttons deep-link players into a private teaching session.
 *
 * Voice: teaching register. No hype, no "AI", no em dashes. Marketing copy is a
 * separate product and does not live here.
 */

import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { Card, getCards } from '../content/cards';
import { GENERIC_BRAND } from '../knowledge/types';
import { ID } from '../ui/ids';

export interface AutopostMessage {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
}

export const AUTOPOST_ITEMS = ['term-of-the-day', 'coverage-of-the-week', 'beat-this-look'] as const;
export type AutopostItem = (typeof AUTOPOST_ITEMS)[number];

// --- date-based rotation (deterministic) ----------------------------------

function dayIndex(now = new Date()): number {
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86_400_000);
}

function weekIndex(now = new Date()): number {
  return Math.floor(dayIndex(now) / 7);
}

function pick<T>(arr: T[], idx: number): T {
  return arr[((idx % arr.length) + arr.length) % arr.length];
}

function truncate(text: string, max: number): string {
  if (!text) return '';
  return text.length <= max ? text : text.slice(0, max - 1) + '…';
}

function sectionBody(card: Card, heading: string): string | undefined {
  return card.sections.find((s) => s.heading.toLowerCase() === heading.toLowerCase())?.body;
}

// --- Term of the Day ------------------------------------------------------

export function buildTermOfDay(now = new Date()): AutopostMessage {
  const terms = getCards('glossary');
  const card = pick(terms, dayIndex(now));
  const def = card.sections[0]?.body ?? '';

  const embed = new EmbedBuilder()
    .setColor(GENERIC_BRAND.color)
    .setTitle(`📖 Term of the Day: ${card.name}`)
    .setDescription(truncate(def, 700))
    .setFooter({ text: GENERIC_BRAND.footer });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(ID.show('glossary', card.id))
      .setLabel(`Open: ${truncate(card.name, 40)}`)
      .setEmoji('📖')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(ID.openTrack('glossary'))
      .setLabel('Browse Terms')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
}

// --- Coverage of the Week -------------------------------------------------

export function buildCoverageOfWeek(now = new Date()): AutopostMessage {
  const covs = getCards('coverage');
  const card = pick(covs, weekIndex(now));

  const embed = new EmbedBuilder()
    .setColor(0x2980b9)
    .setTitle(`🛡️ Coverage of the Week: ${card.name}`)
    .setDescription(card.subtitle || 'A coverage worth knowing cold.')
    .setFooter({ text: GENERIC_BRAND.footer });

  const whatItIs = sectionBody(card, 'What it is');
  const theVoid = sectionBody(card, 'The void');
  if (whatItIs) embed.addFields({ name: 'What it is', value: truncate(whatItIs, 1024), inline: false });
  if (theVoid) embed.addFields({ name: 'The void', value: truncate(theVoid, 1024), inline: false });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(ID.show('coverage', card.id))
      .setLabel('How to beat it')
      .setEmoji('🛡️')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(ID.openTrack('coverage'))
      .setLabel('All Coverages')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
}

// --- Beat This Look -------------------------------------------------------

export function buildBeatThisLook(now = new Date()): AutopostMessage {
  const covs = getCards('coverage');
  const card = pick(covs, dayIndex(now));

  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle('🎯 Beat This Look')
    .setDescription(
      [
        `Your opponent keeps sitting in **${card.name}**.`,
        card.subtitle ? `*${card.subtitle}*` : '',
        '',
        'You recognized the shell. Now what is your answer?',
        'Think it through, then reveal it.',
      ]
        .filter(Boolean)
        .join('\n')
    )
    .setFooter({ text: GENERIC_BRAND.footer });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(ID.show('coverage', card.id))
      .setLabel('Reveal the answer')
      .setEmoji('🎯')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(ID.openTrack('coverage'))
      .setLabel('All Coverages')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
}

// --- registry -------------------------------------------------------------

export const BUILDERS: Record<AutopostItem, (now?: Date) => AutopostMessage> = {
  'term-of-the-day': buildTermOfDay,
  'coverage-of-the-week': buildCoverageOfWeek,
  'beat-this-look': buildBeatThisLook,
};

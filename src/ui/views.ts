/**
 * View builders for the button-driven teaching UI.
 *
 * Every function returns a plain payload ({ embeds, components, files?, attachments })
 * so the same builders are used by the live router AND the smoke test, with no Discord
 * connection required to validate them.
 */

import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import { getAllSchemes } from '../knowledge/loader';
import { BRAND_CONFIGS, GENERIC_BRAND } from '../knowledge/types';
import {
  Card,
  CardTrack,
  getCard,
  getCards,
  resolveCard,
} from '../content/cards';
import {
  DEFAULT_FILTER,
  FACETS,
  ID,
  isCardTrack,
  PAGE_SIZE,
  Track,
  TRACK_BLURB,
  TRACK_EMOJI,
  TRACK_LABEL,
} from './ids';

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

export interface ViewPayload {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<any>[];
  files?: AttachmentBuilder[];
  attachments: any[];
}

interface Row {
  id: string;
  label: string;
  desc: string;
}

const TRACK_COLOR: Record<Track, number> = {
  glossary: GENERIC_BRAND.color, // gray
  coverage: 0x2980b9, // blue
  concept: 0x57f287, // green
  run: 0x1abc9c, // teal
  front: 0xed4245, // red
  usering: 0x9b59b6, // purple
  playbook: BRAND_CONFIGS.SNAPFIRE.color, // overridden per scheme
  situational: 0xe67e22, // orange
};

function truncate(text: string, max: number): string {
  if (!text) return '';
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}

function field(text: string, max = 1024): string {
  return truncate(text, max);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function homeButton(): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(ID.hub)
    .setLabel('Home')
    .setEmoji('🏠')
    .setStyle(ButtonStyle.Secondary);
}

// ---------------------------------------------------------------------------
// Browse rows
// ---------------------------------------------------------------------------

function rowsFor(track: Track, filter: string): Row[] {
  if (isCardTrack(track)) {
    return getCards(track as CardTrack).map((c) => ({
      id: c.id,
      label: c.name,
      desc: c.subtitle || (c.tags && c.tags.length ? c.tags.join(', ') : ''),
    }));
  }
  // playbook (schemes)
  return getAllSchemes()
    .filter((s) => s.system.toLowerCase() === filter)
    .map((s) => ({
      id: s.name,
      label: s.display_name,
      desc: s.formation_family || 'Playbook',
    }));
}

function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

// ---------------------------------------------------------------------------
// HUB
// ---------------------------------------------------------------------------

const HUB_ORDER: Track[] = ['glossary', 'coverage', 'concept', 'run', 'front', 'usering', 'playbook', 'situational'];

function hubEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(GENERIC_BRAND.color)
    .setTitle('iMoveChainz')
    .setDescription(
      [
        'Football IQ for Madden and CFB. Pick a track to start.',
        '',
        ...HUB_ORDER.map((t) => `${TRACK_EMOJI[t]} **${TRACK_LABEL[t]}:** ${TRACK_BLURB[t]}`),
      ].join('\n')
    )
    .setFooter({ text: GENERIC_BRAND.footer });
}

export function buildHubPublic(): ViewPayload {
  const buttons = HUB_ORDER.map((t) =>
    new ButtonBuilder()
      .setCustomId(ID.openTrack(t))
      .setLabel(TRACK_LABEL[t])
      .setEmoji(TRACK_EMOJI[t])
      .setStyle(ButtonStyle.Primary)
  );
  const components = chunk(buttons, 3).map((g) =>
    new ActionRowBuilder<ButtonBuilder>().addComponents(g)
  );
  return { embeds: [hubEmbed()], components, attachments: [] };
}

export function buildHubSession(): ViewPayload {
  const buttons = HUB_ORDER.map((t) =>
    new ButtonBuilder()
      .setCustomId(ID.list(t, DEFAULT_FILTER[t], 0))
      .setLabel(TRACK_LABEL[t])
      .setEmoji(TRACK_EMOJI[t])
      .setStyle(ButtonStyle.Primary)
  );
  const components = chunk(buttons, 3).map((g) =>
    new ActionRowBuilder<ButtonBuilder>().addComponents(g)
  );
  return { embeds: [hubEmbed()], components, attachments: [] };
}

// ---------------------------------------------------------------------------
// LIST (browse)
// ---------------------------------------------------------------------------

export function buildList(track: Track, filterIn: string, pageIn: number): ViewPayload {
  const facets = FACETS[track];
  const filter = facets.some((f) => f.token === filterIn) || filterIn === 'all'
    ? filterIn
    : DEFAULT_FILTER[track];

  const all = rowsFor(track, filter);
  const pages = pageCount(all.length);
  const page = Math.min(Math.max(0, pageIn), pages - 1);
  const start = page * PAGE_SIZE;
  const slice = all.slice(start, start + PAGE_SIZE);

  const activeFacet = facets.find((f) => f.token === filter)?.label;

  const embed = new EmbedBuilder()
    .setColor(
      track === 'playbook'
        ? BRAND_CONFIGS[filter === 'shinobi' ? 'SHINOBI' : 'SNAPFIRE'].color
        : TRACK_COLOR[track]
    )
    .setTitle(`${TRACK_EMOJI[track]} ${TRACK_LABEL[track]}${activeFacet ? ` · ${activeFacet}` : ''}`)
    .setDescription(
      `${TRACK_BLURB[track]}\n\n${all.length} in this track. Tap one to open it.\nPage ${page + 1} of ${pages}.`
    )
    .setFooter({ text: GENERIC_BRAND.footer });

  const components: ActionRowBuilder<any>[] = [];

  if (slice.length > 0) {
    const seen = new Set<string>();
    const select = new StringSelectMenuBuilder()
      .setCustomId(ID.pick(track, filter, page))
      .setPlaceholder('Choose one to open')
      .addOptions(
        slice
          .filter((r) => {
            if (seen.has(r.id)) return false;
            seen.add(r.id);
            return true;
          })
          .map((r) => {
            const opt: { label: string; value: string; description?: string } = {
              label: truncate(r.label, 100),
              value: truncate(r.id, 100),
            };
            if (r.desc) opt.description = truncate(r.desc, 100);
            return opt;
          })
      );
    components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select));
  }

  // Facet filter buttons (playbook only).
  if (facets.length > 0) {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      facets.map((f) =>
        new ButtonBuilder()
          .setCustomId(ID.list(track, f.token, 0))
          .setLabel(f.label)
          .setStyle(f.token === filter ? ButtonStyle.Primary : ButtonStyle.Secondary)
      )
    );
    components.push(row);
  }

  const pager = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(ID.page(track, filter, 'p', Math.max(0, page - 1)))
      .setLabel('Prev')
      .setEmoji('◀️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId(ID.page(track, filter, 'n', Math.min(pages - 1, page + 1)))
      .setLabel('Next')
      .setEmoji('▶️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= pages - 1),
    homeButton()
  );
  components.push(pager);

  return { embeds: [embed], components, attachments: [] };
}

// ---------------------------------------------------------------------------
// DETAIL
// ---------------------------------------------------------------------------

function backRow(track: Track, filter: string, page: number): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(ID.list(track, filter, page))
      .setLabel('Back')
      .setEmoji('◀️')
      .setStyle(ButtonStyle.Secondary),
    homeButton()
  );
}

function notFound(track: Track, filter: string, page: number, id: string): ViewPayload {
  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle('Not in the book yet')
    .setDescription(`That entry could not be loaded: \`${truncate(id, 80)}\``)
    .setFooter({ text: GENERIC_BRAND.footer });
  return { embeds: [embed], components: [backRow(track, filter, page)], attachments: [] };
}

/** Render a teaching card with its sections and cross-linked related buttons. */
function cardDetail(
  track: CardTrack,
  card: Card,
  filter: string,
  page: number
): ViewPayload {
  const embed = new EmbedBuilder()
    .setColor(TRACK_COLOR[track])
    .setTitle(`${TRACK_EMOJI[track]} ${card.name}`)
    .setFooter({ text: GENERIC_BRAND.footer });

  if (card.subtitle) embed.setDescription(card.subtitle);

  embed.addFields(
    card.sections.slice(0, 25).map((s) => ({
      name: truncate(s.heading, 256),
      value: field(s.body),
      inline: false,
    }))
  );

  // Optional engine-generated diagram (original art in assets/card_art/), attached like play art.
  const files: AttachmentBuilder[] = [];
  if (card.image) {
    const imagePath = path.join(PROJECT_ROOT, 'assets', 'card_art', card.image);
    if (fs.existsSync(imagePath)) {
      files.push(new AttachmentBuilder(imagePath, { name: 'diagram.png' }));
      embed.setImage('attachment://diagram.png');
    }
  }

  const components: ActionRowBuilder<any>[] = [];

  // Related "tap to learn" buttons (cross-track), capped to keep within row limits.
  if (card.related && card.related.length) {
    const seen = new Set<string>();
    const relButtons: ButtonBuilder[] = [];
    for (const rid of card.related) {
      if (seen.has(rid)) continue;
      seen.add(rid);
      const r = resolveCard(rid);
      if (!r) continue; // dead links are dropped, the smoke test flags them
      relButtons.push(
        new ButtonBuilder()
          .setCustomId(ID.goto(rid))
          .setLabel(truncate(r.card.name, 80))
          .setStyle(ButtonStyle.Secondary)
      );
      if (relButtons.length >= 6) break;
    }
    for (const g of chunk(relButtons, 3)) {
      components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(g));
    }
  }

  components.push(backRow(track, filter, page));
  return { embeds: [embed], components, files, attachments: [] };
}

/** Scheme (playbook) detail, with play art attached. */
function schemeDetail(id: string, filter: string, page: number): ViewPayload {
  const s = getAllSchemes().find((x) => x.name === id);
  if (!s) return notFound('playbook', filter, page, id);
  const brand = BRAND_CONFIGS[s.system];

  const fields: { name: string; value: string; inline: boolean }[] = [];
  if (s.routes && s.routes.length) {
    const routeText = s.routes
      .slice(0, 8)
      .map((r) => {
        let line = `• **${r.receiver}:** ${r.route}`;
        if (r.note && r.note !== r.route) line += ` *(${r.note})*`;
        return line;
      })
      .join('\n');
    fields.push({ name: '📋 Assignments', value: field(routeText), inline: false });
  }
  if (s.reads && s.reads.length) {
    fields.push({ name: '🧠 Reads / Keys', value: field(s.reads.join('\n')), inline: false });
  }
  if (s.usage_notes && s.usage_notes.trim()) {
    fields.push({ name: '💡 Strategy', value: field(s.usage_notes), inline: false });
  }

  const embed = new EmbedBuilder()
    .setColor(brand.color)
    .setTitle(`${brand.emoji} ${s.display_name}`)
    .setDescription(`**Formation:** ${s.formation_family}`)
    .addFields(fields)
    .setFooter({ text: brand.footer });

  const files: AttachmentBuilder[] = [];
  if (s.image_file) {
    const imagePath = path.join(PROJECT_ROOT, 'assets', 'play_art', s.image_file);
    if (fs.existsSync(imagePath)) {
      files.push(new AttachmentBuilder(imagePath, { name: 'play_art.png' }));
      embed.setImage('attachment://play_art.png');
    }
  }

  return { embeds: [embed], components: [backRow('playbook', filter, page)], files, attachments: [] };
}

export function buildDetail(track: Track, id: string, filter: string, page: number): ViewPayload {
  if (track === 'playbook') return schemeDetail(id, filter, page);
  const card = getCard(track as CardTrack, id);
  if (!card) return notFound(track, filter, page, id);
  return cardDetail(track as CardTrack, card, filter, page);
}

/** Related-link jump: resolve the id to whichever track owns it and open its detail. */
export function buildGoto(id: string): ViewPayload {
  const r = resolveCard(id);
  if (!r) {
    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('Not in the book yet')
      .setDescription(`That term could not be loaded: \`${truncate(id, 80)}\``)
      .setFooter({ text: GENERIC_BRAND.footer });
    return { embeds: [embed], components: [backRow('glossary', 'all', 0)], attachments: [] };
  }
  return cardDetail(r.track, r.card, DEFAULT_FILTER[r.track], 0);
}

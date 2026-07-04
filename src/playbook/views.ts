/**
 * CFB Playbook browse views — a faithful side -> set -> formation -> play navigator over the
 * real scraped library. Every card is the true play name + formation + diagram (+ coverage on
 * defense). No fabricated assignments/reads/strategy: the diagram is the source of truth.
 *
 * customId grammar (imc:pb:*, owned by playbook/handler.ts):
 *   imc:pb:home                                  pick Offense / Defense
 *   imc:pb:sets:<sd>                             list sets/fronts for a side
 *   imc:pb:sset:<sd>            (select)         value = setIdx -> formations
 *   imc:pb:forms:<sd>:<st>:<pg>                  list formations (paged), also pager/back
 *   imc:pb:sform:<sd>:<st>:<pg> (select)         value = formIdx -> plays
 *   imc:pb:plays:<sd>:<st>:<fm>:<pg>             list plays (paged), also pager/back
 *   imc:pb:splay:<sd>:<st>:<fm>:<pg> (select)    value = playIdx -> detail
 *   imc:pb:play:<sd>:<st>:<fm>:<pl>              play detail card
 * <sd> = O|D. All other tokens are integer indices into stable sorted lists.
 */
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import { ViewPayload } from '../ui/views';
import {
  artPath,
  formationName,
  formations,
  play,
  PlayNode,
  playbookCounts,
  playbookGame,
  plays,
  setName,
  sets,
  Side,
  SIDE_LABEL,
} from '../knowledge/playbook';

const PAGE = 25;
const OFF_COLOR = 0xe36414; // orange
const DEF_COLOR = 0x2c3e50; // dark
const FOOTER = 'iMoveChainz Playbook';

const SD: Record<'O' | 'D', Side> = { O: 'OFF', D: 'DEF' };
const SD_CODE: Record<Side, 'O' | 'D'> = { OFF: 'O', DEF: 'D' };

export function decodeSide(c: string): Side {
  return SD[c as 'O' | 'D'] ?? 'OFF';
}
function sideColor(side: Side): number {
  return side === 'OFF' ? OFF_COLOR : DEF_COLOR;
}
function truncate(s: string, max: number): string {
  if (!s) return '';
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}
function homeButton(): ButtonBuilder {
  return new ButtonBuilder().setCustomId('imc:hub').setLabel('Home').setEmoji('🏠').setStyle(ButtonStyle.Secondary);
}
function backButton(customId: string, label = 'Back'): ButtonBuilder {
  return new ButtonBuilder().setCustomId(customId).setLabel(label).setEmoji('◀️').setStyle(ButtonStyle.Secondary);
}

// ---------------------------------------------------------------------------
// HOME — pick a side
// ---------------------------------------------------------------------------
export function pbHome(): ViewPayload {
  const c = playbookCounts();
  const embed = new EmbedBuilder()
    .setColor(OFF_COLOR)
    .setTitle('🏈 Playbook')
    .setDescription(
      [
        `The full **${playbookGame()}** playbook, straight from the game. Every play with its real diagram.`,
        '',
        `**Offense:** ${c.offense_plays.toLocaleString()} plays across ${c.offense_sets} sets`,
        `**Defense:** ${c.defense_plays.toLocaleString()} plays across ${c.defense_fronts} fronts`,
        '',
        'Pick a side, then drill into a formation.',
      ].join('\n')
    )
    .setFooter({ text: FOOTER });
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('imc:pb:sets:O').setLabel('Offense').setEmoji('🔥').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('imc:pb:sets:D').setLabel('Defense').setEmoji('🛡️').setStyle(ButtonStyle.Primary),
    homeButton()
  );
  return { embeds: [embed], components: [row], attachments: [] };
}

// ---------------------------------------------------------------------------
// SETS — pick a set/front
// ---------------------------------------------------------------------------
export function pbSets(side: Side): ViewPayload {
  const list = sets(side);
  const label = side === 'OFF' ? 'formation set' : 'defensive front';
  const embed = new EmbedBuilder()
    .setColor(sideColor(side))
    .setTitle(`🏈 ${SIDE_LABEL[side]} · Sets`)
    .setDescription(`${list.length} ${label}s. Pick one to see its formations.`)
    .setFooter({ text: FOOTER });
  const select = new StringSelectMenuBuilder()
    .setCustomId(`imc:pb:sset:${SD_CODE[side]}`)
    .setPlaceholder(`Choose a ${label}`)
    .addOptions(
      list.map((name, i) => ({
        label: truncate(name, 100),
        value: String(i),
        description: `${formations(side, i).length} formations`,
      }))
    );
  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select),
      new ActionRowBuilder<ButtonBuilder>().addComponents(backButton('imc:pb:home'), homeButton()),
    ],
    attachments: [],
  };
}

// ---------------------------------------------------------------------------
// FORMATIONS — paged (Shotgun has ~290)
// ---------------------------------------------------------------------------
function pager(prevId: string, nextId: string, page: number, pages: number, backId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(prevId).setLabel('Prev').setEmoji('◀️').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
    new ButtonBuilder().setCustomId(nextId).setLabel('Next').setEmoji('▶️').setStyle(ButtonStyle.Secondary).setDisabled(page >= pages - 1),
    backButton(backId),
    homeButton()
  );
}

export function pbForms(side: Side, setIdx: number, pageIn: number): ViewPayload {
  const sd = SD_CODE[side];
  const list = formations(side, setIdx);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const page = Math.min(Math.max(0, pageIn), pages - 1);
  const slice = list.slice(page * PAGE, page * PAGE + PAGE);
  const embed = new EmbedBuilder()
    .setColor(sideColor(side))
    .setTitle(`🏈 ${setName(side, setIdx) ?? ''}`)
    .setDescription(`${list.length} formations. Page ${page + 1}/${pages}. Pick one to see its plays.`)
    .setFooter({ text: FOOTER });
  const select = new StringSelectMenuBuilder()
    .setCustomId(`imc:pb:sform:${sd}:${setIdx}:${page}`)
    .setPlaceholder('Choose a formation')
    .addOptions(
      slice.map((name, i) => {
        const formIdx = page * PAGE + i;
        return {
          label: truncate(name, 100),
          value: String(formIdx),
          description: `${plays(side, setIdx, formIdx).length} plays`,
        };
      })
    );
  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select),
      pager(
        `imc:pb:forms:${sd}:${setIdx}:${Math.max(0, page - 1)}:p`,
        `imc:pb:forms:${sd}:${setIdx}:${Math.min(pages - 1, page + 1)}:n`,
        page,
        pages,
        `imc:pb:sets:${sd}`
      ),
    ],
    attachments: [],
  };
}

// ---------------------------------------------------------------------------
// PLAYS — paged
// ---------------------------------------------------------------------------
export function pbPlays(side: Side, setIdx: number, formIdx: number, pageIn: number): ViewPayload {
  const sd = SD_CODE[side];
  const list = plays(side, setIdx, formIdx);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const page = Math.min(Math.max(0, pageIn), pages - 1);
  const slice = list.slice(page * PAGE, page * PAGE + PAGE);
  const formLabel = `${setName(side, setIdx) ?? ''} ${formationName(side, setIdx, formIdx) ?? ''}`.trim();
  const embed = new EmbedBuilder()
    .setColor(sideColor(side))
    .setTitle(`🏈 ${formLabel}`)
    .setDescription(`${list.length} plays. Page ${page + 1}/${pages}. Pick one to see the diagram.`)
    .setFooter({ text: FOOTER });
  const select = new StringSelectMenuBuilder()
    .setCustomId(`imc:pb:splay:${sd}:${setIdx}:${formIdx}:${page}`)
    .setPlaceholder('Choose a play')
    .addOptions(
      slice.map((p, i) => {
        const playIdx = page * PAGE + i;
        const tag = side === 'DEF' ? p.coverage : p.type;
        const opt: { label: string; value: string; description?: string } = {
          label: truncate(p.name, 100),
          value: String(playIdx),
        };
        if (tag) opt.description = tag;
        return opt;
      })
    );
  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select),
      pager(
        `imc:pb:plays:${sd}:${setIdx}:${formIdx}:${Math.max(0, page - 1)}:p`,
        `imc:pb:plays:${sd}:${setIdx}:${formIdx}:${Math.min(pages - 1, page + 1)}:n`,
        page,
        pages,
        `imc:pb:forms:${sd}:${setIdx}:0` // back to this set's formations
      ),
    ],
    attachments: [],
  };
}

// ---------------------------------------------------------------------------
// DETAIL — the play card with its real diagram
// ---------------------------------------------------------------------------
export function pbDetail(side: Side, setIdx: number, formIdx: number, playIdx: number): ViewPayload {
  const sd = SD_CODE[side];
  const node: PlayNode | null = play(side, setIdx, formIdx, playIdx);
  const formLabel = `${setName(side, setIdx) ?? ''} ${formationName(side, setIdx, formIdx) ?? ''}`.trim();
  if (!node) {
    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('Not in the book')
      .setDescription('That play could not be loaded.')
      .setFooter({ text: FOOTER });
    return {
      embeds: [embed],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(backButton(`imc:pb:plays:${sd}:${setIdx}:${formIdx}:0`), homeButton())],
      attachments: [],
    };
  }
  const tag = side === 'DEF' ? node.coverage : node.type;
  const embed = new EmbedBuilder()
    .setColor(sideColor(side))
    .setTitle(`🏈 ${node.name}`)
    .setDescription([`**Formation:** ${formLabel}`, tag ? `**${side === 'DEF' ? 'Coverage' : 'Type'}:** ${tag}` : ''].filter(Boolean).join('\n'))
    .setFooter({ text: FOOTER });

  const files: AttachmentBuilder[] = [];
  const ap = artPath(node);
  if (ap) {
    files.push(new AttachmentBuilder(ap, { name: 'play.png' }));
    embed.setImage('attachment://play.png');
  }
  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        backButton(`imc:pb:plays:${sd}:${setIdx}:${formIdx}:0`, 'Back to plays'),
        homeButton()
      ),
    ],
    files,
    attachments: [],
  };
}

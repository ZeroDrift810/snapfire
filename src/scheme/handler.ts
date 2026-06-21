/**
 * Scheme Builder interaction handler.
 *
 * Side-effecting (build state), handled outside the pure router like the playcall + operator hubs.
 * Owns every `imc:sb:*` button + select. Views are plain embeds (no heavy render), so it replies/
 * updates directly: a fresh launch from a public message opens an ephemeral session; in-session taps
 * update in place.
 */

import { AttachmentBuilder, ButtonInteraction, EmbedBuilder, Interaction, MessageFlags, StringSelectMenuInteraction } from 'discord.js';
import { ViewPayload } from '../ui/views';
import { getBuild, newBuild, SchemeBuild, setGroupConcepts, setScheme, setTempo } from './builder';
import { getScheme } from './data';
import { renderSchemeCardPng, renderSchemePdf } from './render';
import { buildConceptView, buildIdentityView, buildSetupView, SB_ID } from './views';

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

export async function handleScheme(interaction: Interaction): Promise<void> {
  if (interaction.isStringSelectMenu()) {
    await handleSelect(interaction);
    return;
  }
  if (interaction.isButton()) {
    await handleButton(interaction);
  }
}

function build(userId: string) {
  return getBuild(userId) ?? newBuild(userId);
}

async function handleSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const userId = interaction.user.id;
  const b = build(userId);

  if (interaction.customId === SB_ID.scheme) {
    setScheme(b, interaction.values[0]);
    await deliver(interaction, buildSetupView(b));
    return;
  }
  if (interaction.customId === SB_ID.tempo) {
    setTempo(b, interaction.values[0]);
    await deliver(interaction, buildSetupView(b));
    return;
  }
  if (interaction.customId.startsWith('imc:sb:grp:')) {
    const groupId = interaction.customId.split(':')[3] as 'run' | 'qpa' | 'pass';
    setGroupConcepts(b, groupId, interaction.values);
    await deliver(interaction, buildConceptView(b));
    return;
  }
}

async function handleButton(interaction: ButtonInteraction): Promise<void> {
  const id = interaction.customId;
  const userId = interaction.user.id;

  if (id === SB_ID.new) {
    const b = newBuild(userId);
    await deliver(interaction, buildSetupView(b));
    return;
  }
  if (id === SB_ID.toConcepts || id === SB_ID.edit) {
    await deliver(interaction, buildConceptView(build(userId)));
    return;
  }
  if (id === SB_ID.review) {
    await deliver(interaction, buildIdentityView(build(userId)));
    return;
  }

  // Export the sellable artifacts. Rendering (esp. the PDF with engine diagrams) takes a few
  // seconds, so defer a fresh ephemeral reply, then deliver the file (the identity card stays).
  if (id === SB_ID.exportImage || id === SB_ID.exportPdf) {
    const b = build(userId);
    if (!b.concepts.length) {
      await interaction.reply({ content: 'Pick some concepts first, then export.', flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const slug = schemeSlug(b);
    if (id === SB_ID.exportImage) {
      const png = renderSchemeCardPng(b);
      const file = new AttachmentBuilder(png, { name: `${slug}.png` });
      const embed = new EmbedBuilder().setColor(0xe6b400).setTitle('🖼️ Scheme card').setDescription('Your shareable Scheme Identity card.').setImage(`attachment://${slug}.png`).setFooter({ text: '🧩 Scheme Builder // iMoveChainz' });
      await interaction.editReply({ embeds: [embed], files: [file] });
    } else {
      const pdf = await renderSchemePdf(b);
      const file = new AttachmentBuilder(pdf, { name: `${slug}.pdf` });
      const embed = new EmbedBuilder().setColor(0xe6b400).setTitle('📄 Scheme PDF').setDescription('Your custom playbook: identity, roadmap, and the core concepts drawn by the engine.').setFooter({ text: '🧩 Scheme Builder // iMoveChainz' });
      await interaction.editReply({ embeds: [embed], files: [file] });
    }
    return;
  }
}

function schemeSlug(b: SchemeBuild): string {
  const name = (b.schemeId ? getScheme(b.schemeId)?.name : 'custom-scheme') ?? 'custom-scheme';
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'scheme';
}

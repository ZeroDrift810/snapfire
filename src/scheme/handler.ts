/**
 * Scheme Builder interaction handler.
 *
 * Side-effecting (build state), handled outside the pure router like the playcall + operator hubs.
 * Owns every `imc:sb:*` button + select. Views are plain embeds (no heavy render), so it replies/
 * updates directly: a fresh launch from a public message opens an ephemeral session; in-session taps
 * update in place.
 */

import { ButtonInteraction, Interaction, MessageFlags, StringSelectMenuInteraction } from 'discord.js';
import { ViewPayload } from '../ui/views';
import { getBuild, newBuild, setGroupConcepts, setScheme, setTempo } from './builder';
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
}

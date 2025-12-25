/**
 * /concept Command Handler
 * Displays general football concepts
 */

import { ChatInputCommandInteraction, AutocompleteInteraction, EmbedBuilder } from 'discord.js';
import { getConceptByName, searchConcepts } from '../knowledge/loader';
import { GENERIC_BRAND } from '../knowledge/types';

// Helper to truncate text to Discord's 1024 char limit
function truncateField(text: string, maxLen: number = 1024): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

/**
 * Handle /concept command execution
 */
export async function handleConceptCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const conceptName = interaction.options.getString('name', true);
  
  const concept = getConceptByName(conceptName);
  
  if (!concept) {
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('❌ Concept Not Found')
      .setDescription(`Could not find concept: **${conceptName}**`)
      .addFields({
        name: 'Suggestion',
        value: 'Use the autocomplete to search available concepts, or check your spelling.'
      })
      .setFooter({ text: GENERIC_BRAND.footer })
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }
  
  // Build rich embed with concept data
  const embed = new EmbedBuilder()
    .setColor(GENERIC_BRAND.color)
    .setTitle(`${GENERIC_BRAND.emoji} ${concept.name}`)
    .setDescription(`**Type:** ${concept.family}`)
    .addFields(
      {
        name: '💡 Core Idea',
        value: truncateField(concept.core_idea || 'No description available.'),
        inline: false
      },
      {
        name: '✅ Best Against',
        value: truncateField(concept.best_vs.length > 0
          ? concept.best_vs.map(c => `• ${c}`).join('\n')
          : 'No specific matchups listed'),
        inline: true
      },
      {
        name: '❌ Weak Against',
        value: truncateField(concept.weak_vs.length > 0
          ? concept.weak_vs.map(c => `• ${c}`).join('\n')
          : 'No specific weaknesses listed'),
        inline: true
      }
    )
    .setFooter({ text: GENERIC_BRAND.footer })
    .setTimestamp();
  
  await interaction.reply({ embeds: [embed] });
}

/**
 * Handle /concept autocomplete
 */
export async function handleConceptAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focusedValue = interaction.options.getFocused();
  
  const results = searchConcepts(focusedValue);
  
  const choices = results.map(name => ({
    name: name,
    value: name
  }));
  
  await interaction.respond(choices);
}

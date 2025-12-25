/**
 * /coverage Command Handler
 * Displays defensive coverage information
 */

import { ChatInputCommandInteraction, AutocompleteInteraction, EmbedBuilder } from 'discord.js';
import { getCoverageByName, searchCoverages } from '../knowledge/loader';
import { GENERIC_BRAND } from '../knowledge/types';

// Helper to truncate text to Discord's 1024 char limit
function truncateField(text: string, maxLen: number = 1024): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

/**
 * Handle /coverage command execution
 */
export async function handleCoverageCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const coverageName = interaction.options.getString('name', true);
  
  const coverage = getCoverageByName(coverageName);
  
  if (!coverage) {
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('❌ Coverage Not Found')
      .setDescription(`Could not find coverage: **${coverageName}**`)
      .addFields({
        name: 'Suggestion',
        value: 'Use the autocomplete to search available coverages, or check your spelling.'
      })
      .setFooter({ text: GENERIC_BRAND.footer })
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }
  
  // Build rich embed with coverage data
  const embed = new EmbedBuilder()
    .setColor(0x2980B9) // Deep blue for coverages
    .setTitle(`🛡️ ${coverage.name}`)
    .setDescription(`**Shell:** ${coverage.shell}`)
    .addFields(
      {
        name: '💪 Strengths',
        value: truncateField(coverage.strengths.length > 0
          ? coverage.strengths.map(s => `• ${s}`).join('\n')
          : 'No strengths listed'),
        inline: false
      },
      {
        name: '⚠️ Weaknesses',
        value: truncateField(coverage.weaknesses.length > 0
          ? coverage.weaknesses.map(w => `• ${w}`).join('\n')
          : 'No weaknesses listed'),
        inline: false
      },
      {
        name: '🎯 Beaten By Concepts',
        value: truncateField(coverage.beaten_by_concepts.length > 0
          ? coverage.beaten_by_concepts.map(c => `• ${c}`).join('\n')
          : 'No specific concepts listed'),
        inline: false
      }
    )
    .setFooter({ text: GENERIC_BRAND.footer })
    .setTimestamp();
  
  await interaction.reply({ embeds: [embed] });
}

/**
 * Handle /coverage autocomplete
 */
export async function handleCoverageAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focusedValue = interaction.options.getFocused();
  
  const results = searchCoverages(focusedValue);
  
  const choices = results.map(name => ({
    name: name,
    value: name
  }));
  
  await interaction.respond(choices);
}

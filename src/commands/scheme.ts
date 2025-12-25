/**
 * /scheme Command Handler (FLAGSHIP - UPDATED)
 * Displays premium SnapFire/Shinobi plays with dynamic branding and play art
 */

import * as fs from "fs";
import * as path from "path";
import {
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  EmbedBuilder,
  AttachmentBuilder,
} from "discord.js";
import { getSchemeByName, searchSchemes } from "../knowledge/loader";
import { BRAND_CONFIGS } from "../knowledge/types";

// Get project root from this file's location
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

// Helper to truncate text to Discord's 1024 char limit
function truncateField(text: string, maxLen: number = 1024): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

/**
 * Handle /scheme command execution
 */
export async function handleSchemeCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const schemeName = interaction.options.getString("name", true);

  // CRITICAL: Defer reply immediately to prevent 3-second timeout
  await interaction.deferReply();

  const scheme = getSchemeByName(schemeName);

  if (!scheme) {
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle("❌ Scheme Not Found")
      .setDescription(`Could not find scheme: **${schemeName}**`)
      .addFields({
        name: "Suggestion",
        value:
          "Use the autocomplete to search available schemes. Make sure to select from the dropdown list.",
      })
      .setFooter({ text: "iMoveChainz IQ" })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // Get branding configuration based on system
  const brand = BRAND_CONFIGS[scheme.system];

  // --- Routes / Assignments ---
  const routeText =
    scheme.routes && scheme.routes.length > 0
      ? scheme.routes
          .slice(0, 8) // Limit to first 8 to avoid embed overflow
          .map((r) => {
            let line = `• **${r.receiver}:** ${r.route}`;
            // Optionally show note in parentheses if different from route
            if (r.note && r.note !== r.route) {
              line += ` *(${r.note})*`;
            }
            return line;
          })
          .join("\n")
      : "No route data available.";

  // --- Reads / Keys ---
  const readText =
    scheme.reads && scheme.reads.length > 0
      ? scheme.reads.join("\n")
      : "No read progression available.";

  // Build rich embed
  const embed = new EmbedBuilder()
    .setColor(brand.color)
    .setTitle(`${brand.emoji} ${scheme.display_name}`)
    .setDescription(`**Formation:** ${scheme.formation_family}`)
    .addFields(
      {
        name: "📋 Assignments",
        value: truncateField(routeText),
        inline: false,
      },
      {
        name: "🧠 Reads / Keys",
        value: truncateField(readText),
        inline: false,
      },
      {
        name: "💡 Strategy",
        value: truncateField(scheme.usage_notes || "No specific notes."),
        inline: false,
      }
    )
    .setFooter({ text: brand.footer })
    .setTimestamp();

  // --- Image Handling ---
  const files: AttachmentBuilder[] = [];

  if (scheme.image_file) {
    // Expecting play art PNGs to be packaged with the bot:
    //   assets/play_art/<scheme.image_file>
    const imagePath = path.join(
      PROJECT_ROOT,
      "assets",
      "play_art",
      scheme.image_file
    );

    if (fs.existsSync(imagePath)) {
      const attachment = new AttachmentBuilder(imagePath, {
        name: "play_art.png",
      });
      files.push(attachment);
      embed.setImage("attachment://play_art.png");
    } else {
      console.warn(`⚠️  Image not found: ${imagePath}`);
    }
  }

  await interaction.editReply({ embeds: [embed], files });
}

/**
 * Handle /scheme autocomplete
 */
export async function handleSchemeAutocomplete(
  interaction: AutocompleteInteraction
): Promise<void> {
  const focusedValue = interaction.options.getFocused();

  const results = searchSchemes(focusedValue);

  // Results already formatted as { name: "[SYSTEM] Display Name", value: "internal_id" }
  await interaction.respond(results);
}

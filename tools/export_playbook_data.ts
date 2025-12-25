/**
 * iMoveChainz Bot - Playbook Export Script
 * Transforms detailed playbook JSON into bot-ready knowledge base
 */

import * as fs from "fs";
import * as path from "path";

// ============================================================================
// DATA CONTRACTS (Inline to prevent import errors outside src)
// ============================================================================

interface SchemeRoute {
  receiver: string;
  route: string;
  note?: string;
}

type SchemeSystem = "SNAPFIRE" | "SHINOBI";

interface SchemeKnowledge {
  name: string;
  display_name: string;
  system: SchemeSystem;
  formation_family: string;
  routes: SchemeRoute[];
  reads: string[];
  usage_notes: string;
  image_file?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function normalizeSchemeId(name: string, system: SchemeSystem): string {
  const prefix = system.toLowerCase();
  const normalized = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${prefix}_${normalized}`;
}

function safeString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

// ============================================================================
// EXTRACTION LOGIC
// ============================================================================

function extractSchemes(
  sourceData: any[],
  system: SchemeSystem
): SchemeKnowledge[] {
  const schemes: SchemeKnowledge[] = [];
  console.log(`\nProcessing ${sourceData.length} items for ${system}...`);

  for (const play of sourceData) {
    // --- Name / IDs ---
    const displayName: string =
      play.play_name ||
      play.concept?.name ||
      play.coverage_type ||
      "Unknown Play";

    const internalId = normalizeSchemeId(displayName, system);

    // --- Formation Family ---
    const formationFamily: string = play.formation || "Unknown";

    // --- Routes / Assignments ---
    const routes: SchemeRoute[] = [];

    // Offense: route_tree array
    if (Array.isArray(play.route_tree)) {
      for (const r of play.route_tree) {
        if (!r) continue;

        const rawRoute = r.route;
        if (!rawRoute || rawRoute === "null") continue;

        const rawPos: string = r.position || "";
        const cleanPos = rawPos
          .replace(/WR\d_/, "") // WR1_X -> X
          .replace(/_/g, " ")   // X_SLOT -> X SLOT
          .trim();

        routes.push({
          receiver: cleanPos || rawPos || "Unknown",
          route: rawRoute,
          note: r.assignment ? String(r.assignment) : undefined,
        });
      }
    }

    // Defense: position_assignments { DL: { DE: "...", ... }, LB: {...}, DB: {...} }
    if (play.position_assignments) {
      ["DL", "LB", "DB"].forEach((group) => {
        const block = play.position_assignments[group];
        if (!block) return;

        Object.entries(block).forEach(([pos, assign]) => {
          const full = safeString(assign).trim();
          if (!full) return;

          const mainAction = full.split("-")[0].trim();
          routes.push({
            receiver: pos,
            route: mainAction || full,
            note: full,
          });
        });
      });
    }

    // --- Reads ---
    const reads: string[] = [];
    const playReads = play.reads || {};

    const preSnap = safeString(playReads.pre_snap).trim();
    const primary = safeString(playReads.primary).trim();
    const secondary = safeString(playReads.secondary).trim();
    const checkdown = safeString(playReads.checkdown).trim();
    const hot = safeString(playReads.hot_route).trim();

    if (preSnap && preSnap.toLowerCase() !== "null") {
      reads.push(`**Pre-Snap:** ${preSnap}`);
    }
    if (primary && primary.toLowerCase() !== "null") {
      reads.push(`**1️⃣ Primary:** ${primary}`);
    }
    if (secondary && secondary.toLowerCase() !== "null") {
      reads.push(`**2️⃣ Secondary:** ${secondary}`);
    }
    if (checkdown && checkdown.toLowerCase() !== "null") {
      reads.push(`**3️⃣ Checkdown:** ${checkdown}`);
    }
    if (hot && !hot.toLowerCase().includes("null")) {
      reads.push(`**🚨 Hot:** ${hot}`);
    }

    // --- Usage Notes ---
    let notes = "";

    const beats = safeString(play.strategy?.beats).trim();
    if (beats) {
      notes += `**Beats:** ${beats}\n`;
    }

    const keyTeaching = safeString(play.coaching_points?.key_teaching).trim();
    if (keyTeaching) {
      notes += `**Coach's Key:** ${keyTeaching}\n`;
    }

    const primaryWeakness = safeString(
      play.strategic_intel?.primary_weakness
    ).trim();
    if (primaryWeakness) {
      notes += `**Weakness:** ${primaryWeakness}`;
    }

    // --- Image File ---
    // Expecting a `file_name` field in the source JSON (e.g., "Y_Off_Trips_Slot_Cross.png")
    const imageFile: string | undefined = play.file_name
      ? safeString(play.file_name).trim()
      : undefined;

    const scheme: SchemeKnowledge = {
      name: internalId,
      display_name: displayName,
      system,
      formation_family: formationFamily,
      routes,
      reads,
      usage_notes: notes || "No specific notes.",
      image_file: imageFile || undefined,
    };

    schemes.push(scheme);
  }

  console.log(`  ✓ Created ${schemes.length} ${system} schemes`);
  return schemes;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

function main() {
  console.log("");
  console.log("=".repeat(80));
  console.log("iMoveChainz Playbook Export");
  console.log("=".repeat(80));
  console.log("");

  const inputDir = path.join(process.cwd(), "master_data");
  const outputDir = path.join(process.cwd(), "data");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let offenseData: any[] = [];
  let defenseData: any[] = [];

  try {
    const offPath = path.join(inputDir, "offense_complete_v2.json");
    if (fs.existsSync(offPath)) {
      console.log(`📖 Reading offense data from ${offPath}`);
      offenseData = JSON.parse(fs.readFileSync(offPath, "utf-8"));
      console.log(`   Found ${offenseData.length} offensive plays`);
    } else {
      console.warn("⚠️  offense_complete_v2.json not found, skipping offense.");
    }

    const defPath = path.join(inputDir, "defense_complete_v2.json");
    if (fs.existsSync(defPath)) {
      console.log(`📖 Reading defense data from ${defPath}`);
      defenseData = JSON.parse(fs.readFileSync(defPath, "utf-8"));
      console.log(`   Found ${defenseData.length} defensive plays`);
    } else {
      console.warn("⚠️  defense_complete_v2.json not found, skipping defense.");
    }
  } catch (err) {
    console.error("❌ Error reading master data:", err);
    process.exit(1);
  }

  const snapfireSchemes = extractSchemes(offenseData, "SNAPFIRE");
  const shinobiSchemes = extractSchemes(defenseData, "SHINOBI");
  const allSchemes = [...snapfireSchemes, ...shinobiSchemes];

  const outputPath = path.join(outputDir, "Scheme_Knowledge.json");
  fs.writeFileSync(outputPath, JSON.stringify(allSchemes, null, 2), "utf-8");

  console.log("");
  console.log("=".repeat(80));
  console.log("Export Summary");
  console.log("=".repeat(80));
  console.log(`Schemes exported: ${allSchemes.length}`);
  console.log(`  🔥 SnapFire: ${snapfireSchemes.length}`);
  console.log(`  🥷 Shinobi:  ${shinobiSchemes.length}`);
  console.log("");
  console.log(`✅ Export complete!`);
  console.log(`📄 Output: ${outputPath}`);
  console.log("");
}

if (require.main === module) {
  main();
}

/**
 * Type definitions for iMoveChainz Knowledge Bases
 */

// ============================================================================
// CONCEPT KNOWLEDGE
// ============================================================================

export type ConceptFamily = "PASS" | "RUN" | "RPO" | "SCREEN" | "TRICK";

export interface ConceptKnowledge {
  name: string;
  family: ConceptFamily;
  core_idea: string;
  best_vs: string[];
  weak_vs: string[];
}

// ============================================================================
// COVERAGE KNOWLEDGE
// ============================================================================

export type CoverageShell = "MOFO" | "MOFC" | "QUARTERS" | "ZERO" | "SPECIAL";

export interface CoverageKnowledge {
  name: string;
  shell: CoverageShell;
  strengths: string[];
  weaknesses: string[];
  beaten_by_concepts: string[];
}

// ============================================================================
// SCHEME KNOWLEDGE (UPDATED WITH STRUCTURED DATA + IMAGES)
// ============================================================================

export type SchemeSystem = "SNAPFIRE" | "SHINOBI";

export interface SchemeRoute {
  receiver: string;    // Position (e.g., "X", "Z", "Slot", "SAM", "MIKE")
  route: string;       // Route name (e.g., "Post", "Wheel") or action (e.g., "BLITZ")
  note?: string;       // Optional assignment details
}

export interface SchemeKnowledge {
  name: string;              // Internal unique ID (e.g., "snapfire_mesh_return")
  display_name: string;      // User-friendly name (e.g., "Mesh Return")
  system: SchemeSystem;      // CRITICAL: Determines branding
  formation_family: string;  // Formation name
  routes: SchemeRoute[];     // Structured route/assignment data
  reads: string[];           // Array of read progression steps
  usage_notes: string;       // Situational advice and strategy
  image_file?: string;       // Optional play art diagram filename
}

// ============================================================================
// BRANDING CONFIGURATION
// ============================================================================

export interface BrandConfig {
  color: number;      // Hex color as integer (e.g., 0xE36414)
  emoji: string;      // Brand emoji (e.g., "🔥")
  footer: string;     // Footer text
  thumbnail?: string; // Optional thumbnail URL
}

export const BRAND_CONFIGS: Record<SchemeSystem, BrandConfig> = {
  SNAPFIRE: {
    color: 0xE36414,  // Orange
    emoji: "🔥",
    footer: "🔥 SnapFire Offense // iMoveChainz"
  },
  SHINOBI: {
    color: 0x2C3E50,  // Ninja Dark/Grey
    emoji: "🥷🏿",
    footer: "🥷🏿 Shinobi Defense // iMoveChainz"
  }
};

// Generic branding for non-scheme commands
export const GENERIC_BRAND: BrandConfig = {
  color: 0x34495E,  // Neutral Blue
  emoji: "📚",
  footer: "iMoveChainz IQ"
};

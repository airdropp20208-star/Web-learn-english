// Build CEFR spine dataset: join CEFR-J vocabulary + wordfreq frequency
// Output: /public/data/words.json — array of {word, cefr, freq}
// Usage: bun run scripts/build-cefr-spine.ts

import * as fs from "fs";
import * as path from "path";

interface CEFRRow {
  headword: string;
  pos: string;
  cefr: string;
}

interface FreqEntry {
  word: string;
  freq: number; // log frequency, higher = more common
}

function parseCSV(filePath: string): CEFRRow[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());
  const rows: CEFRRow[] = [];

  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // CSV format: headword,pos,CEFR,...
    const parts = line.split(",");
    if (parts.length < 3) continue;
    const headword = parts[0].trim().toLowerCase();
    const pos = parts[1].trim();
    const cefr = parts[2].trim().toUpperCase();
    if (!headword || !cefr.match(/^[ABC]12?$/)) continue;
    rows.push({ headword, pos, cefr });
  }
  return rows;
}

function parseFreqJSON(filePath: string): Map<string, number> {
  const content = fs.readFileSync(filePath, "utf-8");
  const arr = JSON.parse(content) as [string, number][];
  const map = new Map<string, number>();
  for (const [word, freq] of arr) {
    map.set(word.toLowerCase(), freq);
  }
  return map;
}

function main() {
  const dataDir = path.join(__dirname, "data");
  const outDir = path.join(__dirname, "..", "public", "data");
  fs.mkdirSync(outDir, { recursive: true });

  console.log("[1/4] Parsing CEFR-J vocabulary profile...");
  const cefrRows = parseCSV(path.join(dataDir, "cefrj.csv"));
  console.log(`  → ${cefrRows.length} words from CEFR-J A1-B2`);

  console.log("[2/4] Parsing CEFR-J C1-C2 profile...");
  const c1c2Rows = parseCSV(path.join(dataDir, "cefrj-c1c2.csv"));
  console.log(`  → ${c1c2Rows.length} words from CEFR-J C1-C2`);

  console.log("[3/4] Parsing wordfreq-en-25000...");
  const freqMap = parseFreqJSON(path.join(dataDir, "wordfreq.json"));
  console.log(`  → ${freqMap.size} words with frequency data`);

  console.log("[4/4] Joining datasets...");
  const allRows = [...cefrRows, ...c1c2Rows];

  // Deduplicate by headword — keep highest CEFR if duplicates (more specific level)
  const cefrOrder = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const dedup = new Map<string, CEFRRow>();
  for (const row of allRows) {
    const existing = dedup.get(row.headword);
    if (!existing) {
      dedup.set(row.headword, row);
    } else {
      // Keep the one with higher CEFR (more specific)
      const existingIdx = cefrOrder.indexOf(existing.cefr);
      const newIdx = cefrOrder.indexOf(row.cefr);
      if (newIdx > existingIdx) dedup.set(row.headword, row);
    }
  }

  // Build final dataset
  const words = Array.from(dedup.values()).map((row) => {
    const freq = freqMap.get(row.headword);
    return {
      w: row.headword,
      c: row.cefr,
      p: row.pos,
      f: freq ?? null, // log frequency, null if not in top 25K
    };
  });

  // Sort by frequency (most common first); nulls last
  words.sort((a, b) => {
    if (a.f === null && b.f === null) return a.w.localeCompare(b.w);
    if (a.f === null) return 1;
    if (b.f === null) return -1;
    return b.f - a.f; // higher log freq = more common = first
  });

  const outPath = path.join(outDir, "words.json");
  fs.writeFileSync(outPath, JSON.stringify(words));
  console.log(`\n✓ Wrote ${words.length} words to ${outPath}`);
  console.log(`  Size: ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB`);

  // Stats per level
  const stats: Record<string, number> = {};
  for (const w of words) {
    stats[w.c] = (stats[w.c] || 0) + 1;
  }
  console.log("  Per level:", stats);

  // Sample
  console.log("\n  Sample (first 5):");
  for (const w of words.slice(0, 5)) {
    console.log(`    ${w.w} | ${w.c} | ${w.p} | freq=${w.f}`);
  }
  console.log("  Sample (last 5):");
  for (const w of words.slice(-5)) {
    console.log(`    ${w.w} | ${w.c} | ${w.p} | freq=${w.f}`);
  }
}

main();

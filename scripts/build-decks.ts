// Build vocabulary decks from downloaded datasets
// Output: /public/data/decks/*.json (4 decks)
// Usage: bun run scripts/build-decks.ts

import * as fs from "fs";
import * as path from "path";

interface DeckWord {
  word: string;
  pos?: string;
  definition?: string;
  vietnamese?: string;
  example?: string;
  exampleVietnamese?: string;
  ipa?: string;
  audioUrl?: string;
  topic?: string;
  cefrLevel?: string;
}

interface Deck {
  id: string;
  name: string;
  description: string;
  category: "TOEIC" | "IELTS" | "Oxford" | "Daily" | "Essential" | "CEFR";
  wordCount: number;
  source: string;
  license: string;
  words: DeckWord[];
}

const dataDir = path.join(__dirname, "data");
const outDir = path.join(__dirname, "..", "public", "data", "decks");
fs.mkdirSync(outDir, { recursive: true });

// ============ 1. TOEIC 600 ============

function buildTOEIC600(): Deck {
  console.log("[1/4] Building TOEIC 600 deck...");
  const csv = fs.readFileSync(path.join(dataDir, "toeic-600.csv"), "utf-8");
  // Remove BOM
  const clean = csv.replace(/^\uFEFF/, "");
  const lines = clean.split("\n").filter((l) => l.trim());

  // Skip header
  const words: DeckWord[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Parse CSV (handle quoted fields with commas)
    const fields = parseCSVLine(line);
    if (fields.length < 11) continue;

    const [english, type, vietnamese, pronounce, explain, example, exampleVi, _img, audio, topic] = fields;
    if (!english || !explain) continue;

    words.push({
      word: english.trim(),
      pos: type?.trim() || undefined,
      definition: explain.trim(),
      vietnamese: vietnamese?.trim() || undefined,
      example: example?.trim() || undefined,
      exampleVietnamese: exampleVi?.trim() || undefined,
      ipa: pronounce?.trim() || undefined,
      audioUrl: audio?.trim() || undefined,
      topic: topic?.trim() || undefined,
      cefrLevel: "B1", // TOEIC is generally B1+ level
    });
  }

  console.log(`  → ${words.length} words (with Vietnamese translations)`);
  return {
    id: "toeic-600",
    name: "TOEIC 600 Essential Words",
    description: "600 từ vựng TOEIC thiết yếu theo 50 chủ đề đời sống (Shopping, Travel, Banking, Hotels, Eating Out...)",
    category: "TOEIC",
    wordCount: words.length,
    source: "tranngocminhhieu/toeic-600-words-dataset (tflat.vn)",
    license: "No explicit license (source: tflat.vn)",
    words,
  };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// ============ 2. 4000 Essential English Words ============

function build4000Essential(): Deck {
  console.log("[2/4] Building 4000 Essential English Words deck...");
  const meaningRaw = fs.readFileSync(path.join(dataDir, "4000-essential-meaning.json"), "utf-8");
  const sentenceRaw = fs.readFileSync(path.join(dataDir, "4000-essential-sentence.json"), "utf-8");

  const meanings = JSON.parse(meaningRaw) as Array<{
    name: string;
    trans: string[];
    usphone: string;
    ukphone: string;
  }>;
  const sentences = JSON.parse(sentenceRaw) as Array<{
    name: string;
    trans: string[];
    usphone: string;
    ukphone: string;
  }>;

  // Build sentence lookup map
  const sentenceMap = new Map<string, string>();
  for (const s of sentences) {
    if (s.trans && s.trans.length > 0) {
      sentenceMap.set(s.name.toLowerCase(), s.trans[0]);
    }
  }

  const words: DeckWord[] = meanings.map((m) => ({
    word: m.name,
    definition: m.trans?.[0] ?? "",
    example: sentenceMap.get(m.name.toLowerCase()) || undefined,
    ipa: m.usphone ? `/${m.usphone}/` : undefined,
    cefrLevel: "A2", // 4000 Essential Words is generally A2-B1
  }));

  console.log(`  → ${words.length} words`);
  return {
    id: "essential-4000",
    name: "4000 Essential English Words",
    description: "3600 từ vựng tiếng Anh thiết yếu với định nghĩa và câu ví dụ tiếng Anh — phù hợp người học ở mọi trình độ",
    category: "Essential",
    wordCount: words.length,
    source: "RealKai42/qwerty-learner (originally from Compass Publishing)",
    license: "GPL-3.0 (qwerty-learner)",
    words,
  };
}

// ============ 3. Oxford 5000 ============

function buildOxford5000(): Deck {
  console.log("[3/4] Building Oxford 5000 deck...");
  const raw = fs.readFileSync(path.join(dataDir, "oxford5000.json"), "utf-8");
  const entries = JSON.parse(raw) as Array<{
    name: string;
    trans: string[];
    usphone: string;
    ukphone: string;
  }>;

  // Oxford 5000 has Chinese glosses — we keep only word + IPA
  // Definitions will be fetched at runtime via Free Dictionary API
  const words: DeckWord[] = entries.map((e) => ({
    word: e.name,
    ipa: e.usphone ? `/${e.usphone}/` : (e.ukphone ? `/${e.ukphone}/` : undefined),
    cefrLevel: "B2", // Oxford 5000 covers B1-C1, default to B2
  }));

  console.log(`  → ${words.length} words`);
  return {
    id: "oxford-5000",
    name: "Oxford 5000",
    description: "5000 từ vựng quan trọng nhất theo Oxford University Press — từ vựng cốt lõi cho người học tiếng Anh ở mọi trình độ",
    category: "Oxford",
    wordCount: words.length,
    source: "RealKai42/qwerty-learner (originally Oxford University Press)",
    license: "GPL-3.0 (qwerty-learner)",
    words,
  };
}

// ============ 4. Daily Conversations (subset of TOEIC 600) ============

function buildDailyConversations(): Deck {
  console.log("[4/4] Building Daily Conversations deck...");
  const csv = fs.readFileSync(path.join(dataDir, "toeic-600.csv"), "utf-8");
  const clean = csv.replace(/^\uFEFF/, "");
  const lines = clean.split("\n").filter((l) => l.trim());

  // Daily life topics
  const dailyTopics = new Set([
    "Shopping", "Eating Out", "Travel", "Hotels", "Airlines",
    "Banking", "Doctor", "Dentist", "Pharmacy", "Renting",
    "Restaurants", "Transportation", "Movies", "Health",
    "Clothing", "Food", "Cooking",
  ]);

  const words: DeckWord[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length < 11) continue;

    const [english, type, vietnamese, pronounce, explain, example, exampleVi, _img, audio, topic] = fields;
    if (!english || !explain || !topic) continue;
    if (!dailyTopics.has(topic.trim())) continue;

    words.push({
      word: english.trim(),
      pos: type?.trim() || undefined,
      definition: explain.trim(),
      vietnamese: vietnamese?.trim() || undefined,
      example: example?.trim() || undefined,
      exampleVietnamese: exampleVi?.trim() || undefined,
      ipa: pronounce?.trim() || undefined,
      audioUrl: audio?.trim() || undefined,
      topic: topic.trim(),
      cefrLevel: "A2",
    });
  }

  console.log(`  → ${words.length} words (with Vietnamese translations)`);
  return {
    id: "daily-conversations",
    name: "Daily Conversations",
    description: "Từ vựng giao tiếp hằng ngày theo chủ đề: Shopping, Eating Out, Travel, Hotels, Airlines, Banking, Doctor, Pharmacy...",
    category: "Daily",
    wordCount: words.length,
    source: "tranngocminhhieu/toeic-600-words-dataset (filtered by daily-life topics)",
    license: "No explicit license (source: tflat.vn)",
    words,
  };
}

// ============ Main ============

function main() {
  const decks: Deck[] = [
    buildTOEIC600(),
    build4000Essential(),
    buildOxford5000(),
    buildDailyConversations(),
  ];

  // Write each deck to its own file (keeps file sizes manageable)
  for (const deck of decks) {
    const outPath = path.join(outDir, `${deck.id}.json`);
    fs.writeFileSync(outPath, JSON.stringify(deck));
    console.log(`  ✓ ${deck.id}: ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB`);
  }

  // Write index file (deck metadata only, no words — for listing)
  const index = decks.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    category: d.category,
    wordCount: d.wordCount,
    source: d.source,
    license: d.license,
  }));
  const indexPath = path.join(outDir, "index.json");
  fs.writeFileSync(indexPath, JSON.stringify(index));
  console.log(`\n✓ Index written: ${indexPath}`);
  console.log(`\nTotal: ${decks.length} decks, ${decks.reduce((s, d) => s + d.wordCount, 0)} words`);
}

main();

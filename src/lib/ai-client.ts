// Mock AI client — returns canned responses for MVP
// Swap with real provider (z-ai-web-dev-sdk / Claude / OpenAI) later

import type { AnalyzeResponse, QuizResponse, CEFRLevel } from "./types";

// Mock sample texts and words for testing
const MOCK_TEXTS = [
  {
    title: "The Coffee Shop Habit",
    content:
      "Every morning, Sarah walks to the small coffee shop near her apartment. She orders a latte and reads the newspaper for thirty minutes before going to work. The barista knows her name and her favorite drink. This routine has become an important part of her day, giving her a moment of calm before the busy hours ahead.",
    cefrLevel: "B1" as CEFRLevel,
    words: [
      {
        word: "routine",
        definition: "a regular way of doing things in a particular order",
        example: "Her morning routine includes exercise and breakfast.",
        cefrLevel: "B2" as CEFRLevel,
      },
      {
        word: "barista",
        definition: "a person who serves in a coffee shop",
        example: "The barista made a beautiful latte art on my coffee.",
        cefrLevel: "B2" as CEFRLevel,
      },
      {
        word: "apartment",
        definition: "a set of rooms for living in, especially on one floor",
        example: "They moved into a new apartment last month.",
        cefrLevel: "A2" as CEFRLevel,
      },
      {
        word: "important",
        definition: "having great significance or value",
        example: "Family is important to her.",
        cefrLevel: "A2" as CEFRLevel,
      },
    ],
  },
  {
    title: "Climate Change and Coastal Cities",
    content:
      "Coastal cities around the world are facing unprecedented challenges due to rising sea levels. Researchers estimate that by 2050, millions of residents may need to relocate. Local governments are investing in infrastructure such as seawalls and pumping systems, but these measures may not be sufficient. The situation requires both immediate adaptation and long-term mitigation strategies.",
    cefrLevel: "B2" as CEFRLevel,
    words: [
      {
        word: "unprecedented",
        definition: "never having happened or existed in the past",
        example: "The pandemic caused unprecedented disruption globally.",
        cefrLevel: "C1" as CEFRLevel,
      },
      {
        word: "relocate",
        definition: "to move to a new place",
        example: "The company relocated to a bigger office.",
        cefrLevel: "B2" as CEFRLevel,
      },
      {
        word: "infrastructure",
        definition: "the basic systems and services that a country needs",
        example: "The country needs to invest in transport infrastructure.",
        cefrLevel: "B2" as CEFRLevel,
      },
      {
        word: "mitigation",
        definition: "the act of reducing how harmful something is",
        example: "Mitigation of climate change requires global cooperation.",
        cefrLevel: "C1" as CEFRLevel,
      },
    ],
  },
];

function findContextSentence(content: string, word: string): string {
  const sentences = content.split(/(?<=[.!?])\s+/);
  const lower = word.toLowerCase();
  const found = sentences.find((s) =>
    s.toLowerCase().includes(lower)
  );
  return found ?? sentences[0] ?? "";
}

function findWordPosition(content: string, word: string): number {
  const idx = content.toLowerCase().indexOf(word.toLowerCase());
  return idx === -1 ? 0 : idx;
}

function estimateCEFR(content: string): CEFRLevel {
  // Naive heuristic: longer avg sentence length → higher CEFR
  const sentences = content.split(/(?<=[.!?])\s+/).filter((s) => s.length > 0);
  if (sentences.length === 0) return "A2";
  const avgLen =
    sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) /
    sentences.length;
  if (avgLen < 10) return "A2";
  if (avgLen < 14) return "B1";
  if (avgLen < 18) return "B2";
  return "C1";
}

/**
 * Mock analyze endpoint: extract vocabulary + estimate CEFR + summary
 */
export async function analyzeText(content: string): Promise<AnalyzeResponse> {
  // Simulate network latency
  await new Promise((r) => setTimeout(r, 400));

  // Find best matching mock text by length similarity, else synthesize
  const match = MOCK_TEXTS.find(
    (t) =>
      t.content.length > 0 &&
      Math.abs(t.content.length - content.length) <
        Math.max(t.content.length, content.length) * 0.3
  );

  const cefrLevel = match?.cefrLevel ?? estimateCEFR(content);
  const title = match?.title ?? `Reading ${new Date().toLocaleDateString()}`;
  const summary = match
    ? `This text describes ${match.title.toLowerCase()}. It covers daily life situations and vocabulary at ${cefrLevel} level.`
    : `This text is approximately ${cefrLevel} level based on sentence complexity. Read it carefully and look up unfamiliar words.`;

  const words = match?.words ?? [
    {
      word: "important",
      definition: "having great significance or value",
      example: "This is an important decision.",
      cefrLevel: "A2" as CEFRLevel,
    },
  ];

  const highlightedWords = words.map((w) => {
    const contextSentence = findContextSentence(content, w.word);
    return {
      word: w.word,
      lemma: w.word.toLowerCase(),
      position: findWordPosition(content, w.word),
      cefrLevel: w.cefrLevel,
      definition: w.definition,
      example: w.example,
      contextSentence,
    };
  });

  return { title, cefrLevel, summary, highlightedWords };
}

/**
 * Mock quiz generator: produce mixed-type questions
 */
export async function generateQuiz(
  textId: string,
  text: string,
  vocabList: Array<{ word: string; definition: string; contextSentence: string }>
): Promise<QuizResponse> {
  await new Promise((r) => setTimeout(r, 400));

  const questions: QuizResponse["questions"] = [];

  // 1 gist question (mcq)
  questions.push({
    type: "mcq",
    question: "What is the main idea of this text?",
    options: [
      "It describes a personal routine and its meaning to the person.",
      "It argues that coffee is unhealthy.",
      "It explains how to make a perfect latte.",
      "It compares different coffee shops in a city.",
    ],
    correctAnswer:
      "It describes a personal routine and its meaning to the person.",
  });

  // 2-3 cloze questions using vocabList
  const clozeWords = vocabList.slice(0, 3);
  for (const v of clozeWords) {
    if (!v.contextSentence || !v.contextSentence.includes(v.word)) continue;
    const clozeSentence = v.contextSentence.replace(
      new RegExp(v.word, "i"),
      "_____"
    );
    questions.push({
      type: "cloze",
      question: `Fill in the blank: ${clozeSentence}`,
      correctAnswer: v.word,
      relatedWord: v.word,
    });
  }

  // 1 recall question (definition recall)
  if (vocabList.length > 0) {
    const target = vocabList[0];
    questions.push({
      type: "recall",
      question: `Write the word that means: "${target.definition}"`,
      correctAnswer: target.word,
      relatedWord: target.word,
    });
  }

  return { questions };
}

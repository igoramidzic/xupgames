export const DOODLE_DASH_CATEGORIES = [
  'Animals',
  'Food',
  'Objects',
  'Places',
  'Actions',
  'Nature',
  'Make-believe',
] as const;

export type DoodleDashCategory = (typeof DOODLE_DASH_CATEGORIES)[number];

export const DOODLE_DASH_ROUND_OPTIONS = [1, 2, 3] as const;
export const DOODLE_DASH_DRAW_DURATION_OPTIONS_MS = [30_000, 45_000, 60_000] as const;
export const DOODLE_DASH_DEFAULT_ROUND_COUNT = 2;
export const DOODLE_DASH_DEFAULT_DRAW_DURATION_MS = 45_000;

export type DoodleDashWord = {
  word: string;
  category: DoodleDashCategory;
};

function words(category: DoodleDashCategory, entries: readonly string[]): DoodleDashWord[] {
  return entries.map((word) => ({ word, category }));
}

export const DOODLE_DASH_WORDS: readonly DoodleDashWord[] = [
  ...words('Animals', [
    'octopus',
    'penguin',
    'giraffe',
    'butterfly',
    'crocodile',
    'jellyfish',
    'porcupine',
    'flamingo',
    'kangaroo',
    'raccoon',
    'lobster',
    'peacock',
    'chameleon',
    'hedgehog',
    'woodpecker',
    'seahorse',
    'bulldog',
    'squirrel',
    'camel',
    'snail',
  ]),
  ...words('Food', [
    'popcorn',
    'spaghetti',
    'watermelon',
    'cupcake',
    'pineapple',
    'hamburger',
    'pretzel',
    'avocado',
    'pancakes',
    'sushi',
    'doughnut',
    'broccoli',
    'cheese',
    'taco',
    'banana',
    'pizza',
    'carrot',
    'hot dog',
    'ice cream',
    'sandwich',
  ]),
  ...words('Objects', [
    'umbrella',
    'telescope',
    'toothbrush',
    'headphones',
    'skateboard',
    'suitcase',
    'flashlight',
    'keyhole',
    'ladder',
    'scissors',
    'backpack',
    'alarm clock',
    'snow globe',
    'watering can',
    'traffic cone',
    'magnifying glass',
    'camera',
    'bicycle',
    'toaster',
    'vacuum',
  ]),
  ...words('Places', [
    'lighthouse',
    'castle',
    'volcano',
    'playground',
    'airport',
    'library',
    'beach',
    'campsite',
    'waterfall',
    'museum',
    'treehouse',
    'circus',
    'farm',
    'subway',
    'island',
    'classroom',
    'zoo',
    'restaurant',
    'stadium',
    'moon',
  ]),
  ...words('Actions', [
    'dancing',
    'sneezing',
    'juggling',
    'whispering',
    'climbing',
    'swimming',
    'cooking',
    'yawning',
    'fishing',
    'painting',
    'sleeping',
    'skating',
    'waving',
    'digging',
    'reading',
    'singing',
    'jumping',
    'crawling',
    'typing',
    'rowing',
  ]),
  ...words('Nature', [
    'rainbow',
    'tornado',
    'lightning',
    'snowflake',
    'cactus',
    'mountain',
    'sunflower',
    'thunderstorm',
    'palm tree',
    'campfire',
    'mushroom',
    'ocean',
    'cloud',
    'comet',
    'planet',
    'river',
    'forest',
    'desert',
    'moonlight',
    'avalanche',
  ]),
  ...words('Make-believe', [
    'dragon',
    'mermaid',
    'wizard',
    'pirate',
    'robot',
    'alien',
    'ghost',
    'unicorn',
    'superhero',
    'vampire',
    'treasure map',
    'magic wand',
    'spaceship',
    'knight',
    'crown',
    'monster',
    'fairy',
    'genie',
    'time machine',
    'dinosaur',
  ]),
];

export function isDoodleDashCategory(value: string): value is DoodleDashCategory {
  return (DOODLE_DASH_CATEGORIES as readonly string[]).includes(value);
}

export function isDoodleDashRoundCount(value: number): boolean {
  return (DOODLE_DASH_ROUND_OPTIONS as readonly number[]).includes(value);
}

export function isDoodleDashDrawDuration(value: number): boolean {
  return (DOODLE_DASH_DRAW_DURATION_OPTIONS_MS as readonly number[]).includes(value);
}

export function selectDoodleDashWordOptions(
  categories: readonly DoodleDashCategory[],
  excludedWords: ReadonlySet<string> = new Set(),
  random: () => number = Math.random
): DoodleDashWord[] {
  const categorySet = new Set(categories);
  const eligible = DOODLE_DASH_WORDS.filter(
    (entry) => categorySet.has(entry.category) && !excludedWords.has(entry.word)
  );
  const fallback = DOODLE_DASH_WORDS.filter((entry) => categorySet.has(entry.category));
  const pool = eligible.length >= 3 ? eligible : fallback;
  if (pool.length < 3) {
    throw new Error('Doodle Dash needs at least three words in the selected categories.');
  }

  const shuffled = [...pool];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled.slice(0, 3);
}

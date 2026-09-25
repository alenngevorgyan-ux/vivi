export type StoryGenre =
  | 'Cyberpunk'
  | 'Dark Fantasy'
  | 'Cosmic Horror'
  | 'Sci-Fi'
  | 'Post-Apocalyptic'
  | 'Steampunk'
  | 'Mystery'
  | 'Surreal';

export type GameDifficulty = 'Casual' | 'Balanced' | 'Challenging' | 'Hardcore';

export type EndingType = 'victory' | 'defeat' | 'tragedy' | 'secret' | 'neutral';

export interface CharacterStat {
  label: string;
  value: number;
  min?: number;
  max?: number;
  icon?: string;
  color?: string;
  unit?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  icon?: string;
  quantity?: number;
  usable?: boolean;
  rarity?: 'common' | 'uncommon' | 'rare' | 'legendary';
}

export interface NodeConsequences {
  statChanges?: Record<string, number>;
  inventoryAdd?: InventoryItem[];
  inventoryRemove?: string[];
  flagChanges?: Record<string, boolean | string | number>;
}

export interface ChoiceConditions {
  requiredStats?: Record<string, { min?: number; max?: number }>;
  requiredItems?: string[];
  requiredFlags?: Record<string, boolean | string | number>;
}

export interface RiskOutcome {
  chance: number; // 0.1 - 0.95
  successNodeId: string;
  failureNodeId: string;
  rollStat?: string;
  description?: string;
}

export interface GameChoice {
  id: string;
  text: string;
  nextNodeId: string;
  hint?: string;
  conditions?: ChoiceConditions;
  riskOutcome?: RiskOutcome;
  cost?: {
    statKey: string;
    amount: number;
  };
}

export interface DialogueLine {
  speaker: string;
  text: string;
  avatar?: string;
}

export interface GameNode {
  id: string;
  title: string;
  chapter?: string;
  sceneImage?: string;
  ambient?: string;
  narrative: string;
  dialogue?: DialogueLine[];
  consequences?: NodeConsequences;
  isEnding?: boolean;
  endingType?: EndingType;
  endingTitle?: string;
  endingSummary?: string;
  choices?: GameChoice[];
  // 2D Playable World parameters
  worldConfig?: import('./worldTypes').WorldSceneConfig;
  whatReallyHappened?: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  conditionNodeId: string;
}

export interface GameSpec {
  id: string;
  title: string;
  author: string;
  synopsis: string;
  description: string;
  genre: StoryGenre | string;
  tags: string[];
  coverImage: string;
  bannerImage?: string;
  estimatedPlaytime: string;
  difficulty: GameDifficulty;
  initialState: {
    stats: Record<string, CharacterStat>;
    inventory: InventoryItem[];
    flags: Record<string, boolean | string | number>;
  };
  startNodeId: string;
  nodes: Record<string, GameNode>;
  whatReallyHappened?: string; // The author's real life memory truth
  achievements?: Achievement[];
  metrics: {
    plays: number;
    likes: number;
    rating: number;
    completions: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PlayHistoryStep {
  nodeId: string;
  nodeTitle: string;
  chosenChoiceText?: string;
  timestamp: number;
  statSnapshot: Record<string, number>;
  inventorySnapshot: InventoryItem[];
}

export interface ActiveGameState {
  spec: GameSpec;
  currentNodeId: string;
  stats: Record<string, number>;
  inventory: InventoryItem[];
  flags: Record<string, boolean | string | number>;
  history: PlayHistoryStep[];
  achievementsUnlocked: string[];
  isGameOver: boolean;
  endingNodeId?: string;
  lastDiceRoll?: {
    stat: string;
    roll: number;
    threshold: number;
    success: boolean;
  };
}

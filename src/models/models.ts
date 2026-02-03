export interface Mode {
  id: string;
  name: string;
  min_characters: number;
  max_characters: number;
  chambers: Act[]
}


export interface Act {
  id: string;
  name: number;
  type: Fight_type;
  options: Act_options;
  enemy_options?: Enemy_options
  enemy_selection: Enemy[]
  variation_fight_settings?: Variation_fight;
  variations: Variation[]
}

export interface Variation {
  timer: string;
  defeat?: string;
  waves: Wave[];
  wave: Wave_type;
  name?: any;
  monolit?: boolean;
}

export interface Wave {
  waveCount: number;
  included_enemy: Enemy[]
}

export interface Character {
  id: string;
  name: string;
  avatarUrl: string;
  rarity: CharacterRarityID;
  element?: ElementType;
  energy: number;
  active?: boolean;
  newIndex?: TimedValue;
  updatedAt?: string | number | Date;
}

export interface Enemy {
  id: string;
  name: string;
  element: ElementType;
  avatarUrl: string;
  specialMark: boolean;
  quantity?: number;
  categoryId: string; // Reference to category ID
  groupId: string; // Reference to group ID (це має бути string)
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  role: UserRole;
  settings: UserSettings;
}

// Тип елементу
export type ElementTypeName =
  | "empty" // нет у персонажей
  | "pyro"
  | "hydro"
  | "electro"
  | "cryo"
  | "dendro"
  | "anemo"
  | "geo";


// Тип бою
export type Fight_type =
  | "Boss_fight"
  | "Variation_fight"
  | "Arcana_fight";

// Опції ворогів
export interface Enemy_options {
  amount?: string;
  timer?: string;
  defeat?: string;
  special_type?: boolean;
}
export interface Act_options {
  timer?: string;
  amount?: boolean;
  timerEnable?: boolean;
  defeat?: boolean;
  special_type?: boolean;
}

export type CharacterRarity =
  | "legendary"
  | "epic"
  | "other";

export type UserRoleName = "admin" | "user";

export type EnemyCategoryName =
  | "Elemental_lifeforms"
  | "Hilichurls"
  | "The_Abbys"
  | "Fatui"
  | "Automatons"
  | "Other Human Factions"
  | "Mystical Beasts"
  | "Local Legend"
  | "Battle Hardened"
  | "World Boss";


export interface UserSettings {
  language: string;
  UserCharacters: Character[];
  UserLineup: string;
  UserTasks: Region_task[];
}


export interface TimedValue {
  value: string | boolean | number;
  expiresAt: number; // timestamp (ms)
}

export interface ElementType {
  id?: number;
  name: ElementTypeName;
  iconUrl?: string;
}

export interface CharacterRarityID {
  id: number;
  name: CharacterRarity;
  bgUrl: string;
}

export interface UserRole {
  name: UserRoleName;
}


export interface EnemyCategory {
  id: string;
  title: string;
  groups: EnemyGroup[]; // кожна категорія має список груп
}

export interface EnemyGroup {
  id: string;
  title: string;
  categoryId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Season_details {
  elemental_type_limided: ElementType[]; //Разрешенные 3 шт.
  opening_characters: Character[] // 6 из 6 шт.
  special_guests: Character[] // 4 из 4 шт.
  acts: Act[]
}

export interface Variation_fight {
  wave: Wave_type;
  timer: string;
  name?: string;
  monolit?: boolean;
}

export type Wave_type =
  | "1"
  | "2"
  | "3"
  | "custom";


export type ModalType = 'categories' | 'group' | 'enemy' | 'region' | 'task';



export interface Region {
  id?: string;
  name: string;
  tasks?: Region_task[]
}

export interface Region_task {
  id?: string;
  name: string;
  regionId: string;
  achiviment?: string;
  youtubeLink?: string;
  taskSeries?: boolean;
  parts?: Part[];
  finished?: boolean;
  updatedAt?: string | number | Date;
}

export interface Part {
  name: string;
  finished?: boolean;
}

export interface LineUpConfig {
  [modeId: string]: ModeConfiguration;
}

export interface ModeConfiguration {
  selectedCharacters: string[]; // List of character IDs
  placements: Record<string, string[]>; // Act ID -> List of Character IDs
  energyState: Record<string, number>; // Character ID -> current energy
  selectedEnemies?: Record<string, number>; // Act ID -> Selected Enemy Index
}

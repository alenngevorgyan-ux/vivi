export type ViviCharacterId = 'young_adult_masc_01' | 'young_adult_masc_02' | 'young_adult_fem_01' | 'young_adult_fem_02' | 'adult_masc_01' | 'adult_fem_01' | 'older_adult_01' | 'anonymous_01' | 'memory_child_01' | 'memory_child_02';
export type CharacterPose = 'idle' | 'walk' | 'sit' | 'look_at_phone' | 'talk' | 'wait' | 'turn' | 'leave';
export type CharacterFacing = 'front' | 'back' | 'left' | 'right';
export const characters: Record<ViviCharacterId, { skin: string; hair: string; clothing: string; trouser: string; build: 'small' | 'standard' | 'tall'; hairShape: 'short' | 'long' | 'cropped' | 'wavy' }> = {
  young_adult_masc_01: { skin: '#b5795b', hair: '#28292b', clothing: '#a96b55', trouser: '#394a55', build: 'standard', hairShape: 'short' },
  young_adult_masc_02: { skin: '#d7a17c', hair: '#71513c', clothing: '#667d70', trouser: '#384652', build: 'tall', hairShape: 'wavy' },
  young_adult_fem_01: { skin: '#d49a79', hair: '#3a2c2c', clothing: '#7d768d', trouser: '#46454e', build: 'standard', hairShape: 'long' },
  young_adult_fem_02: { skin: '#805a4c', hair: '#242b31', clothing: '#b6826a', trouser: '#4a5961', build: 'tall', hairShape: 'cropped' },
  adult_masc_01: { skin: '#c48b6d', hair: '#4e4b4b', clothing: '#60717b', trouser: '#3c4650', build: 'tall', hairShape: 'short' },
  adult_fem_01: { skin: '#a36a54', hair: '#2e302e', clothing: '#a4a28b', trouser: '#444b4d', build: 'standard', hairShape: 'wavy' },
  older_adult_01: { skin: '#b78971', hair: '#b6b0a2', clothing: '#7d826b', trouser: '#555b58', build: 'standard', hairShape: 'short' },
  anonymous_01: { skin: '#9b8580', hair: '#3f424a', clothing: '#525b62', trouser: '#41484d', build: 'tall', hairShape: 'cropped' },
  memory_child_01: { skin: '#c78b69', hair: '#594235', clothing: '#b48d69', trouser: '#626d67', build: 'small', hairShape: 'short' },
  memory_child_02: { skin: '#a97760', hair: '#342f33', clothing: '#9c776f', trouser: '#586671', build: 'small', hairShape: 'long' },
};
export const stagingDistances = {
  intimate_close: 42, normal_conversation: 90, awkward_distance: 170,
  confrontation: 115, across_table: 145, doorway_separation: 210,
  walking_side_by_side: 65, one_person_leaving: 235, public_group: 130,
} as const;

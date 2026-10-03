// Rebuild every board:  PW_CHROMIUM=<path to chrome> node build.mjs
// Needs the global playwright at /node-tools and Newsreader / Inter / IBM Plex Mono / Noto Serif Armenian installed as system fonts.
for (const f of ['b00_directions', 'b03_apartment', 'b04_office', 'b05_night', 'b06_sequence', 'b07_characters', 'b08_interaction', 'b09_reveal']) await import(`./${f}.mjs`);

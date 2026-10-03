// Rebuild every board:  PW_CHROMIUM=<path to chrome> node build.mjs
// Reference-board build uses global playwright at /node-tools and the proposed EN/RU Newsreader / Inter / IBM Plex Mono fonts. HY is deferred; no Armenian font installation is required.
for (const f of ['b00_directions', 'b03_apartment', 'b04_office', 'b05_night', 'b06_sequence', 'b07_characters', 'b08_interaction', 'b09_reveal']) await import(`./${f}.mjs`);

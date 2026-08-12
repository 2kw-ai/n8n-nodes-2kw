const { src, dest, parallel } = require('gulp');

function buildNodeIcons() {
  return src('nodes/**/*.svg').pipe(dest('dist/nodes'));
}

// The credential class carries its own icon since #363, and `file:` paths are
// resolved relative to the compiled file — so the svg has to land next to
// dist/credentials/TwoKwApi.credentials.js, not only under dist/nodes/.
function buildCredentialIcons() {
  return src('credentials/**/*.svg').pipe(dest('dist/credentials'));
}

exports['build:icons'] = parallel(buildNodeIcons, buildCredentialIcons);

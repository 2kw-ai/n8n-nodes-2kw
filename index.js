// n8n never imports this file: it discovers the node and credential through the
// `n8n` block in package.json, which points straight at the compiled dist/ paths.
//
// The file exists because `main` has to resolve. Without it, `require('n8n-nodes-2kw')`
// — which npm itself does when validating a tarball, and which anything treating the
// package as an ordinary library does — fails with MODULE_NOT_FOUND. This is the same
// empty entry point the official n8n-nodes-starter ships, for the same reason.
module.exports = {};

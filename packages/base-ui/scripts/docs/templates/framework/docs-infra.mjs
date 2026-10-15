// Runs docs-infra's command line with Node. Its bin file has no `#!` line: pnpm (upstream) runs
// it through a Node shim, while Bun links the file itself as the command, which a shell runs as a
// shell script.
await import('@mui/internal-docs-infra/cli');

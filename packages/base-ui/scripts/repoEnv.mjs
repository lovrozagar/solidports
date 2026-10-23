/**
 * The variables that tie a git process to one repository: what `git rev-parse --local-env-vars`
 * prints (git 2.55), the set git itself clears before running a command in a submodule.
 */
const REPO_LOCAL_GIT_VARS = new Set([
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_CONFIG',
  'GIT_CONFIG_PARAMETERS',
  'GIT_CONFIG_COUNT',
  'GIT_OBJECT_DIRECTORY',
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_IMPLICIT_WORK_TREE',
  'GIT_GRAFT_FILE',
  'GIT_INDEX_FILE',
  'GIT_NO_REPLACE_OBJECTS',
  'GIT_REPLACE_REF_BASE',
  'GIT_PREFIX',
  'GIT_SHALLOW_FILE',
  'GIT_COMMON_DIR',
]);

/** The numbered config pairs `GIT_CONFIG_COUNT` counts. */
const CONFIG_PAIR = /^GIT_CONFIG_(KEY|VALUE)_\d+$/;

/**
 * The environment for git commands aimed at the repo in their `cwd`: `env` (the caller's), without the
 * variables a process started under a git hook inherits from it (`GIT_DIR`, `GIT_INDEX_FILE` and
 * the rest), which would aim the command at the hook's repo. The user's other git settings
 * (`GIT_SSH_COMMAND`, `GIT_ASKPASS`, `GIT_TRACE` and the like) stay.
 */
export const repoEnv = (env = process.env) =>
  Object.fromEntries(
    Object.entries(env).filter(
      ([key]) => !REPO_LOCAL_GIT_VARS.has(key) && !CONFIG_PAIR.test(key),
    ),
  );

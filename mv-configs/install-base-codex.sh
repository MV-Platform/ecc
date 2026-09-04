#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ECC_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# shellcheck source=lib/managed-markdown.sh
source "$SCRIPT_DIR/lib/managed-markdown.sh"

DRY_RUN=false

for arg in "$@"; do
  case "$arg" in
    --dry-run)
      DRY_RUN=true
      ;;
    *)
      printf 'Usage: %s [--dry-run]\n' "$0" >&2
      exit 2
      ;;
  esac
done

if [[ -z "${HOME:-}" ]]; then
  printf 'Error: HOME is not set.\n' >&2
  exit 1
fi

BASE_SKILLS=(
  coding-standards
  documentation-lookup
  search-first
  security-review
  terminal-ops
  github-ops
)

COMMON_RULE_SOURCE="$ECC_ROOT/rules/common"
GLOBAL_RULE_SOURCE="$SCRIPT_DIR/rules/global/git-commit-rules.md"
CODEX_SUPPLEMENT_SOURCE="$ECC_ROOT/.codex/AGENTS.md"

if [[ ! -d "$COMMON_RULE_SOURCE" ]]; then
  printf 'Error: required rule directory not found: %s\n' "$COMMON_RULE_SOURCE" >&2
  exit 1
fi

if [[ ! -f "$GLOBAL_RULE_SOURCE" ]]; then
  printf 'Error: required global rule file not found: %s\n' "$GLOBAL_RULE_SOURCE" >&2
  exit 1
fi

if [[ ! -f "$CODEX_SUPPLEMENT_SOURCE" ]]; then
  printf 'Error: required Codex supplement not found: %s\n' "$CODEX_SUPPLEMENT_SOURCE" >&2
  exit 1
fi

for skill in "${BASE_SKILLS[@]}"; do
  if [[ ! -d "$ECC_ROOT/skills/$skill" ]]; then
    printf 'Error: required skill directory not found: %s\n' "$ECC_ROOT/skills/$skill" >&2
    exit 1
  fi
done

INSTALL_ARGS=(
  --profile core
  --without baseline:rules
  --target codex
  --no-hooks
)

if [[ "$DRY_RUN" == true ]]; then
  INSTALL_ARGS+=(--dry-run)
fi

CODEX_ROOT="$HOME/.codex"
RULES_TARGET="$CODEX_ROOT/rules/ecc/common"
GLOBAL_RULE_TARGET="$CODEX_ROOT/rules/mv/git-commit-rules.md"
LEGACY_SKILLS_ROOT="$CODEX_ROOT/skills"
SKILLS_TARGET_ROOT="$HOME/.agents/skills"
AGENTS_TARGET="$CODEX_ROOT/AGENTS.md"
CONFIG_TARGET="$CODEX_ROOT/config.toml"
AGENT_ROLES_TARGET="$CODEX_ROOT/agents"
CODEX_AGENT_ROLE_FILES=(
  "$AGENT_ROLES_TARGET/docs-researcher.toml"
  "$AGENT_ROLES_TARGET/explorer.toml"
  "$AGENT_ROLES_TARGET/reviewer.toml"
)

if [[ "$DRY_RUN" == true ]]; then
  "$ECC_ROOT/install.sh" "${INSTALL_ARGS[@]}"

  printf '\nMV-Platform Codex Base direct-copy plan (dry-run; no files copied)\n'
  printf '  rules/common -> %s\n' "$RULES_TARGET"
  printf '  rules/global/git-commit-rules.md -> %s\n' "$GLOBAL_RULE_TARGET"
  printf '  compiled common/global rules -> %s (managed block)\n' "$AGENTS_TARGET"
  printf '  Codex agent role name/description fields -> normalized in %s\n' "$AGENT_ROLES_TARGET"
  printf '  upstream Codex skills -> relocated from %s to %s\n' "$LEGACY_SKILLS_ROOT" "$SKILLS_TARGET_ROOT"
  printf '  existing %s and %s -> user content preserved\n' "$AGENTS_TARGET" "$CONFIG_TARGET"
  printf '  repository-only Codex supplement -> removed from %s if present\n' "$AGENTS_TARGET"
  for skill in "${BASE_SKILLS[@]}"; do
    printf '  skills/%s -> %s/%s\n' "$skill" "$SKILLS_TARGET_ROOT" "$skill"
  done
  exit 0
fi

SAFE_TARGETS=(
  "$AGENTS_TARGET"
  "$CONFIG_TARGET"
  "$CODEX_ROOT/ecc-install-state.json"
  "$RULES_TARGET"
  "$GLOBAL_RULE_TARGET"
  "${CODEX_AGENT_ROLE_FILES[@]}"
)
for skill in "${BASE_SKILLS[@]}"; do
  SAFE_TARGETS+=("$SKILLS_TARGET_ROOT/$skill")
done

node "$SCRIPT_DIR/lib/assert-safe-install-paths.js" \
  "$HOME" \
  "${SAFE_TARGETS[@]}"

"$ECC_ROOT/install.sh" "${INSTALL_ARGS[@]}" --dry-run --json \
  | node "$SCRIPT_DIR/lib/assert-safe-install-plan.js" \
    "$HOME" \
    "$LEGACY_SKILLS_ROOT" \
    "$SKILLS_TARGET_ROOT"

mv_validate_markdown_block "$AGENTS_TARGET" "ecc-global-rules"

# The upstream Codex adapter overwrites these files. Preserve user configuration
# and restore it before adding the MV-managed AGENTS.md block.
PRESERVE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/mv-codex-preserve.XXXXXX")"
PRESERVE_AGENTS=false
PRESERVE_CONFIG=false

if [[ -f "$AGENTS_TARGET" ]]; then
  node "$SCRIPT_DIR/lib/copy-file-atomically.js" \
    "$AGENTS_TARGET" \
    "$PRESERVE_DIR/AGENTS.md"
  PRESERVE_AGENTS=true
fi

if [[ -f "$CONFIG_TARGET" ]]; then
  node "$SCRIPT_DIR/lib/copy-file-atomically.js" \
    "$CONFIG_TARGET" \
    "$PRESERVE_DIR/config.toml"
  PRESERVE_CONFIG=true
fi

restore_codex_user_files() {
  local restore_failed=false

  if [[ "$PRESERVE_AGENTS" == true ]]; then
    mkdir -p "$CODEX_ROOT"
    if ! node "$SCRIPT_DIR/lib/copy-file-atomically.js" \
      "$PRESERVE_DIR/AGENTS.md" \
      "$AGENTS_TARGET"; then
      restore_failed=true
    fi
  fi
  if [[ "$PRESERVE_CONFIG" == true ]]; then
    mkdir -p "$CODEX_ROOT"
    if ! node "$SCRIPT_DIR/lib/copy-file-atomically.js" \
      "$PRESERVE_DIR/config.toml" \
      "$CONFIG_TARGET"; then
      restore_failed=true
    fi
  fi

  if [[ "$restore_failed" == true ]]; then
    return 1
  fi
  return 0
}

restore_on_exit() {
  local exit_status=$?
  trap - EXIT
  if ! restore_codex_user_files; then
    exit_status=1
  fi
  rm -rf "$PRESERVE_DIR"
  exit "$exit_status"
}

trap restore_on_exit EXIT
"$ECC_ROOT/install.sh" "${INSTALL_ARGS[@]}"
if ! restore_codex_user_files; then
  trap - EXIT
  rm -rf "$PRESERVE_DIR"
  exit 1
fi
trap - EXIT
rm -rf "$PRESERVE_DIR"

node "$SCRIPT_DIR/lib/remove-codex-repo-agents.js" \
  "$AGENTS_TARGET" \
  "$CODEX_SUPPLEMENT_SOURCE"

node "$SCRIPT_DIR/lib/normalize-codex-agent-roles.js" "$AGENT_ROLES_TARGET"
node "$SCRIPT_DIR/lib/relocate-codex-skills.js" \
  "$HOME" \
  "$CODEX_ROOT/ecc-install-state.json" \
  "$LEGACY_SKILLS_ROOT" \
  "$SKILLS_TARGET_ROOT" \
  "${BASE_SKILLS[@]}"

mkdir -p "$RULES_TARGET" "$(dirname "$GLOBAL_RULE_TARGET")" "$SKILLS_TARGET_ROOT"
cp -R "$COMMON_RULE_SOURCE/." "$RULES_TARGET/"
cp "$GLOBAL_RULE_SOURCE" "$GLOBAL_RULE_TARGET"

for skill in "${BASE_SKILLS[@]}"; do
  skill_target="$SKILLS_TARGET_ROOT/$skill"
  mkdir -p "$skill_target"
  cp -R "$ECC_ROOT/skills/$skill/." "$skill_target/"
done

mv_compile_and_replace_markdown_block \
  "$AGENTS_TARGET" \
  "ecc-global-rules" \
  "MV-Platform Global Rules" \
  "$RULES_TARGET" \
  "$(dirname "$GLOBAL_RULE_TARGET")"

# AGENTS.md/config.toml are user-managed, and the normalized role TOMLs are
# wrapper-managed transforms. Do not let ECC doctor/repair restore upstream's
# malformed role files or replace preserved user configuration.
node "$SCRIPT_DIR/lib/unmanage-codex-user-files.js" \
  "$CODEX_ROOT/ecc-install-state.json" \
  "$AGENTS_TARGET" \
  "$CONFIG_TARGET" \
  "${CODEX_AGENT_ROLE_FILES[@]}"

printf '\nMV-Platform Codex Base install complete\n'
printf '  rules/common -> %s\n' "$RULES_TARGET"
printf '  rules/global/git-commit-rules.md -> %s\n' "$GLOBAL_RULE_TARGET"
printf '  compiled rules -> %s\n' "$AGENTS_TARGET"
printf '  normalized Codex agent roles -> %s\n' "$AGENT_ROLES_TARGET"
printf '  user-visible Codex skills -> %s\n' "$SKILLS_TARGET_ROOT"
for skill in "${BASE_SKILLS[@]}"; do
  printf '  skills/%s -> %s/%s\n' "$skill" "$SKILLS_TARGET_ROOT" "$skill"
done

#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ECC_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

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

SOURCE_DIRS=("$ECC_ROOT/rules/common")
for skill in "${BASE_SKILLS[@]}"; do
  SOURCE_DIRS+=("$ECC_ROOT/skills/$skill")
done

for source_dir in "${SOURCE_DIRS[@]}"; do
  if [[ ! -d "$source_dir" ]]; then
    printf 'Error: required source directory not found: %s\n' "$source_dir" >&2
    exit 1
  fi
done

INSTALL_ARGS=(
  --profile core
  --without baseline:rules
  --target claude
)

if [[ "$DRY_RUN" == true ]]; then
  INSTALL_ARGS+=(--dry-run)
fi

"$ECC_ROOT/install.sh" "${INSTALL_ARGS[@]}"

RULES_TARGET="$HOME/.claude/rules/ecc/common"
SKILLS_TARGET_ROOT="$HOME/.claude/skills"

if [[ "$DRY_RUN" == true ]]; then
  printf '\nMV-Platform Base direct-copy plan (dry-run; no files copied)\n'
  printf '  rules/common -> %s\n' "$RULES_TARGET"
  for skill in "${BASE_SKILLS[@]}"; do
    printf '  skills/%s -> %s/%s\n' "$skill" "$SKILLS_TARGET_ROOT" "$skill"
  done
  exit 0
fi

mkdir -p "$RULES_TARGET" "$SKILLS_TARGET_ROOT"
cp -R "$ECC_ROOT/rules/common/." "$RULES_TARGET/"

for skill in "${BASE_SKILLS[@]}"; do
  skill_target="$SKILLS_TARGET_ROOT/$skill"
  mkdir -p "$skill_target"
  cp -R "$ECC_ROOT/skills/$skill/." "$skill_target/"
done

printf '\nMV-Platform Base direct copy complete\n'
printf '  rules/common -> %s\n' "$RULES_TARGET"
for skill in "${BASE_SKILLS[@]}"; do
  printf '  skills/%s -> %s/%s\n' "$skill" "$SKILLS_TARGET_ROOT" "$skill"
done

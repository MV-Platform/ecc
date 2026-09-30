#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ECC_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TARGET="claude"
DRY_RUN=false

for arg in "$@"; do
  case "$arg" in
    --target=claude) TARGET="claude" ;;
    --target=codex) TARGET="codex" ;;
    --dry-run) DRY_RUN=true ;;
    *)
      printf 'Usage: %s [--target=claude|codex] [--dry-run]\n' "$0" >&2
      exit 2
      ;;
  esac
done

if [[ -z "${HOME:-}" ]]; then
  printf 'Error: HOME is not set.\n' >&2
  exit 1
fi

case "$TARGET" in
  claude)
    BASE_SCRIPT="$SCRIPT_DIR/install-base.sh"
    SKILLS_TARGET_ROOT="$HOME/.claude/skills"
    ;;
  codex)
    BASE_SCRIPT="$SCRIPT_DIR/install-base-codex.sh"
    SKILLS_TARGET_ROOT="$HOME/.agents/skills"
    ;;
esac

ROLE_SKILLS=()
while IFS= read -r skill || [[ -n "$skill" ]]; do
  [[ -z "$skill" ]] && continue
  if [[ ! "$skill" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
    printf 'Error: invalid role skill name: %s\n' "$skill" >&2
    exit 1
  fi
  if [[ ! -f "$ECC_ROOT/skills/$skill/SKILL.md" ]]; then
    printf 'Error: required role skill missing: %s\n' "$skill" >&2
    exit 1
  fi
  ROLE_SKILLS+=("$skill")
done < "$SCRIPT_DIR/role-skills.txt"

SAFE_TARGETS=()
for skill in "${ROLE_SKILLS[@]}"; do
  SAFE_TARGETS+=("$SKILLS_TARGET_ROOT/$skill")
done
node "$SCRIPT_DIR/lib/assert-safe-install-paths.js" "$HOME" "${SAFE_TARGETS[@]}"

"$BASE_SCRIPT" --dry-run

if [[ "$DRY_RUN" == true ]]; then
  printf '\nMV-Platform unified %s skill plan (dry-run; no files copied)\n' "$TARGET"
  for skill in "${ROLE_SKILLS[@]}"; do
    printf '  skills/%s -> %s/%s\n' "$skill" "$SKILLS_TARGET_ROOT" "$skill"
  done
  exit 0
fi

"$BASE_SCRIPT"
mkdir -p "$SKILLS_TARGET_ROOT"
for skill in "${ROLE_SKILLS[@]}"; do
  skill_target="$SKILLS_TARGET_ROOT/$skill"
  mkdir -p "$skill_target"
  cp -R "$ECC_ROOT/skills/$skill/." "$skill_target/"
done

printf '\nMV-Platform unified %s skill install complete: 11 common + %s role skills\n' \
  "$TARGET" "${#ROLE_SKILLS[@]}"

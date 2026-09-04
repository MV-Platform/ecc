#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ECC_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

STACK="${1:-}"
if [[ -z "$STACK" ]]; then
  printf 'Usage: %s <stack> [--target=claude|codex] [--dry-run]\n' "$0" >&2
  exit 2
fi
shift

DRY_RUN=false
TARGET="claude"
for arg in "$@"; do
  case "$arg" in
    --dry-run)
      DRY_RUN=true
      ;;
    --target=claude)
      TARGET="claude"
      ;;
    --target=codex)
      TARGET="codex"
      ;;
    *)
      printf 'Usage: %s <stack> [--target=claude|codex] [--dry-run]\n' "$0" >&2
      exit 2
      ;;
  esac
done

RULE_PACKS=(common)
SKILLS=()

case "$STACK" in
  react-vite)
    STACK_NAME="React + Vite"
    RULE_PACKS+=(typescript web react)
    SKILLS+=(
      frontend-patterns
      react-patterns
      react-performance
      react-testing
      vite-patterns
      accessibility
    )
    ;;
  android)
    STACK_NAME="Android + Kotlin"
    RULE_PACKS+=(kotlin)
    SKILLS+=(
      android-clean-architecture
      kotlin-patterns
      kotlin-testing
      kotlin-coroutines-flows
      compose-multiplatform-patterns
      accessibility
    )
    ;;
  ios)
    STACK_NAME="iOS + Swift"
    RULE_PACKS+=(swift)
    SKILLS+=(
      swiftui-patterns
      swift-concurrency-6-2
      swift-actor-persistence
      swift-protocol-di-testing
      accessibility
    )
    ;;
  react-native)
    STACK_NAME="React Native"
    RULE_PACKS+=(typescript react-native)
    SKILLS+=(react-native-patterns)
    ;;
  spring-kotlin)
    STACK_NAME="Spring Boot + Kotlin"
    RULE_PACKS+=(kotlin)
    SKILLS+=(
      api-design
      springboot-patterns
      springboot-tdd
      springboot-verification
      springboot-security
      kotlin-patterns
      kotlin-testing
      kotlin-coroutines-flows
      jpa-patterns
      postgres-patterns
      database-migrations
    )
    ;;
  fastapi)
    STACK_NAME="FastAPI"
    RULE_PACKS+=(python)
    SKILLS+=(
      python-patterns
      python-testing
      fastapi-patterns
      api-design
      postgres-patterns
      database-migrations
    )
    ;;
  django)
    STACK_NAME="Django"
    RULE_PACKS+=(python)
    SKILLS+=(
      python-patterns
      python-testing
      django-patterns
      django-tdd
      django-verification
      django-security
      api-design
      postgres-patterns
      database-migrations
    )
    ;;
  infra)
    STACK_NAME="Infra (Terraform + Docker + Kubernetes)"
    SKILLS+=(
      deployment-patterns
      docker-patterns
      kubernetes-patterns
    )
    ;;
  *)
    printf 'Error: unsupported stack: %s\n' "$STACK" >&2
    exit 2
    ;;
esac

rule_source() {
  local rule_pack="$1"
  printf '%s\n' "$ECC_ROOT/rules/$rule_pack"
}

for rule_pack in "${RULE_PACKS[@]}"; do
  source_dir="$(rule_source "$rule_pack")"
  if [[ ! -d "$source_dir" ]]; then
    printf 'Error: required rule directory not found: %s\n' "$source_dir" >&2
    exit 1
  fi
done

for skill in "${SKILLS[@]}"; do
  source_dir="$ECC_ROOT/skills/$skill"
  if [[ ! -d "$source_dir" ]]; then
    printf 'Error: required skill directory not found: %s\n' "$source_dir" >&2
    exit 1
  fi
done

PROJECT_ROOT="$PWD"

case "$TARGET" in
  claude)
    HARNESS_NAME="Claude"
    RULES_TARGET_ROOT="$PROJECT_ROOT/.claude/rules/ecc"
    SKILLS_TARGET_ROOT="$PROJECT_ROOT/.claude/skills"
    ;;
  codex)
    HARNESS_NAME="Codex"
    RULES_TARGET_ROOT="$PROJECT_ROOT/.agents/rules/ecc"
    SKILLS_TARGET_ROOT="$PROJECT_ROOT/.agents/skills"
    AGENTS_TARGET="$PROJECT_ROOT/AGENTS.md"
    # shellcheck source=lib/managed-markdown.sh
    source "$SCRIPT_DIR/lib/managed-markdown.sh"
    ;;
esac

if [[ "$DRY_RUN" == true ]]; then
  printf '%s %s project direct-copy plan (dry-run; no files copied)\n' "$STACK_NAME" "$HARNESS_NAME"
  printf 'Project root: %s\n' "$PROJECT_ROOT"
  printf 'Rules:\n'
  for rule_pack in "${RULE_PACKS[@]}"; do
    printf '  %s -> %s/%s\n' "$(rule_source "$rule_pack")" "$RULES_TARGET_ROOT" "$rule_pack"
  done
  printf 'Skills:\n'
  for skill in "${SKILLS[@]}"; do
    printf '  %s -> %s/%s\n' "$ECC_ROOT/skills/$skill" "$SKILLS_TARGET_ROOT" "$skill"
  done
  if [[ "$TARGET" == "codex" ]]; then
    printf 'Compiled rules:\n'
    printf '  %s -> %s (managed block)\n' "$RULES_TARGET_ROOT" "$AGENTS_TARGET"
  fi
  exit 0
fi

SAFE_TARGETS=()
for rule_pack in "${RULE_PACKS[@]}"; do
  SAFE_TARGETS+=("$RULES_TARGET_ROOT/$rule_pack")
done
for skill in "${SKILLS[@]}"; do
  SAFE_TARGETS+=("$SKILLS_TARGET_ROOT/$skill")
done
if [[ "$TARGET" == "codex" ]]; then
  SAFE_TARGETS+=("$AGENTS_TARGET")
fi

node "$SCRIPT_DIR/lib/assert-safe-install-paths.js" \
  "$PROJECT_ROOT" \
  "${SAFE_TARGETS[@]}"

if [[ "$TARGET" == "codex" ]]; then
  mv_validate_markdown_block "$AGENTS_TARGET" "ecc-project-rules"
fi

mkdir -p "$RULES_TARGET_ROOT" "$SKILLS_TARGET_ROOT"

for rule_pack in "${RULE_PACKS[@]}"; do
  source_dir="$(rule_source "$rule_pack")"
  target_dir="$RULES_TARGET_ROOT/$rule_pack"
  mkdir -p "$target_dir"
  cp -R "$source_dir/." "$target_dir/"
done

for skill in "${SKILLS[@]}"; do
  source_dir="$ECC_ROOT/skills/$skill"
  target_dir="$SKILLS_TARGET_ROOT/$skill"
  mkdir -p "$target_dir"
  cp -R "$source_dir/." "$target_dir/"
done

if [[ "$TARGET" == "codex" ]]; then
  mv_compile_and_replace_markdown_block \
    "$AGENTS_TARGET" \
    "ecc-project-rules" \
    "MV-Platform Project Rules" \
    "$RULES_TARGET_ROOT"
fi

printf '%s %s project direct copy complete\n' "$STACK_NAME" "$HARNESS_NAME"
printf 'Project root: %s\n' "$PROJECT_ROOT"
printf 'Installed rule packs: %s\n' "${RULE_PACKS[*]}"
printf 'Installed skills: %s\n' "${SKILLS[*]}"
if [[ "$TARGET" == "codex" ]]; then
  printf 'Compiled project rules: %s\n' "$AGENTS_TARGET"
fi

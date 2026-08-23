#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ECC_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

STACK="${1:-}"
if [[ -z "$STACK" ]]; then
  printf 'Usage: %s <stack> [--dry-run]\n' "$0" >&2
  exit 2
fi
shift

DRY_RUN=false
for arg in "$@"; do
  case "$arg" in
    --dry-run)
      DRY_RUN=true
      ;;
    *)
      printf 'Usage: %s <stack> [--dry-run]\n' "$0" >&2
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
CLAUDE_ROOT="$PROJECT_ROOT/.claude"
RULES_TARGET_ROOT="$CLAUDE_ROOT/rules/ecc"
SKILLS_TARGET_ROOT="$CLAUDE_ROOT/skills"

if [[ "$DRY_RUN" == true ]]; then
  printf '%s project direct-copy plan (dry-run; no files copied)\n' "$STACK_NAME"
  printf 'Project root: %s\n' "$PROJECT_ROOT"
  printf 'Rules:\n'
  for rule_pack in "${RULE_PACKS[@]}"; do
    printf '  %s -> %s/%s\n' "$(rule_source "$rule_pack")" "$RULES_TARGET_ROOT" "$rule_pack"
  done
  printf 'Skills:\n'
  for skill in "${SKILLS[@]}"; do
    printf '  %s -> %s/%s\n' "$ECC_ROOT/skills/$skill" "$SKILLS_TARGET_ROOT" "$skill"
  done
  exit 0
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

printf '%s project direct copy complete\n' "$STACK_NAME"
printf 'Project root: %s\n' "$PROJECT_ROOT"
printf 'Installed rule packs: %s\n' "${RULE_PACKS[*]}"
printf 'Installed skills: %s\n' "${SKILLS[*]}"

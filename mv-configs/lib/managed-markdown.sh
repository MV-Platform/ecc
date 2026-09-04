#!/usr/bin/env bash

# Validate one MV-Platform-owned block before any surrounding install writes.
mv_validate_markdown_block() {
  local target_file="$1"
  local block_id="$2"
  local begin_marker="<!-- mv-platform:${block_id}:start -->"
  local end_marker="<!-- mv-platform:${block_id}:end -->"
  local begin_count=0
  local end_count=0

  if [[ -L "$target_file" ]]; then
    printf 'Error: refusing symbolic-link Markdown target: %s\n' "$target_file" >&2
    return 1
  fi
  if [[ -e "$target_file" && ! -f "$target_file" ]]; then
    printf 'Error: Markdown target is not a regular file: %s\n' "$target_file" >&2
    return 1
  fi

  if [[ -f "$target_file" ]]; then
    begin_count="$(grep -Fxc "$begin_marker" "$target_file" || true)"
    end_count="$(grep -Fxc "$end_marker" "$target_file" || true)"

    if [[ "$begin_count" -ne "$end_count" || "$begin_count" -gt 1 ]]; then
      printf 'Error: malformed MV-Platform block in %s\n' "$target_file" >&2
      return 1
    fi
  fi
}

# Replace one MV-Platform-owned block while preserving all user-managed text.
mv_replace_markdown_block() {
  local target_file="$1"
  local block_id="$2"
  local block_file="$3"
  local begin_marker="<!-- mv-platform:${block_id}:start -->"
  local end_marker="<!-- mv-platform:${block_id}:end -->"
  local target_dir
  local output_file
  local target_mode
  local begin_count=0

  mv_validate_markdown_block "$target_file" "$block_id" || return 1

  target_dir="$(dirname "$target_file")"
  mkdir -p "$target_dir"
  output_file="$(mktemp "$target_dir/.mv-markdown.XXXXXX")"

  if [[ -f "$target_file" ]]; then
    begin_count="$(grep -Fxc "$begin_marker" "$target_file" || true)"
  fi

  if [[ "$begin_count" -eq 1 ]]; then
    if ! awk \
      -v begin="$begin_marker" \
      -v end="$end_marker" \
      -v block_file="$block_file" '
        $0 == begin {
          print begin
          while ((getline line < block_file) > 0) print line
          close(block_file)
          print end
          skipping = 1
          next
        }
        $0 == end { skipping = 0; next }
        !skipping { print }
      ' "$target_file" > "$output_file"; then
      rm -f "$output_file"
      return 1
    fi
  else
    if ! {
      if [[ -f "$target_file" && -s "$target_file" ]]; then
        cat "$target_file"
        printf '\n'
      fi
      printf '%s\n' "$begin_marker"
      cat "$block_file"
      printf '%s\n' "$end_marker"
    } > "$output_file"; then
      rm -f "$output_file"
      return 1
    fi
  fi

  if [[ -f "$target_file" ]]; then
    if target_mode="$(stat -f '%Lp' "$target_file" 2>/dev/null)"; then
      :
    elif target_mode="$(stat -c '%a' "$target_file" 2>/dev/null)"; then
      :
    else
      rm -f "$output_file"
      printf 'Error: unable to preserve Markdown target mode: %s\n' "$target_file" >&2
      return 1
    fi
    if ! chmod "$target_mode" "$output_file"; then
      rm -f "$output_file"
      return 1
    fi
  fi

  if ! mv -f "$output_file" "$target_file"; then
    rm -f "$output_file"
    return 1
  fi
}

# Compile Markdown rule files into content Codex can load through AGENTS.md.
mv_compile_markdown_rules() {
  local output_file="$1"
  local title="$2"
  shift 2
  local source_dir
  local source_file
  local source_label

  {
    printf '# %s\n\n' "$title"
    printf '이 블록은 MV-Platform ECC 설치 스크립트가 관리합니다. 블록 밖의 사용자 지침은 보존됩니다.\n'

    for source_dir in "$@"; do
      while IFS= read -r source_file; do
        source_label="$(basename "$source_dir")/${source_file#"$source_dir"/}"
        printf '\n<!-- source: %s -->\n\n' "$source_label"
        cat "$source_file"
        printf '\n'
      done < <(find "$source_dir" -type f -name '*.md' -print | LC_ALL=C sort)
    done
  } > "$output_file"
}

# Compile and replace a managed block while always cleaning the temporary file.
mv_compile_and_replace_markdown_block() {
  local target_file="$1"
  local block_id="$2"
  local title="$3"
  shift 3
  local compiled_rules

  compiled_rules="$(mktemp "${TMPDIR:-/tmp}/mv-compiled-rules.XXXXXX")"
  if ! mv_compile_markdown_rules "$compiled_rules" "$title" "$@"; then
    rm -f "$compiled_rules"
    return 1
  fi
  if ! mv_replace_markdown_block "$target_file" "$block_id" "$compiled_rules"; then
    rm -f "$compiled_rules"
    return 1
  fi
  rm -f "$compiled_rules"
}

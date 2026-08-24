#!/usr/bin/env bash

# Replace one MV-Platform-owned block while preserving all user-managed text.
mv_replace_markdown_block() {
  local target_file="$1"
  local block_id="$2"
  local block_file="$3"
  local begin_marker="<!-- mv-platform:${block_id}:start -->"
  local end_marker="<!-- mv-platform:${block_id}:end -->"
  local work_dir
  local output_file
  local begin_count=0
  local end_count=0

  work_dir="$(mktemp -d "${TMPDIR:-/tmp}/mv-markdown.XXXXXX")"
  output_file="$work_dir/output.md"

  if [[ -f "$target_file" ]]; then
    begin_count="$(grep -Fxc "$begin_marker" "$target_file" || true)"
    end_count="$(grep -Fxc "$end_marker" "$target_file" || true)"

    if [[ "$begin_count" -ne "$end_count" || "$begin_count" -gt 1 ]]; then
      rm -rf "$work_dir"
      printf 'Error: malformed MV-Platform block in %s\n' "$target_file" >&2
      return 1
    fi

  fi

  if [[ "$begin_count" -eq 1 ]]; then
    awk \
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
      ' "$target_file" > "$output_file"
  else
    {
      if [[ -f "$target_file" && -s "$target_file" ]]; then
        cat "$target_file"
        printf '\n'
      fi
      printf '%s\n' "$begin_marker"
      cat "$block_file"
      printf '%s\n' "$end_marker"
    } > "$output_file"
  fi

  mkdir -p "$(dirname "$target_file")"
  cp "$output_file" "$target_file"
  rm -rf "$work_dir"
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

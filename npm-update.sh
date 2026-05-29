#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
NPM=${NPM:-npm}

# Active projects that install @vizualmodel/vmblu-cli and/or
# @vizualmodel/vmblu-runtime. Deprecated zzz-* examples are intentionally
# excluded.
PROJECTS=(
  "."
  "core"
  "playground"
  "ui-svelte"
  "examples/chat-application/chat-client"
  "examples/chat-application/chat-server"
  "examples/solar-system"
)

for project in "${PROJECTS[@]}"; do
  project_dir="$ROOT_DIR/$project"
  package_json="$project_dir/package.json"

  if [[ ! -f "$package_json" ]]; then
    echo "Skipping $project: package.json not found" >&2
    continue
  fi

  if ! grep -q '@vizualmodel/vmblu-\(cli\|runtime\)' "$package_json"; then
    echo "Skipping $project: no @vizualmodel vmblu dependency"
    continue
  fi

  echo
  echo "Updating npm dependencies in $project"
  (cd "$project_dir" && "$NPM" install "$@")
done

echo
echo "npm dependency update complete."

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
EXAMPLES_DIR="$ROOT_DIR/../vmblu-examples"
NPM=${NPM:-npm}

# Framework projects are explicit because not every vmblu package is an
# independently installed project. Example projects are discovered below.
FRAMEWORK_PROJECTS=(
  "."
  "core"
  "playground"
  "ui-svelte"
)

update_project() {
  local project_dir=$1
  local project=$2
  shift 2
  local package_json="$project_dir/package.json"
  local vmblu_packages=()

  if [[ ! -f "$package_json" ]]; then
    echo "Skipping $project: package.json not found" >&2
    return
  fi
  if grep -q '@vizualmodel/vmblu-cli' "$package_json"; then
    vmblu_packages+=("@vizualmodel/vmblu-cli")
  fi
  if grep -q '@vizualmodel/vmblu-runtime' "$package_json"; then
    vmblu_packages+=("@vizualmodel/vmblu-runtime")
  fi
  if [[ ${#vmblu_packages[@]} -eq 0 ]]; then
    echo "Skipping $project: no @vizualmodel vmblu dependency"
    return
  fi

  echo
  echo "Updating vmblu dependencies in $project"
  (cd "$project_dir" && "$NPM" update "${vmblu_packages[@]}" "$@")
}

for project in "${FRAMEWORK_PROJECTS[@]}"; do
  update_project "$ROOT_DIR/$project" "$project" "$@"
done

if [[ ! -d "$EXAMPLES_DIR" ]]; then
  echo "Skipping examples: $EXAMPLES_DIR not found" >&2
else
  while IFS= read -r -d '' package_json; do
    project_dir=${package_json%/package.json}
    project=${project_dir#"$ROOT_DIR/"}
    update_project "$project_dir" "$project" "$@"
  done < <(
    find "$EXAMPLES_DIR" \
      -type d \( -name node_modules -o -name 'zzz-*' \) -prune -o \
      -type f -name package.json -print0
  )
fi

echo
echo "npm dependency update complete."

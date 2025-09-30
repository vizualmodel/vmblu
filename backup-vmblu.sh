#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR=${SOURCE_DIR:-c:/dev/vmblu}
DEST_DIR_DEFAULT=${DEST_DIR_DEFAULT:-c:/dev/backups}

usage() {
  echo "Usage: $0 [destination_directory]" >&2
  echo "Creates a timestamped archive of $SOURCE_DIR excluding any node_modules directories." >&2
}

if [[ ${1:-} == "-h" || ${1:-} == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -gt 1 ]]; then
  usage
  exit 1
fi

DEST_DIR=${1:-$DEST_DIR_DEFAULT}

convert_path() {
  local path=$1
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -u "$path"
  else
    printf '%s\n' "$path"
  fi
}

to_windows() {
  local path=$1
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -w "$path"
  else
    printf '%s\n' "$path"
  fi
}

SOURCE_POSIX=$(convert_path "$SOURCE_DIR")
DEST_POSIX=$(convert_path "$DEST_DIR")

case "$DEST_POSIX/" in
  "$SOURCE_POSIX"/*)
    echo "Destination directory must not be inside the source tree." >&2
    exit 1
    ;;
esac

mkdir -p "$DEST_POSIX"

parent_dir=$(dirname "$SOURCE_POSIX")
base_name=$(basename "$SOURCE_POSIX")

timestamp=$(date +%Y%m%d-%H%M%S)
archive_name="vmblu-backup-$timestamp.tar.gz"
archive_path="$DEST_POSIX/$archive_name"

tar -czf "$archive_path" \
  --exclude='node_modules' \
  --exclude='*/node_modules' \
  -C "$parent_dir" "$base_name"

echo "Created backup: $(to_windows "$archive_path")"
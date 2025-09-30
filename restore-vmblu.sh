#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR=${BACKUP_DIR:-c:/dev/backups}
DEFAULT_RESTORE_DIR=${DEFAULT_RESTORE_DIR:-c:/dev/vmblu-restored}

usage() {
  echo "Usage: $0 [restore_destination]" >&2
  echo "Restores vmblu from the most recent backup archive in $BACKUP_DIR." >&2
}

if [[ ${1:-} == "-h" || ${1:-} == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -gt 1 ]]; then
  usage
  exit 1
fi

RESTORE_DIR=${1:-$DEFAULT_RESTORE_DIR}

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

BACKUP_POSIX=$(convert_path "$BACKUP_DIR")
RESTORE_POSIX=$(convert_path "$RESTORE_DIR")

if [[ ! -d "$BACKUP_POSIX" ]]; then
  echo "Backup directory not found: $(to_windows "$BACKUP_DIR")" >&2
  exit 1
fi

shopt -s nullglob
backups=("$BACKUP_POSIX"/vmblu-backup-*.tar.gz)
shopt -u nullglob

if (( ${#backups[@]} == 0 )); then
  echo "No vmblu backups found in $(to_windows "$BACKUP_DIR")." >&2
  exit 1
fi

IFS=$'\n' latest_archive=$(printf '%s\n' "${backups[@]}" | sort | tail -n 1)
unset IFS

mkdir -p "$RESTORE_POSIX"

if [[ -n $(find "$RESTORE_POSIX" -mindepth 1 -print -quit 2>/dev/null) ]]; then
  echo "Restore directory is not empty: $(to_windows "$RESTORE_DIR")" >&2
  echo "Please choose an empty directory." >&2
  exit 1
fi

# Strip the top-level vmblu directory so contents land directly under the restore target.
tar -xzf "$latest_archive" -C "$RESTORE_POSIX" --strip-components=1

echo "Restored $(to_windows "$latest_archive") to $(to_windows "$RESTORE_DIR")"

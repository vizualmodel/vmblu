#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR=${SOURCE_DIR:-c:/dev/vmblu}

usage() {
  echo "Usage: $0 <drive_letter>" >&2
  echo "Copies $SOURCE_DIR to <drive_letter>:/vmblu excluding all node_modules directories." >&2
}

if [[ ${1:-} == "-h" || ${1:-} == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -ne 1 ]]; then
  usage
  exit 1
fi

DRIVE_LETTER=${1%:}
if [[ ! $DRIVE_LETTER =~ ^[A-Za-z]$ ]]; then
  echo "Drive letter must be a single letter, for example: D" >&2
  exit 1
fi

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
DEST_ROOT_POSIX=$(convert_path "${DRIVE_LETTER^^}:/")
DEST_POSIX="${DEST_ROOT_POSIX%/}/vmblu"
SOURCE_WIN=$(to_windows "$SOURCE_POSIX")
DEST_WIN=$(to_windows "$DEST_POSIX")

case "$DEST_POSIX/" in
  "$SOURCE_POSIX"/*)
    echo "Destination directory must not be inside the source tree." >&2
    exit 1
    ;;
esac

mkdir -p "$DEST_ROOT_POSIX"

echo "Copying $SOURCE_WIN to $DEST_WIN..."

if command -v robocopy >/dev/null 2>&1; then
  spinner='|/-\'
  log_file=$(mktemp)
  trap 'rm -f "$log_file"' EXIT

  powershell.exe -NoProfile -Command \
    "& { Robocopy.exe '$SOURCE_WIN' '$DEST_WIN' /E /R:1 /W:1 /MT:16 /XD node_modules /XJ /NFL /NDL /NJH /NJS /NP *> '$log_file'; exit \$LASTEXITCODE }" &
  robo_pid=$!
  spin_index=0

  while kill -0 "$robo_pid" 2>/dev/null; do
    spin_char=${spinner:spin_index:1}
    printf 'Progress: %s\r' "$spin_char"
    spin_index=$(((spin_index + 1) % 4))
    sleep 0.2
  done

  set +e
  wait "$robo_pid"
  robo_status=$?
  set -e

  if (( robo_status >= 8 )); then
    cat "$log_file" >&2
    exit "$robo_status"
  fi

  printf 'Progress: done\n'
else
  tar -cf - \
    --exclude='node_modules' \
    --exclude='*/node_modules' \
    -C "$(dirname "$SOURCE_POSIX")" "$(basename "$SOURCE_POSIX")" |
    tar -xf - -C "$DEST_ROOT_POSIX"
fi

echo "Copied vmblu to $DEST_WIN"

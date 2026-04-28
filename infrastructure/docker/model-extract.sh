#!/bin/sh
set -eu

SOURCE_ROOT="${MODEL_SOURCE_ROOT:-/model-source}"
OUTPUT_DIR="${MODEL_OUTPUT_DIR:-/models}"
OUTPUT_NAME="${MODEL_OUTPUT_NAME:-model.gguf}"
MODEL_FILE_PATTERN="${MODEL_FILE_PATTERN:-*.gguf}"

mkdir -p "$OUTPUT_DIR"

find_model_file() {
  find "$SOURCE_ROOT" \
    \( -path /model-source/proc -o -path /model-source/sys -o -path /model-source/dev \) -prune -o \
    -type f \( -iname "$MODEL_FILE_PATTERN" -o -iname "*.gguf" \) -print 2>/dev/null \
    | head -n 1
}

MODEL_PATH="$(find_model_file || true)"

if [ -z "$MODEL_PATH" ]; then
  echo "[model-extract] no compatible model file found under $SOURCE_ROOT"
  echo "[model-extract] set MODEL_FILE_PATTERN to a more specific pattern if needed"
  exit 1
fi

echo "[model-extract] using model file: $MODEL_PATH"
cp "$MODEL_PATH" "$OUTPUT_DIR/$OUTPUT_NAME"
chmod 0644 "$OUTPUT_DIR/$OUTPUT_NAME"
ls -lh "$OUTPUT_DIR/$OUTPUT_NAME"
echo "[model-extract] model exported to $OUTPUT_DIR/$OUTPUT_NAME"
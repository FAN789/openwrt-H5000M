#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST_DIR="${ROOT_DIR}/files/lib/firmware/h5000m"
DEST_FILE="${DEST_DIR}/MT7991_MT7976_EEPROM_BE5040_iPAiLNA.bin"

EEPROM_URL="${H5000M_EEPROM_URL:-https://raw.githubusercontent.com/sukerxi/m798x-tdbe/84c4a2db178d923d9e7ff0256c07be2f383d19fb/package/mtk/drivers/mt_hwifi/files/BE5040-20250423/MT7991_MT7976_EEPROM_BE5040_iPAiLNA.bin}"
EXPECTED_SIZE=7680
EXPECTED_SHA256="d524a4fd42dc942cae178d465073238f035e89998494c1012218c03662f5dcbd"

mkdir -p "${DEST_DIR}"

echo "下载 H5000M WiFi EEPROM：${EEPROM_URL}"
curl -L --fail --retry 3 --retry-delay 2 -o "${DEST_FILE}.tmp" "${EEPROM_URL}"

actual_size="$(wc -c < "${DEST_FILE}.tmp" | tr -d ' ')"
if [ "${actual_size}" != "${EXPECTED_SIZE}" ]; then
  echo "EEPROM 文件大小异常：${actual_size}，期望：${EXPECTED_SIZE}"
  rm -f "${DEST_FILE}.tmp"
  exit 1
fi

actual_sha256="$(sha256sum "${DEST_FILE}.tmp" | awk '{print $1}')"
if [ "${actual_sha256}" != "${EXPECTED_SHA256}" ]; then
  echo "EEPROM SHA256 异常：${actual_sha256}"
  echo "期望 SHA256：${EXPECTED_SHA256}"
  rm -f "${DEST_FILE}.tmp"
  exit 1
fi

mv "${DEST_FILE}.tmp" "${DEST_FILE}"
echo "EEPROM 已准备：${DEST_FILE}"

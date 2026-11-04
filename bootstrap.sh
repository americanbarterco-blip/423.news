#!/usr/bin/env bash
# One-shot setup for Claudia's listening server (Ubuntu). Run on the Oracle server as the ubuntu user:
#   bash bootstrap.sh
# Put desk_pipeline.py desk_loop.py paraphrase.py claudia.py listen.py claudia.service in the same folder first.
set -euo pipefail
sudo apt-get update
sudo apt-get install -y ffmpeg python3-venv git
sudo mkdir -p /opt/423news
sudo cp desk_pipeline.py desk_loop.py paraphrase.py claudia.py listen.py /opt/423news/
sudo useradd -r -m claudia 2>/dev/null || true
sudo python3 -m venv /opt/423news/venv
sudo /opt/423news/venv/bin/pip install faster-whisper
sudo chown -R claudia /opt/423news

if [ ! -f /etc/claudia.env ]; then
  echo "Enter your secrets (nothing is shown on screen as you paste is fine; press Enter after each)."
  read -rp  "ANTHROPIC_API_KEY: " A
  read -rp  "SUPABASE_URL: " U
  read -rp  "SUPABASE_SERVICE_KEY: " K
  echo 'Paste the JSON map of feed id -> stream URL on ONE line, e.g. {"9119":"https://..."}'
  read -rp  "BROADCASTIFY_STREAM_URLS: " S
  printf 'ANTHROPIC_API_KEY=%s\nSUPABASE_URL=%s\nSUPABASE_SERVICE_KEY=%s\nBROADCASTIFY_STREAM_URLS=%s\n' "$A" "$U" "$K" "$S" | sudo tee /etc/claudia.env >/dev/null
  sudo chmod 600 /etc/claudia.env
fi

sudo cp claudia.service /etc/systemd/system/claudia.service
sudo systemctl daemon-reload
sudo systemctl enable --now claudia
echo; echo "Running. Watch it with:  journalctl -u claudia -f"

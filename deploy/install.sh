#!/bin/sh
set -eu
test ! -e /etc/nginx/conf.d/nogotochki.conf
test ! -e /etc/systemd/system/nogotochki.service
install -d /opt/nogotochki/app /opt/nogotochki/download
cd /opt/nogotochki/download
curl -fSL --max-time 180 -o node.tar.xz https://nodejs.org/dist/v24.19.0/node-v24.19.0-linux-x64.tar.xz
curl -fsSL --max-time 30 -o SHASUMS256.txt https://nodejs.org/dist/v24.19.0/SHASUMS256.txt
expected=$(awk '$2 == "node-v24.19.0-linux-x64.tar.xz" {print $1}' SHASUMS256.txt)
test -n "$expected"
printf '%s  node.tar.xz\n' "$expected" | sha256sum -c -
tar -xJf node.tar.xz -C /opt/nogotochki
ln -s /opt/nogotochki/node-v24.19.0-linux-x64 /opt/nogotochki/node
id nogotochki >/dev/null 2>&1 || useradd --system --home-dir /var/lib/nogotochki --shell /usr/sbin/nologin nogotochki
install -d -o nogotochki -g nogotochki -m 700 /var/lib/nogotochki
tar -xf /tmp/nogotochki-study.tar -C /opt/nogotochki/app
cd /opt/nogotochki/app
runuser -u nogotochki -- env DB_PATH=/var/lib/nogotochki/booking.sqlite /opt/nogotochki/node/bin/node server/seed.js
install -m 644 deploy/nogotochki.service /etc/systemd/system/nogotochki.service
install -m 644 deploy/nogotochki.conf /etc/nginx/conf.d/nogotochki.conf
nginx -t
systemctl daemon-reload
systemctl enable --now nogotochki
systemctl reload nginx
systemctl is-active nogotochki nginx freebk-bot p2p-livekit

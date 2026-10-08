#!/bin/sh
set -eu
test -f /etc/systemd/system/nogotochki.service
test -d /opt/nogotochki/app
test -f /var/lib/nogotochki/booking.sqlite
stamp=$(date -u +%Y%m%dT%H%M%SZ)
install -d -m 700 /opt/nogotochki/backups
systemctl stop nogotochki
cp -a /var/lib/nogotochki /opt/nogotochki/backups/data-$stamp
cp -a /opt/nogotochki/app /opt/nogotochki/backups/app-$stamp
trap 'systemctl start nogotochki' EXIT
tar -xf /tmp/nogotochki-study.tar -C /opt/nogotochki/app
systemctl start nogotochki
systemctl is-active nogotochki nginx freebk-bot p2p-livekit

#!/usr/bin/env bash
set -e
cd po
for i in *.po; do
  msgmerge -UN "$i" messages.pot
done
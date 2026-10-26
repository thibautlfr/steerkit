#!/bin/sh
# Renders the home screen icon from its HTML source with headless Chrome,
# into public/. Run again after editing images/icon.html. The link preview,
# public/og.png, is the Steerkit title card, rendered with the other surfaces
# of thibaut-lefrancois.com outside this repository.
set -e
cd "$(dirname "$0")"
chrome="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
render() {
	"$chrome" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
		--window-size="$2" --screenshot="../public/$3" "file://$PWD/$1" 2>/dev/null
}
render icon.html 180,180 apple-touch-icon.png

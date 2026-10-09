#!/bin/sh
# Renders the link preview and the home screen icon from their HTML sources
# with headless Chrome, into public/. Run again after editing images/*.html.
set -e
cd "$(dirname "$0")"
chrome="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
render() {
	"$chrome" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
		--window-size="$2" --screenshot="../public/$3" "file://$PWD/$1" 2>/dev/null
}
render og.html 1200,630 og.png
render icon.html 180,180 apple-touch-icon.png

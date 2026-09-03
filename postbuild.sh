#!/bin/sh
# Pastikan index.html standar dari hasil build client disalin dengan benar ke root dist/client
if [ -f "dist/client/index.html" ]; then
  cp dist/client/index.html dist/client/404.html
fi
echo "/*    /index.html   200" > dist/client/_redirects

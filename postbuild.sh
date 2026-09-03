#!/bin/sh
if [ -d "dist/client" ]; then
  if [ -f "dist/client/index.html" ]; then
    cp dist/client/index.html dist/client/404.html
  fi
fi
echo "/*    /index.html   200" > dist/client/_redirects

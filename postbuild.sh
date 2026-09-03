#!/bin/sh
mkdir -p dist/client
echo '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>HRIS Tokovapeku</title></head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>' > dist/client/index.html

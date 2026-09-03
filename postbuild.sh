#!/bin/sh
mkdir -p dist/client

CLIENT_ENTRY=$(ls dist/client/assets/client-*.js dist/client/assets/entry-*.js dist/client/assets/bootstrap-*.js 2>/dev/null | head -n 1 | xargs -n 1 basename)

if [ -z "$CLIENT_ENTRY" ]; then
  CLIENT_ENTRY=$(ls dist/client/assets/*.js 2>/dev/null | head -n 1 | xargs -n 1 basename)
fi

cat << HTML > dist/client/index.html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>HRIS Tokovapeku</title>
  <link rel="icon" href="data:;base64,iVBORw0KGgo=" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/assets/${CLIENT_ENTRY}"></script>
</body>
</html>
HTML

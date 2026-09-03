#!/bin/sh
mkdir -p dist/client
MAIN_JS=$(ls dist/client/assets/main-*.js dist/client/assets/entry-*.js dist/client/assets/bootstrap-*.js dist/client/assets/index-*.js 2>/dev/null | head -n 1 | xargs -n 1 basename)

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
  <script type="module" src="/assets/${MAIN_JS}"></script>
</body>
</html>
HTML

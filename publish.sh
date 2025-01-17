mmk upgrade \
  && tsc \
  && npm publish --otp=$1 \
  && git add . \
  && git commit -m "Publish" \
  && git push origin HEAD
# pkg -c pkg.json pkg.js
# pushd dist
# mv out/mm-win.exe Merrymake-CLI/mm.exe
# zip windows.zip Merrymake-CLI/mm.exe Merrymake-CLI/install.ps1
# rm Merrymake-CLI/mm.exe
# popd
# start https://github.com/merrymake/cli/releases/new
#!/usr/bin/env node
import { setCommand } from "./mmCommand.js";
setCommand("mm");
import { stdin } from "node:process";
if (!stdin.isTTY || stdin.setRawMode === undefined) {
  console.log(
    "This console does not support TTY, please use 'winpty mm' instead."
  );
  process.exit(1);
}
// import { YELLOW, FG_DEFAULT } from "./prompt.js";
// process.env["UPDATE_MESSAGE"] = `get the latest version from:
// ${YELLOW}https://github.com/merrymake/cli/releases${FG_DEFAULT}`;
import "./index.js";

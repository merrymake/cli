#!/usr/bin/env node
process.env["COMMAND"] = "mm";
import { stdin } from "node:process";
if (!stdin.isTTY || stdin.setRawMode === undefined) {
  console.log(
    "This console does not support TTY, please use 'winpty mm' instead."
  );
  process.exit(1);
}
import { COLOR3, NORMAL_COLOR } from "./prompt";
process.env["UPDATE_MESSAGE"] = `get the latest version from:
${COLOR3}https://github.com/merrymake/cli/releases${NORMAL_COLOR}`;
import "./index";

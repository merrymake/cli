#!/usr/bin/env node
process.env["COMMAND"] = "mm";
import { stdin } from "node:process";
if (!stdin.isTTY || stdin.setRawMode === undefined) {
  console.log(
    "This console does not support TTY, please use the 'mmk'-command instead."
  );
  process.exit(1);
}
import { YELLOW, NORMAL_COLOR } from "./prompt";
process.env["UPDATE_MESSAGE"] = `to update run the command:
${YELLOW}npm update -g @merrymake/cli${NORMAL_COLOR}`;
import "./index";

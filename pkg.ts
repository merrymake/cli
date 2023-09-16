#!/usr/bin/env node
process.env["COMMAND"] = "mm";
import { stdin } from "node:process";
if (!stdin.isTTY || stdin.setRawMode === undefined) {
  console.log(
    "This console does not support TTY, please use 'winpty mm' instead."
  );
  process.exit(1);
}
import "./index";

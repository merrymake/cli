#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
process.env["COMMAND"] = "mm";
const node_process_1 = require("node:process");
if (!node_process_1.stdin.isTTY || node_process_1.stdin.setRawMode === undefined) {
    console.log("This console does not support TTY, please use 'winpty mm' instead.");
    process.exit(1);
}
const prompt_1 = require("./prompt");
process.env["UPDATE_MESSAGE"] = `get the latest version from:
${prompt_1.YELLOW}https://github.com/merrymake/cli/releases${prompt_1.NORMAL_COLOR}`;
require("./index");

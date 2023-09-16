#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
process.env["COMMAND"] = "mm";
const node_process_1 = require("node:process");
if (!node_process_1.stdin.isTTY || node_process_1.stdin.setRawMode === undefined) {
    console.log("This console does not support TTY, please use 'winpty mm' instead.");
    process.exit(1);
}
require("./index");

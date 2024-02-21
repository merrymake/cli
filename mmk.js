#!/usr/bin/env winpty node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
process.env["COMMAND"] = "mmk";
const prompt_1 = require("./prompt");
process.env["UPDATE_MESSAGE"] = `to update run the command:
${prompt_1.YELLOW}npm install --global @merrymake/cli@latest${prompt_1.NORMAL_COLOR}`;
require("./index");

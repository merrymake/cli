#!/usr/bin/env node
import { setCommand } from "./mmCommand.js";
setCommand("mm");
import { YELLOW, NORMAL_COLOR } from "./prompt.js";
process.env["UPDATE_MESSAGE"] = `to update run the command:
${YELLOW}npm install --global @merrymake/cli@latest${NORMAL_COLOR}`;
import "./index.js";

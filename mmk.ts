#!/usr/bin/env winpty node
process.env["COMMAND"] = "mmk";
import { YELLOW, NORMAL_COLOR } from "./prompt";
process.env["UPDATE_MESSAGE"] = `to update run the command:
${YELLOW}npm install --global @merrymake/cli@latest${NORMAL_COLOR}`;
import "./index";

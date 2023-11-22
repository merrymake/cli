#!/usr/bin/env winpty node
process.env["COMMAND"] = "mmk";
import { YELLOW, NORMAL_COLOR } from "./prompt";
process.env["UPDATE_MESSAGE"] = `to update run the command:
${YELLOW}npm update -g @merrymake/cli${NORMAL_COLOR}`;
import "./index";

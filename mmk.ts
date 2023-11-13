#!/usr/bin/env winpty node
process.env["COMMAND"] = "mmk";
import { COLOR3, NORMAL_COLOR } from "./prompt";
process.env["UPDATE_MESSAGE"] = `to update run the command:
${COLOR3}npm update -g @merrymake/cli${NORMAL_COLOR}`;
import "./index";

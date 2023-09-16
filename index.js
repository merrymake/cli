"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_process_1 = require("node:process");
const prompt_1 = require("./prompt");
const utils_1 = require("./utils");
const questions_1 = require("./questions");
const args_1 = require("./args");
if (!node_process_1.stdin.isTTY || node_process_1.stdin.setRawMode === undefined) {
    console.log("This console does not support TTY, please use 'winpty mm' or the 'mmk'-command instead.");
    process.exit(1);
}
// TODO make type for command
// if (
//   process.argv[0]
//     .substring(process.argv[0].lastIndexOf(path.sep) + 1)
//     .startsWith("node")
// )
process.argv.splice(0, 1);
process.argv.splice(0, 1);
if (process.argv[0] === "dryrun") {
    (0, utils_1.setDryrun)();
    process.argv.splice(0, 1);
}
(0, args_1.initializeArgs)(process.argv.flatMap((x) => x.startsWith("-")
    ? x
        .substring(1)
        .split("")
        .map((x) => `-${x}`)
    : [x]));
// without this, we would only get streams once enter is pressed
node_process_1.stdin.setRawMode(true);
// resume stdin in the parent process (node app won't quit all by itself
// unless an error or process.exit() happens)
node_process_1.stdin.resume();
// i don't want binary, do you?
node_process_1.stdin.setEncoding("utf8");
// You can always exit with crtl-c
node_process_1.stdin.on("data", (key) => {
    let k = key.toString();
    if (k === prompt_1.CTRL_C) {
        (0, utils_1.abort)();
    }
});
// TODO Change join to invite
// TODO roles
(() => __awaiter(void 0, void 0, void 0, function* () {
    (0, utils_1.checkVersion)();
    let token = yield (0, questions_1.start)();
}))().catch((e) => {
    (0, prompt_1.exit)();
    console.log("\x1b[31mERROR %s\x1b[0m", e);
    process.exit(0);
});

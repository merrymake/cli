"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeArgs = initializeArgs;
exports.getArgs = getArgs;
let args;
function initializeArgs(strs) {
    args = strs;
}
function getArgs() {
    return args;
}

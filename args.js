"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getArgs = exports.initializeArgs = void 0;
let args;
function initializeArgs(strs) {
    args = strs;
}
exports.initializeArgs = initializeArgs;
function getArgs() {
    return args;
}
exports.getArgs = getArgs;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exit = exports.shortText = exports.spinner_stop = exports.spinner_start = exports.choice = exports.INVISIBLE = exports.COLOR3 = exports.COLOR2 = exports.COLOR1 = exports.NORMAL_COLOR = exports.SHOW_CURSOR = exports.HIDE_CURSOR = exports.RIGHT = exports.LEFT = exports.DOWN = exports.UP = exports.ENTER = exports.DELETE = exports.ESCAPE = exports.BACKSPACE = exports.CTRL_C = void 0;
const node_process_1 = require("node:process");
const args_1 = require("./args");
const utils_1 = require("./utils");
exports.CTRL_C = "\u0003";
// const CR = "\u000D";
exports.BACKSPACE = "\b";
exports.ESCAPE = "\u001b";
exports.DELETE = "\u001b[3~";
exports.ENTER = "\r";
exports.UP = "\u001b[A";
exports.DOWN = "\u001b[B";
exports.LEFT = "\u001b[D";
exports.RIGHT = "\u001b[C";
exports.HIDE_CURSOR = "\u001B[?25l";
exports.SHOW_CURSOR = "\u001B[?25h";
exports.NORMAL_COLOR = "\u001B[0m";
exports.COLOR1 = "\u001B[0;31m";
exports.COLOR2 = "\u001B[0;34m";
exports.COLOR3 = "\u001B[0;93m";
exports.INVISIBLE = [
    exports.HIDE_CURSOR,
    exports.SHOW_CURSOR,
    exports.NORMAL_COLOR,
    exports.COLOR1,
    exports.COLOR2,
    exports.COLOR3,
];
let xOffset = 0;
let yOffset = 0;
let maxYOffset = 0;
function output(str) {
    node_process_1.stdout.write(str);
    let cleanStr = str.replace(new RegExp(exports.INVISIBLE.map((x) => x.replace(/\[/, "\\[").replace(/\?/, "\\?")).join("|"), "gi"), "");
    const lines = cleanStr.split("\n");
    const newXOffset = xOffset + lines[0].length;
    // TODO handle (split on) \r
    xOffset = newXOffset % node_process_1.stdout.getWindowSize()[0];
    yOffset += ~~(newXOffset / node_process_1.stdout.getWindowSize()[0]);
    if (maxYOffset < yOffset)
        maxYOffset = yOffset;
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        yOffset += 1 + ~~(line.length / node_process_1.stdout.getWindowSize()[0]);
        if (maxYOffset < yOffset)
            maxYOffset = yOffset;
        xOffset = line.length % node_process_1.stdout.getWindowSize()[0];
    }
    // stdout.moveCursor(-xOffset, -yOffset);
    // let pos = "" + xOffset + "," + yOffset;
    // stdout.write(pos);
    // stdout.moveCursor(xOffset - pos.length, yOffset);
}
function moveCursor(x, y) {
    xOffset += x;
    yOffset += y;
    if (maxYOffset < yOffset)
        maxYOffset = yOffset;
    node_process_1.stdout.moveCursor(x, y);
}
function moveCursorTo(x, y) {
    moveCursor(x - xOffset, y - yOffset);
}
function moveToBottom() {
    moveCursor(-xOffset, maxYOffset - yOffset);
}
function getCursorPosition() {
    return [xOffset, yOffset];
}
let command = "$ " + process.env["COMMAND"];
function makeSelectionInternal(option, extra) {
    moveToBottom();
    cleanup();
    if (option.short !== "x")
        extra();
    if (listener !== undefined)
        node_process_1.stdin.removeListener("data", listener);
    return option.action();
}
function makeSelection(option) {
    return makeSelectionInternal(option, () => {
        output("\n");
        output((command +=
            " " + (option.long.includes(" ") ? `'${option.long}'` : option.long)));
        output("\n");
    });
}
function makeSelectionQuietly(option) {
    return makeSelectionInternal(option, () => {
        command += " " + option.long;
    });
}
let listener;
function cleanup() {
    output(exports.NORMAL_COLOR);
    output(exports.SHOW_CURSOR);
}
function choice(options, invertedQuiet = { cmd: false, select: true }, def = 0) {
    return new Promise((resolve) => {
        let quick = {};
        let str = [];
        if (options.length === 1) {
            if ((0, args_1.getArgs)().length > 0)
                (0, args_1.getArgs)().splice(0, 1);
            resolve(makeSelection(options[0]));
            return;
        }
        options.push({
            short: "x",
            long: "x",
            text: "exit",
            action: () => (0, utils_1.abort)(),
        });
        for (let i = 0; i < options.length; i++) {
            const o = options[i];
            if ((0, args_1.getArgs)()[0] === o.long || (0, args_1.getArgs)()[0] === `-${o.short}`) {
                (0, args_1.getArgs)().splice(0, 1);
                resolve(invertedQuiet.cmd ? makeSelection(o) : makeSelectionQuietly(o));
                return;
            }
            if (o.short)
                quick[o.short] = o;
            str.push("  [");
            str.push(o.short || "_");
            str.push("] ");
            const index = o.text.indexOf(o.long);
            const before = o.text.substring(0, index);
            const after = o.text.substring(index + o.long.length);
            str.push(before);
            str.push(exports.COLOR3);
            str.push(o.long);
            str.push(exports.NORMAL_COLOR);
            str.push(after);
            str.push("\n");
        }
        if ((0, args_1.getArgs)().length > 0) {
            output(`Invalid argument in the current context: ${(0, args_1.getArgs)()[0]}\n`);
            (0, args_1.getArgs)().splice(0, (0, args_1.getArgs)().length);
        }
        output(exports.HIDE_CURSOR);
        output(str.join(""));
        let pos = def;
        output(exports.COLOR3);
        moveCursor(0, -options.length + pos);
        output(`>`);
        moveCursor(-1, 0);
        // on any data into stdin
        node_process_1.stdin.on("data", (listener = (key) => {
            let k = key.toString();
            // moveCursor(0, options.length - pos);
            // //let l = JSON.stringify(key);
            // //output(l);
            // stdout.write("" + yOffset);
            // moveCursor(-("" + yOffset).length, -options.length + pos);
            if (k === exports.ENTER) {
                resolve(invertedQuiet.select
                    ? makeSelection(options[pos])
                    : makeSelectionQuietly(options[pos]));
                return;
            }
            else if (k === exports.UP && pos <= 0) {
                return;
            }
            else if (k === exports.UP) {
                pos--;
                output(` `);
                moveCursor(-1, -1);
                output(`>`);
                moveCursor(-1, 0);
            }
            else if (k === exports.DOWN && pos >= options.length - 1) {
                return;
            }
            else if (k === exports.DOWN) {
                pos++;
                output(` `);
                moveCursor(-1, 1);
                output(`>`);
                moveCursor(-1, 0);
            }
            else if (quick[k] !== undefined) {
                makeSelection(quick[k]);
            }
            // write the key to stdout all normal like
            // output(key);
        }));
    });
}
exports.choice = choice;
let interval;
let spinnerIndex = 0;
const SPINNER = ["│", "/", "─", "\\"];
function spinner_start() {
    interval = setInterval(spin, 200);
}
exports.spinner_start = spinner_start;
function spin() {
    output(SPINNER[(spinnerIndex = (spinnerIndex + 1) % SPINNER.length)]);
    moveCursor(-1, 0);
}
function spinner_stop() {
    if (interval !== undefined) {
        clearInterval(interval);
        interval = undefined;
    }
}
exports.spinner_stop = spinner_stop;
function shortText(prompt, description, defaultValue) {
    return new Promise((resolve) => {
        if ((0, args_1.getArgs)()[0] !== undefined) {
            let result = (0, args_1.getArgs)()[0] === "_" ? defaultValue : (0, args_1.getArgs)()[0];
            (0, args_1.getArgs)().splice(0, 1);
            moveToBottom();
            cleanup();
            if (listener !== undefined)
                node_process_1.stdin.removeListener("data", listener);
            resolve(result);
            return;
        }
        let str = prompt;
        if (defaultValue === "")
            str += ` (optional)`;
        else
            str += ` (default: ${defaultValue})`;
        str += ": ";
        output(str);
        let [prevX, prevY] = getCursorPosition();
        output("\n");
        moveCursorTo(prevX, prevY);
        let beforeCursor = "";
        let afterCursor = "";
        // on any data into stdin
        node_process_1.stdin.on("data", (listener = (key) => {
            let k = key.toString();
            // moveCursor(-str.length, 0);
            // let l = JSON.stringify(key);
            // output(l);
            // output("" + afterCursor.length);
            // moveCursor(str.length - l.length, 0);
            // moveCursor(-l.length, -options.length + pos);
            if (k === exports.ENTER) {
                moveToBottom();
                cleanup();
                let combinedStr = beforeCursor + afterCursor;
                let result = combinedStr.length === 0 ? defaultValue : combinedStr;
                output("\n");
                output((command += " " + (result.length === 0 ? "_" : result)));
                output("\n");
                if (listener !== undefined)
                    node_process_1.stdin.removeListener("data", listener);
                resolve(result);
                return;
            }
            else if (k === exports.UP || k === exports.DOWN) {
            }
            else if (k === exports.ESCAPE) {
                let [prevX, prevY] = getCursorPosition();
                moveCursor(-str.length - beforeCursor.length, 1);
                output(description);
                moveCursorTo(prevX, prevY);
            }
            else if (k === exports.LEFT && beforeCursor.length > 0) {
                moveCursor(-beforeCursor.length, 0);
                afterCursor =
                    beforeCursor.charAt(beforeCursor.length - 1) + afterCursor;
                beforeCursor = beforeCursor.substring(0, beforeCursor.length - 1);
                node_process_1.stdout.clearLine(1);
                output(beforeCursor + afterCursor);
                moveCursor(-afterCursor.length, 0);
            }
            else if (k === exports.RIGHT && afterCursor.length > 0) {
                moveCursor(-beforeCursor.length, 0);
                beforeCursor += afterCursor.charAt(0);
                afterCursor = afterCursor.substring(1);
                node_process_1.stdout.clearLine(1);
                output(beforeCursor + afterCursor);
                moveCursor(-afterCursor.length, 0);
            }
            else if (k === exports.DELETE && afterCursor.length > 0) {
                moveCursor(-beforeCursor.length, 0);
                afterCursor = afterCursor.substring(1);
                node_process_1.stdout.clearLine(1);
                output(beforeCursor + afterCursor);
                moveCursor(-afterCursor.length, 0);
            }
            else if (k === exports.BACKSPACE && beforeCursor.length > 0) {
                moveCursor(-beforeCursor.length, 0);
                beforeCursor = beforeCursor.substring(0, beforeCursor.length - 1);
                node_process_1.stdout.clearLine(1);
                output(beforeCursor + afterCursor);
                moveCursor(-afterCursor.length, 0);
            }
            else if (/^[A-Za-z0-9@_, .-/:;#=&?]$/.test(k)) {
                moveCursor(-beforeCursor.length, 0);
                beforeCursor += k;
                node_process_1.stdout.clearLine(1);
                output(beforeCursor + afterCursor);
                moveCursor(-afterCursor.length, 0);
            }
            // write the key to stdout all normal like
            // output(key);
        }));
    });
}
exports.shortText = shortText;
function exit() {
    moveToBottom();
    cleanup();
}
exports.exit = exit;

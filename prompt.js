"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exit = exports.shortText = exports.Visibility = exports.spinner_stop = exports.spinner_start = exports.multiSelect = exports.choice = exports.output = exports.INVISIBLE = exports.YELLOW = exports.GREEN = exports.BLUE = exports.RED = exports.NORMAL_COLOR = exports.SHOW_CURSOR = exports.HIDE_CURSOR = exports.RIGHT = exports.LEFT = exports.DOWN = exports.UP = exports.ENTER = exports.DELETE = exports.ESCAPE = exports.BACKSPACE = exports.CTRL_C = void 0;
const node_process_1 = require("node:process");
const args_1 = require("./args");
const utils_1 = require("./utils");
const contexts_1 = require("./contexts");
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
exports.RED = "\u001B[0;31m";
exports.BLUE = "\u001B[0;34m";
exports.GREEN = "\u001B[0;32m";
exports.YELLOW = "\u001B[0;93m";
exports.INVISIBLE = [
    exports.HIDE_CURSOR,
    exports.SHOW_CURSOR,
    exports.NORMAL_COLOR,
    exports.RED,
    exports.BLUE,
    exports.GREEN,
    exports.YELLOW,
];
let xOffset = 0;
let yOffset = 0;
let maxYOffset = 0;
function output(str) {
    const cleanStr = str.replace(new RegExp(exports.INVISIBLE.map((x) => x.replace(/\[/, "\\[").replace(/\?/, "\\?")).join("|"), "gi"), "");
    node_process_1.stdout.write(node_process_1.stdout.isTTY ? str : cleanStr);
    if (!node_process_1.stdout.isTTY)
        return;
    const lines = cleanStr.split("\n");
    const newXOffset = xOffset + lines[0].length;
    // TODO handle (split on) \r
    xOffset =
        newXOffset %
            (typeof node_process_1.stdout.getWindowSize !== "function"
                ? 80
                : node_process_1.stdout.getWindowSize()[0]);
    yOffset += ~~(newXOffset /
        (typeof node_process_1.stdout.getWindowSize !== "function"
            ? 80
            : node_process_1.stdout.getWindowSize()[0]));
    if (maxYOffset < yOffset)
        maxYOffset = yOffset;
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        yOffset +=
            1 +
                ~~(line.length /
                    (typeof node_process_1.stdout.getWindowSize !== "function"
                        ? 80
                        : node_process_1.stdout.getWindowSize()[0]));
        if (maxYOffset < yOffset)
            maxYOffset = yOffset;
        xOffset =
            line.length %
                (typeof node_process_1.stdout.getWindowSize !== "function"
                    ? 80
                    : node_process_1.stdout.getWindowSize()[0]);
    }
    // stdout.moveCursor(-xOffset, -yOffset);
    // const pos = "" + xOffset + "," + yOffset;
    // stdout.write(pos);
    // stdout.moveCursor(xOffset - pos.length, yOffset);
}
exports.output = output;
function moveCursor(x, y) {
    if (!node_process_1.stdout.isTTY)
        return;
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
let hasSecret = false;
function makeSelectionSuperInternal(action, extra = () => { }) {
    moveToBottom();
    cleanup();
    extra();
    if (listener !== undefined)
        node_process_1.stdin.removeListener("data", listener);
    return action();
}
function makeSelectionInternal(option, extra) {
    return makeSelectionSuperInternal(() => option.action(), option.short !== "x" ? extra : () => { });
}
function makeSelection(option) {
    return makeSelectionInternal(option, () => {
        if (hasSecret === false) {
            output("\n");
            output((command +=
                " " + (option.long.includes(" ") ? `'${option.long}'` : option.long)));
        }
        output("\n");
    });
}
function makeSelectionQuietly(option) {
    return makeSelectionInternal(option, () => {
        if (hasSecret === false) {
            command +=
                " " + (option.long.includes(" ") ? `'${option.long}'` : option.long);
        }
    });
}
let listener;
function cleanup() {
    output(exports.NORMAL_COLOR);
    output(exports.SHOW_CURSOR);
}
function choice(heading, options, opts) {
    return new Promise((resolve) => {
        var _a, _b, _c;
        if (options.length === 0) {
            console.log((opts === null || opts === void 0 ? void 0 : opts.errorMessage) || "There are no options.");
            process.exit(1);
        }
        if (options.length === 1 && (opts === null || opts === void 0 ? void 0 : opts.disableAutoPick) !== true) {
            if ((0, args_1.getArgs)().length > 0 &&
                ((0, args_1.getArgs)()[0] === options[0].long ||
                    (0, args_1.getArgs)()[0] === `-${options[0].short}`))
                (0, args_1.getArgs)().splice(0, 1);
            resolve(((_a = opts === null || opts === void 0 ? void 0 : opts.invertedQuiet) === null || _a === void 0 ? void 0 : _a.cmd) === true
                ? makeSelection(options[0])
                : makeSelectionQuietly(options[0]));
            return;
        }
        options.push({
            short: "x",
            long: "x",
            text: "exit",
            action: () => (0, utils_1.abort)(),
        });
        const quick = {};
        const str = [heading + "\n"];
        for (let i = 0; i < options.length; i++) {
            const o = options[i];
            if ((0, args_1.getArgs)()[0] === o.long || (0, args_1.getArgs)()[0] === `-${o.short}`) {
                (0, args_1.getArgs)().splice(0, 1);
                resolve(((_b = opts === null || opts === void 0 ? void 0 : opts.invertedQuiet) === null || _b === void 0 ? void 0 : _b.cmd) === true
                    ? makeSelection(o)
                    : makeSelectionQuietly(o));
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
            str.push(exports.YELLOW);
            str.push(o.long);
            str.push(exports.NORMAL_COLOR);
            str.push(after);
            str.push("\n");
        }
        let pos = (opts === null || opts === void 0 ? void 0 : opts.def) || 0;
        if ((0, args_1.getArgs)().length > 0) {
            const arg = (0, args_1.getArgs)().splice(0, 1)[0];
            if (arg === "_") {
                resolve(((_c = opts === null || opts === void 0 ? void 0 : opts.invertedQuiet) === null || _c === void 0 ? void 0 : _c.cmd) === true
                    ? makeSelection(options[pos])
                    : makeSelectionQuietly(options[pos]));
                return;
            }
            else if (contexts_1.CONTEXTS[arg] !== undefined)
                output(contexts_1.CONTEXTS[arg](arg) + "\n");
            else
                output(`${exports.RED}Invalid argument in the current context: ${arg}${exports.NORMAL_COLOR}\n`);
            (0, args_1.getArgs)().splice(0, (0, args_1.getArgs)().length);
        }
        output(" \n");
        output(exports.HIDE_CURSOR);
        output(str.join(""));
        if (!node_process_1.stdin.isTTY || node_process_1.stdin.setRawMode === undefined) {
            console.log("This console does not support TTY, please use the 'mmk'-command instead.");
            process.exit(1);
        }
        output(exports.YELLOW);
        moveCursor(0, -options.length + pos);
        output(`>`);
        moveCursor(-1, 0);
        // on any data into stdin
        node_process_1.stdin.on("data", (listener = (key) => {
            var _a;
            const k = key.toString();
            // moveCursor(0, options.length - pos);
            // //let l = JSON.stringify(key);
            // //output(l);
            // stdout.write("" + yOffset);
            // moveCursor(-("" + yOffset).length, -options.length + pos);
            if (k === exports.ENTER) {
                resolve(((_a = opts === null || opts === void 0 ? void 0 : opts.invertedQuiet) === null || _a === void 0 ? void 0 : _a.cmd) !== false
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
const SELECTED_MARK = "✔";
const NOT_SELECTED_MARK = "_";
function multiSelect(selection, after, errorMessage) {
    return new Promise((resolve) => {
        // options.push({
        //   short: "x",
        //   long: "x",
        //   text: "exit",
        //   action: () => abort(),
        // });
        const keys = Object.keys(selection);
        if (keys.length === 0) {
            console.log(errorMessage);
            process.exit(1);
        }
        if ((0, args_1.getArgs)().length > 0) {
            const arg = (0, args_1.getArgs)()[0];
            const es = arg.split(",");
            const result = {};
            keys.forEach((e) => (result[e] = false));
            const illegal = es.filter((e) => !keys.includes(e));
            if (illegal.length > 0) {
                output(`${exports.RED}Invalid arguments in the current context: ${illegal.join(", ")}${exports.NORMAL_COLOR}\n`);
            }
            else {
                es.forEach((e) => (result[e] = true));
            }
            (0, args_1.getArgs)().splice(0, (0, args_1.getArgs)().length);
            resolve(makeSelectionSuperInternal(() => after(selection)));
            return;
        }
        const str = [];
        for (let i = 0; i < keys.length; i++) {
            str.push("  ");
            str.push(selection[keys[i]] === true ? SELECTED_MARK : NOT_SELECTED_MARK);
            str.push(" ");
            str.push(keys[i]);
            str.push("\n");
        }
        // Add submit and exit
        str.push(`  [s] submit\n`);
        str.push(`  [x] exit\n`);
        output(" \n");
        output(exports.HIDE_CURSOR);
        output(str.join(""));
        if (!node_process_1.stdin.isTTY || node_process_1.stdin.setRawMode === undefined) {
            console.log("This console does not support TTY, please use the 'mmk'-command instead.");
            process.exit(1);
        }
        let pos = 0;
        output(exports.YELLOW);
        moveCursor(0, -(keys.length + 2) + pos);
        output(`>`);
        moveCursor(-1, 0);
        // on any data into stdin
        node_process_1.stdin.on("data", (listener = (key) => {
            const k = key.toString();
            // moveCursor(0, options.length - pos);
            // //let l = JSON.stringify(key);
            // //output(l);
            // stdout.write("" + yOffset);
            // moveCursor(-("" + yOffset).length, -options.length + pos);
            if (k === exports.ENTER) {
                if (pos === keys.length) {
                    // Submit
                    const selected = keys
                        .filter((x) => selection[x] === true)
                        .join(",");
                    resolve(makeSelectionSuperInternal(() => after(selection), () => {
                        output("\n");
                        output((command +=
                            " " +
                                (selected.includes(" ") || selected.length === 0
                                    ? `'${selected}'`
                                    : selected)));
                        output("\n");
                    }));
                }
                else if (pos > keys.length) {
                    // Exit
                    resolve(makeSelectionQuietly({
                        short: "x",
                        long: "x",
                        text: "exit",
                        action: () => (0, utils_1.abort)(),
                    }));
                }
                else {
                    const sel = (selection[keys[pos]] = !selection[keys[pos]]);
                    moveCursor(2, 0);
                    output(exports.NORMAL_COLOR);
                    output(sel ? SELECTED_MARK : NOT_SELECTED_MARK);
                    output(exports.YELLOW);
                    moveCursor(-3, 0);
                }
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
            else if (k === exports.DOWN && pos >= keys.length + 2 - 1) {
                return;
            }
            else if (k === exports.DOWN) {
                pos++;
                output(` `);
                moveCursor(-1, 1);
                output(`>`);
                moveCursor(-1, 0);
            }
            else if (k === "x") {
                makeSelectionQuietly({
                    short: "x",
                    long: "x",
                    text: "exit",
                    action: () => (0, utils_1.abort)(),
                });
            }
            else if (k === "s") {
                const selected = keys.filter((x) => selection[x] === true).join(",");
                resolve(makeSelectionSuperInternal(() => after(selection), () => {
                    output("\n");
                    output((command +=
                        " " +
                            (selected.includes(" ") || selected.length === 0
                                ? `'${selected}'`
                                : selected)));
                    output("\n");
                }));
            }
            // write the key to stdout all normal like
            // output(key);
        }));
    });
}
exports.multiSelect = multiSelect;
let interval;
let spinnerIndex = 0;
const SPINNER = ["│", "/", "─", "\\"];
function spinner_start() {
    if (!node_process_1.stdout.isTTY)
        return;
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
var Visibility;
(function (Visibility) {
    Visibility[Visibility["Secret"] = 0] = "Secret";
    Visibility[Visibility["Public"] = 1] = "Public";
})(Visibility || (exports.Visibility = Visibility = {}));
function shortText(prompt, description, defaultValueArg, hide = Visibility.Public) {
    return new Promise((resolve) => {
        if (hide === Visibility.Secret)
            hasSecret = true;
        const defaultValue = defaultValueArg === null ? "" : defaultValueArg;
        if ((0, args_1.getArgs)()[0] !== undefined) {
            const result = (0, args_1.getArgs)()[0] === "_" ? defaultValue : (0, args_1.getArgs)()[0];
            command +=
                " " +
                    (result.includes(" ")
                        ? `'${result}'`
                        : result.length === 0
                            ? "_"
                            : result);
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
            str += ` (${exports.YELLOW}optional${exports.NORMAL_COLOR})`;
        else
            str += ` (suggestion: ${exports.YELLOW}${defaultValue}${exports.NORMAL_COLOR})`;
        str += ": ";
        output(" \n");
        output(str);
        const [prevX, prevY] = getCursorPosition();
        output("\n");
        moveCursorTo(prevX, prevY);
        if (!node_process_1.stdin.isTTY || node_process_1.stdin.setRawMode === undefined) {
            console.log("This console does not support TTY, please use the 'mmk'-command instead.");
            process.exit(1);
        }
        let beforeCursor = "";
        let afterCursor = "";
        // on any data into stdin
        node_process_1.stdin.on("data", (listener = (key) => {
            const k = key.toString();
            // moveCursor(-str.length, 0);
            // const l = JSON.stringify(key);
            // output(l);
            // output("" + afterCursor.length);
            // moveCursor(str.length - l.length, 0);
            // moveCursor(-l.length, -options.length + pos);
            if (k === exports.ENTER) {
                moveToBottom();
                cleanup();
                const combinedStr = beforeCursor + afterCursor;
                const result = combinedStr.length === 0 ? defaultValue : combinedStr;
                if (hasSecret === false) {
                    output("\n");
                    output((command +=
                        " " +
                            (result.length === 0
                                ? "_"
                                : result.includes(" ")
                                    ? `'${result}'`
                                    : result)));
                }
                output("\n");
                if (listener !== undefined)
                    node_process_1.stdin.removeListener("data", listener);
                resolve(result);
                return;
            }
            else if (k === exports.UP || k === exports.DOWN) {
            }
            else if (k === exports.ESCAPE) {
                const [prevX, prevY] = getCursorPosition();
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
                output(hide === Visibility.Secret
                    ? (beforeCursor + afterCursor).replace(/./g, "*")
                    : beforeCursor + afterCursor);
                moveCursor(-afterCursor.length, 0);
            }
            else if (k === exports.RIGHT && afterCursor.length > 0) {
                moveCursor(-beforeCursor.length, 0);
                beforeCursor += afterCursor.charAt(0);
                afterCursor = afterCursor.substring(1);
                node_process_1.stdout.clearLine(1);
                output(hide === Visibility.Secret
                    ? (beforeCursor + afterCursor).replace(/./g, "*")
                    : beforeCursor + afterCursor);
                moveCursor(-afterCursor.length, 0);
            }
            else if (k === exports.DELETE && afterCursor.length > 0) {
                moveCursor(-beforeCursor.length, 0);
                afterCursor = afterCursor.substring(1);
                node_process_1.stdout.clearLine(1);
                output(hide === Visibility.Secret
                    ? (beforeCursor + afterCursor).replace(/./g, "*")
                    : beforeCursor + afterCursor);
                moveCursor(-afterCursor.length, 0);
            }
            else if ((k === exports.BACKSPACE ||
                k.charCodeAt(0) === 8 ||
                k.charCodeAt(0) === 127) &&
                beforeCursor.length > 0) {
                moveCursor(-beforeCursor.length, 0);
                beforeCursor = beforeCursor.substring(0, beforeCursor.length - 1);
                node_process_1.stdout.clearLine(1);
                output(hide === Visibility.Secret
                    ? (beforeCursor + afterCursor).replace(/./g, "*")
                    : beforeCursor + afterCursor);
                moveCursor(-afterCursor.length, 0);
            }
            else if (/^[A-Za-z0-9@_, .\-/:;#=&*?!"'`^%£$€+<>()\[\]{}\\]+$/.test(k)) {
                moveCursor(-beforeCursor.length, 0);
                beforeCursor += k;
                node_process_1.stdout.clearLine(1);
                output(hide === Visibility.Secret
                    ? (beforeCursor + afterCursor).replace(/./g, "*")
                    : beforeCursor + afterCursor);
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

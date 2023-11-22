import { stdin, stdout } from "node:process";
import { getArgs } from "./args";
import { abort } from "./utils";

export const CTRL_C = "\u0003";
// const CR = "\u000D";
export const BACKSPACE = "\b";
export const ESCAPE = "\u001b";
export const DELETE = "\u001b[3~";
export const ENTER = "\r";
export const UP = "\u001b[A";
export const DOWN = "\u001b[B";
export const LEFT = "\u001b[D";
export const RIGHT = "\u001b[C";
export const HIDE_CURSOR = "\u001B[?25l";
export const SHOW_CURSOR = "\u001B[?25h";
export const NORMAL_COLOR = "\u001B[0m";
export const RED = "\u001B[0;31m";
export const BLUE = "\u001B[0;34m";
export const GREEN = "\u001B[0;32m";
export const YELLOW = "\u001B[0;93m";
export const INVISIBLE = [
  HIDE_CURSOR,
  SHOW_CURSOR,
  NORMAL_COLOR,
  RED,
  BLUE,
  YELLOW,
];

let xOffset = 0;
let yOffset = 0;
let maxYOffset = 0;
function output(str: string) {
  stdout.write(str);
  let cleanStr = str.replace(
    new RegExp(
      INVISIBLE.map((x) => x.replace(/\[/, "\\[").replace(/\?/, "\\?")).join(
        "|"
      ),
      "gi"
    ),
    ""
  );
  const lines = cleanStr.split("\n");
  const newXOffset = xOffset + lines[0].length;
  // TODO handle (split on) \r
  xOffset = newXOffset % stdout.getWindowSize()[0];
  yOffset += ~~(newXOffset / stdout.getWindowSize()[0]);
  if (maxYOffset < yOffset) maxYOffset = yOffset;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    yOffset += 1 + ~~(line.length / stdout.getWindowSize()[0]);
    if (maxYOffset < yOffset) maxYOffset = yOffset;
    xOffset = line.length % stdout.getWindowSize()[0];
  }
  // stdout.moveCursor(-xOffset, -yOffset);
  // let pos = "" + xOffset + "," + yOffset;
  // stdout.write(pos);
  // stdout.moveCursor(xOffset - pos.length, yOffset);
}

function moveCursor(x: number, y: number) {
  xOffset += x;
  yOffset += y;
  if (maxYOffset < yOffset) maxYOffset = yOffset;
  stdout.moveCursor(x, y);
}

function moveCursorTo(x: number, y: number) {
  moveCursor(x - xOffset, y - yOffset);
}

function moveToBottom() {
  moveCursor(-xOffset, maxYOffset - yOffset);
}

function getCursorPosition() {
  return [xOffset, yOffset];
}

let command = "$ " + process.env["COMMAND"];

function makeSelectionInternal(option: Option, extra: () => void) {
  moveToBottom();
  cleanup();
  if (option.short !== "x") extra();
  if (listener !== undefined) stdin.removeListener("data", listener);
  return option.action();
}
function makeSelection(option: Option) {
  return makeSelectionInternal(option, () => {
    output("\n");
    output(
      (command +=
        " " + (option.long.includes(" ") ? `'${option.long}'` : option.long))
    );
    output("\n");
  });
}
function makeSelectionQuietly(option: Option) {
  return makeSelectionInternal(option, () => {
    command +=
      " " + (option.long.includes(" ") ? `'${option.long}'` : option.long);
  });
}

let listener: (_: Buffer) => void;

function cleanup() {
  output(NORMAL_COLOR);
  output(SHOW_CURSOR);
}

export type Option = {
  long: string;
  short?: string;
  text: string;
  action: () => Promise<never>;
};

export function choice(
  options: Option[],
  invertedQuiet = { cmd: false, select: true },
  def: number = 0
) {
  return new Promise<never>((resolve) => {
    let quick: { [key: string]: Option } = {};
    let str: string[] = [];
    if (options.length === 1) {
      if (getArgs().length > 0) getArgs().splice(0, 1);
      resolve(makeSelection(options[0]));
      return;
    }
    options.push({
      short: "x",
      long: "x",
      text: "exit",
      action: () => abort(),
    });
    for (let i = 0; i < options.length; i++) {
      const o = options[i];
      if (getArgs()[0] === o.long || getArgs()[0] === `-${o.short}`) {
        getArgs().splice(0, 1);
        resolve(invertedQuiet.cmd ? makeSelection(o) : makeSelectionQuietly(o));
        return;
      }
      if (o.short) quick[o.short] = o;
      str.push("  [");
      str.push(o.short || "_");
      str.push("] ");
      const index = o.text.indexOf(o.long);
      const before = o.text.substring(0, index);
      const after = o.text.substring(index + o.long.length);
      str.push(before);
      str.push(YELLOW);
      str.push(o.long);
      str.push(NORMAL_COLOR);
      str.push(after);
      str.push("\n");
    }
    if (getArgs().length > 0) {
      output(`Invalid argument in the current context: ${getArgs()[0]}\n`);
      getArgs().splice(0, getArgs().length);
    }

    output(HIDE_CURSOR);
    output(str.join(""));

    let pos = def;
    output(YELLOW);
    moveCursor(0, -options.length + pos);
    output(`>`);
    moveCursor(-1, 0);

    // on any data into stdin
    stdin.on(
      "data",
      (listener = (key) => {
        let k = key.toString();
        // moveCursor(0, options.length - pos);
        // //let l = JSON.stringify(key);
        // //output(l);
        // stdout.write("" + yOffset);
        // moveCursor(-("" + yOffset).length, -options.length + pos);
        if (k === ENTER) {
          resolve(
            invertedQuiet.select
              ? makeSelection(options[pos])
              : makeSelectionQuietly(options[pos])
          );
          return;
        } else if (k === UP && pos <= 0) {
          return;
        } else if (k === UP) {
          pos--;
          output(` `);
          moveCursor(-1, -1);
          output(`>`);
          moveCursor(-1, 0);
        } else if (k === DOWN && pos >= options.length - 1) {
          return;
        } else if (k === DOWN) {
          pos++;
          output(` `);
          moveCursor(-1, 1);
          output(`>`);
          moveCursor(-1, 0);
        } else if (quick[k] !== undefined) {
          makeSelection(quick[k]);
        }
        // write the key to stdout all normal like
        // output(key);
      })
    );
  });
}

let interval: NodeJS.Timer | undefined;
let spinnerIndex = 0;
const SPINNER = ["│", "/", "─", "\\"];
export function spinner_start() {
  interval = setInterval(spin, 200);
}
function spin() {
  output(SPINNER[(spinnerIndex = (spinnerIndex + 1) % SPINNER.length)]);
  moveCursor(-1, 0);
}
export function spinner_stop() {
  if (interval !== undefined) {
    clearInterval(interval);
    interval = undefined;
  }
}

export function shortText(
  prompt: string,
  description: string,
  defaultValue: string
) {
  return new Promise<string>((resolve) => {
    if (getArgs()[0] !== undefined) {
      let result = getArgs()[0] === "_" ? defaultValue : getArgs()[0];
      command += " " + (result.includes(" ") ? `'${result}'` : result);
      getArgs().splice(0, 1);
      moveToBottom();
      cleanup();
      if (listener !== undefined) stdin.removeListener("data", listener);
      resolve(result);
      return;
    }

    let str = prompt;
    if (defaultValue === "") str += ` (optional)`;
    else str += ` (default: ${defaultValue})`;
    str += ": ";
    output(str);
    let [prevX, prevY] = getCursorPosition();
    output("\n");
    moveCursorTo(prevX, prevY);

    let beforeCursor = "";
    let afterCursor = "";
    // on any data into stdin
    stdin.on(
      "data",
      (listener = (key) => {
        let k = key.toString();
        // moveCursor(-str.length, 0);
        // let l = JSON.stringify(key);
        // output(l);
        // output("" + afterCursor.length);
        // moveCursor(str.length - l.length, 0);
        // moveCursor(-l.length, -options.length + pos);
        if (k === ENTER) {
          moveToBottom();
          cleanup();
          let combinedStr = beforeCursor + afterCursor;
          let result = combinedStr.length === 0 ? defaultValue : combinedStr;
          output("\n");
          output(
            (command +=
              " " +
              (result.length === 0
                ? "_"
                : result.includes(" ")
                ? `'${result}'`
                : result))
          );
          output("\n");
          if (listener !== undefined) stdin.removeListener("data", listener);
          resolve(result);
          return;
        } else if (k === UP || k === DOWN) {
        } else if (k === ESCAPE) {
          let [prevX, prevY] = getCursorPosition();
          moveCursor(-str.length - beforeCursor.length, 1);
          output(description);
          moveCursorTo(prevX, prevY);
        } else if (k === LEFT && beforeCursor.length > 0) {
          moveCursor(-beforeCursor.length, 0);
          afterCursor =
            beforeCursor.charAt(beforeCursor.length - 1) + afterCursor;
          beforeCursor = beforeCursor.substring(0, beforeCursor.length - 1);
          stdout.clearLine(1);
          output(beforeCursor + afterCursor);
          moveCursor(-afterCursor.length, 0);
        } else if (k === RIGHT && afterCursor.length > 0) {
          moveCursor(-beforeCursor.length, 0);
          beforeCursor += afterCursor.charAt(0);
          afterCursor = afterCursor.substring(1);
          stdout.clearLine(1);
          output(beforeCursor + afterCursor);
          moveCursor(-afterCursor.length, 0);
        } else if (k === DELETE && afterCursor.length > 0) {
          moveCursor(-beforeCursor.length, 0);
          afterCursor = afterCursor.substring(1);
          stdout.clearLine(1);
          output(beforeCursor + afterCursor);
          moveCursor(-afterCursor.length, 0);
        } else if (k === BACKSPACE && beforeCursor.length > 0) {
          moveCursor(-beforeCursor.length, 0);
          beforeCursor = beforeCursor.substring(0, beforeCursor.length - 1);
          stdout.clearLine(1);
          output(beforeCursor + afterCursor);
          moveCursor(-afterCursor.length, 0);
        } else if (/^[A-Za-z0-9@_, .-/:;#=&*?]+$/.test(k)) {
          moveCursor(-beforeCursor.length, 0);
          beforeCursor += k;
          stdout.clearLine(1);
          output(beforeCursor + afterCursor);
          moveCursor(-afterCursor.length, 0);
        }
        // write the key to stdout all normal like
        // output(key);
      })
    );
  });
}

export function exit() {
  moveToBottom();
  cleanup();
}

import { stdin, stdout } from "node:process";
import { getArgs } from "./args";
import { abort } from "./utils";
import { CONTEXTS } from "./contexts";

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
  GREEN,
  YELLOW,
];

let xOffset = 0;
let yOffset = 0;
let maxYOffset = 0;
export function output(str: string) {
  let cleanStr = str.replace(
    new RegExp(
      INVISIBLE.map((x) => x.replace(/\[/, "\\[").replace(/\?/, "\\?")).join(
        "|"
      ),
      "gi"
    ),
    ""
  );
  stdout.write(stdout.isTTY ? str : cleanStr);
  if (!stdout.isTTY) return;
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
  if (!stdout.isTTY) return;
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
let hasSecret = false;

function makeSelectionSuperInternal(
  action: () => Promise<never>,
  extra: () => void = () => {}
) {
  moveToBottom();
  cleanup();
  extra();
  if (listener !== undefined) stdin.removeListener("data", listener);
  return action();
}
function makeSelectionInternal(option: Option, extra: () => void) {
  return makeSelectionSuperInternal(
    () => option.action(),
    option.short !== "x" ? extra : () => {}
  );
}
function makeSelection(option: Option) {
  return makeSelectionInternal(option, () => {
    if (hasSecret === false) {
      output("\n");
      output(
        (command +=
          " " + (option.long.includes(" ") ? `'${option.long}'` : option.long))
      );
    }
    output("\n");
  });
}
function makeSelectionQuietly(option: Option) {
  return makeSelectionInternal(option, () => {
    if (hasSecret === false) {
      command +=
        " " + (option.long.includes(" ") ? `'${option.long}'` : option.long);
    }
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
  heading: string,
  options: Option[],
  opts?: {
    def?: number;
    disableAutoPick?: boolean;
    invertedQuiet?: { cmd: boolean; select: boolean };
    errorMessage?: string;
  }
) {
  return new Promise<never>((resolve) => {
    if (options.length === 0) {
      console.log(opts?.errorMessage || "There are no options.");
      process.exit(1);
    }
    if (options.length === 1 && opts?.disableAutoPick !== true) {
      if (getArgs().length > 0) getArgs().splice(0, 1);
      resolve(
        opts?.invertedQuiet?.cmd === true
          ? makeSelection(options[0])
          : makeSelectionQuietly(options[0])
      );
      return;
    }
    options.push({
      short: "x",
      long: "x",
      text: "exit",
      action: () => abort(),
    });
    let quick: { [key: string]: Option } = {};
    let str: string[] = [heading + "\n"];
    for (let i = 0; i < options.length; i++) {
      const o = options[i];
      if (getArgs()[0] === o.long || getArgs()[0] === `-${o.short}`) {
        getArgs().splice(0, 1);
        resolve(
          opts?.invertedQuiet?.cmd === true
            ? makeSelection(o)
            : makeSelectionQuietly(o)
        );
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
    let pos = opts?.def || 0;
    if (getArgs().length > 0) {
      let arg = getArgs().splice(0, 1)[0];
      if (arg === "_") {
        resolve(
          opts?.invertedQuiet?.cmd === true
            ? makeSelection(options[pos])
            : makeSelectionQuietly(options[pos])
        );
        return;
      } else if (CONTEXTS[arg] !== undefined) output(CONTEXTS[arg](arg) + "\n");
      else output(`Invalid argument in the current context: ${arg}\n`);
      getArgs().splice(0, getArgs().length);
    }

    output(HIDE_CURSOR);
    output(str.join(""));

    if (!stdin.isTTY || stdin.setRawMode === undefined) {
      console.log(
        "This console does not support TTY, please use the 'mmk'-command instead."
      );
      process.exit(1);
    }

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
            opts?.invertedQuiet?.cmd !== false
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

const SELECTED_MARK = "✔";
const NOT_SELECTED_MARK = "_";

export function multiSelect(
  selection: { [key: string]: boolean },
  after: (selection: { [key: string]: boolean }) => Promise<never>,
  errorMessage?: string
) {
  return new Promise<never>((resolve) => {
    // options.push({
    //   short: "x",
    //   long: "x",
    //   text: "exit",
    //   action: () => abort(),
    // });
    let keys = Object.keys(selection);
    if (keys.length === 0) {
      console.log(errorMessage);
      process.exit(1);
    }
    if (getArgs().length > 0) {
      let arg = getArgs()[0];
      let es = arg.split(",");
      let result: { [key: string]: boolean } = {};
      keys.forEach((e) => (result[e] = false));
      let illegal = es.filter((e) => !keys.includes(e));
      if (illegal.length > 0) {
        output(
          `Invalid arguments in the current context: ${illegal.join(", ")}\n`
        );
      } else {
        es.forEach((e) => (result[e] = true));
      }
      getArgs().splice(0, getArgs().length);
      resolve(makeSelectionSuperInternal(() => after(selection)));
      return;
    }
    let str: string[] = [];
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

    output(HIDE_CURSOR);
    output(str.join(""));

    if (!stdin.isTTY || stdin.setRawMode === undefined) {
      console.log(
        "This console does not support TTY, please use the 'mmk'-command instead."
      );
      process.exit(1);
    }

    let pos = 0;
    output(YELLOW);
    moveCursor(0, -(keys.length + 2) + pos);
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
          if (pos === keys.length) {
            // Submit
            let selected = keys.filter((x) => selection[x] === true).join(",");
            resolve(
              makeSelectionSuperInternal(
                () => after(selection),
                () => {
                  output("\n");
                  output(
                    (command +=
                      " " +
                      (selected.includes(" ") || selected.length === 0
                        ? `'${selected}'`
                        : selected))
                  );
                  output("\n");
                }
              )
            );
          } else if (pos > keys.length) {
            // Exit
            resolve(
              makeSelectionQuietly({
                short: "x",
                long: "x",
                text: "exit",
                action: () => abort(),
              })
            );
          } else {
            let sel = (selection[keys[pos]] = !selection[keys[pos]]);
            moveCursor(2, 0);
            output(NORMAL_COLOR);
            output(sel ? SELECTED_MARK : NOT_SELECTED_MARK);
            output(YELLOW);
            moveCursor(-3, 0);
          }
          return;
        } else if (k === UP && pos <= 0) {
          return;
        } else if (k === UP) {
          pos--;
          output(` `);
          moveCursor(-1, -1);
          output(`>`);
          moveCursor(-1, 0);
        } else if (k === DOWN && pos >= keys.length + 2 - 1) {
          return;
        } else if (k === DOWN) {
          pos++;
          output(` `);
          moveCursor(-1, 1);
          output(`>`);
          moveCursor(-1, 0);
        } else if (k === "x") {
          makeSelectionQuietly({
            short: "x",
            long: "x",
            text: "exit",
            action: () => abort(),
          });
        } else if (k === "s") {
          let selected = keys.filter((x) => selection[x] === true).join(",");
          resolve(
            makeSelectionSuperInternal(
              () => after(selection),
              () => {
                output("\n");
                output(
                  (command +=
                    " " +
                    (selected.includes(" ") || selected.length === 0
                      ? `'${selected}'`
                      : selected))
                );
                output("\n");
              }
            )
          );
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
  if (!stdout.isTTY) return;
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

export enum Visibility {
  Secret,
  Public,
}
export function shortText(
  prompt: string,
  description: string,
  defaultValueArg: string | null,
  hide = Visibility.Public
) {
  return new Promise<string>((resolve) => {
    if (hide === Visibility.Secret) hasSecret = true;
    let defaultValue = defaultValueArg === null ? "" : defaultValueArg;
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
    if (defaultValue === "") str += ` (${YELLOW}optional${NORMAL_COLOR})`;
    else str += ` (default: ${YELLOW}${defaultValue}${NORMAL_COLOR})`;
    str += ": ";
    output(str);
    let [prevX, prevY] = getCursorPosition();
    output("\n");
    moveCursorTo(prevX, prevY);

    if (!stdin.isTTY || stdin.setRawMode === undefined) {
      console.log(
        "This console does not support TTY, please use the 'mmk'-command instead."
      );
      process.exit(1);
    }

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
          if (hasSecret === false) {
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
          }
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
          output(
            hide === Visibility.Secret
              ? (beforeCursor + afterCursor).replace(/./g, "*")
              : beforeCursor + afterCursor
          );
          moveCursor(-afterCursor.length, 0);
        } else if (k === RIGHT && afterCursor.length > 0) {
          moveCursor(-beforeCursor.length, 0);
          beforeCursor += afterCursor.charAt(0);
          afterCursor = afterCursor.substring(1);
          stdout.clearLine(1);
          output(
            hide === Visibility.Secret
              ? (beforeCursor + afterCursor).replace(/./g, "*")
              : beforeCursor + afterCursor
          );
          moveCursor(-afterCursor.length, 0);
        } else if (k === DELETE && afterCursor.length > 0) {
          moveCursor(-beforeCursor.length, 0);
          afterCursor = afterCursor.substring(1);
          stdout.clearLine(1);
          output(
            hide === Visibility.Secret
              ? (beforeCursor + afterCursor).replace(/./g, "*")
              : beforeCursor + afterCursor
          );
          moveCursor(-afterCursor.length, 0);
        } else if (
          (k === BACKSPACE ||
            k.charCodeAt(0) === 8 ||
            k.charCodeAt(0) === 127) &&
          beforeCursor.length > 0
        ) {
          moveCursor(-beforeCursor.length, 0);
          beforeCursor = beforeCursor.substring(0, beforeCursor.length - 1);
          stdout.clearLine(1);
          output(
            hide === Visibility.Secret
              ? (beforeCursor + afterCursor).replace(/./g, "*")
              : beforeCursor + afterCursor
          );
          moveCursor(-afterCursor.length, 0);
        } else if (
          /^[A-Za-z0-9@_, .\-/:;#=&*?!"'`%£$€+<>()\[\]{}\\]+$/.test(k)
        ) {
          moveCursor(-beforeCursor.length, 0);
          beforeCursor += k;
          stdout.clearLine(1);
          output(
            hide === Visibility.Secret
              ? (beforeCursor + afterCursor).replace(/./g, "*")
              : beforeCursor + afterCursor
          );
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

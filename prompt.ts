import { stdin, stdout } from "node:process";
import { getArgs } from "./args.js";
import { CONTEXTS } from "./contexts.js";
import { abort } from "./utils.js";

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

export const BLACK = "\x1b[30m";
export const RED = "\x1b[31m";
export const GREEN = "\x1b[32m";
export const YELLOW = "\x1b[33m";
export const BLUE = "\x1b[34m";
export const PURPLE = "\x1b[35m";
export const CYAN = "\x1b[36m";
export const WHITE = "\x1b[37m";
export const GRAY = "\x1b[90m";

export const BgBlack = "\x1b[40m";
export const BgRed = "\x1b[41m";
export const BgGreen = "\x1b[42m";
export const BgYellow = "\x1b[43m";
export const BgBlue = "\x1b[44m";
export const BgPurple = "\x1b[45m";
export const BgCyan = "\x1b[46m";
export const BgWhite = "\x1b[47m";
export const BgGray = "\x1b[100m";

export const STRIKE = "\x1b[9m";
export const NOSTRIKE = "\x1b[29m";

export const INVISIBLE = [
  HIDE_CURSOR,
  SHOW_CURSOR,
  NORMAL_COLOR,
  BLACK,
  RED,
  GREEN,
  YELLOW,
  BLUE,
  PURPLE,
  CYAN,
  WHITE,
  GRAY,
  BgBlack,
  BgRed,
  BgGreen,
  BgYellow,
  BgBlue,
  BgPurple,
  BgCyan,
  BgWhite,
  BgGray,
  STRIKE,
  NOSTRIKE,
];

export const REMOVE_INVISIBLE = new RegExp(
  INVISIBLE.map((x) => x.replace(/\[/, "\\[").replace(/\?/, "\\?")).join("|"),
  "gi"
);

let xOffset = 0;
let yOffset = 0;
let maxYOffset = 0;
export function output(str: string) {
  const cleanStr = str.replace(REMOVE_INVISIBLE, "");
  stdout.write(stdout.isTTY ? str : cleanStr);
  if (!stdout.isTTY) return;
  const lines = cleanStr.split("\n");
  const newXOffset = xOffset + lines[0].length;
  // TODO handle (split on) \r
  xOffset =
    newXOffset %
    (typeof stdout.getWindowSize !== "function"
      ? 80
      : stdout.getWindowSize()[0]);
  yOffset += ~~(
    newXOffset /
    (typeof stdout.getWindowSize !== "function"
      ? 80
      : stdout.getWindowSize()[0])
  );
  if (maxYOffset < yOffset) maxYOffset = yOffset;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    yOffset +=
      1 +
      ~~(
        line.length /
        (typeof stdout.getWindowSize !== "function"
          ? 80
          : stdout.getWindowSize()[0])
      );
    if (maxYOffset < yOffset) maxYOffset = yOffset;
    xOffset =
      line.length %
      (typeof stdout.getWindowSize !== "function"
        ? 80
        : stdout.getWindowSize()[0]);
  }
  // stdout.moveCursor(-xOffset, -yOffset);
  // const pos = "" + xOffset + "," + yOffset;
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
  return new Promise<never>((resolve, reject) => {
    if (options.length === 0) {
      console.log(opts?.errorMessage || "There are no options.");
      process.exit(1);
    }
    if (options.length === 1 && opts?.disableAutoPick !== true) {
      if (
        getArgs().length > 0 &&
        (getArgs()[0] === options[0].long ||
          getArgs()[0] === `-${options[0].short}`)
      )
        getArgs().splice(0, 1);
      const prom =
        opts?.invertedQuiet?.cmd === true
          ? makeSelection(options[0])
          : makeSelectionQuietly(options[0]);
      prom.then(resolve);
      prom.catch(reject);
      return;
    }
    options.push({
      short: "x",
      long: "x",
      text: "exit",
      action: () => abort(),
    });
    const quick: { [key: string]: Option } = {};
    const str: string[] = [heading + "\n"];
    for (let i = 0; i < options.length; i++) {
      const o = options[i];
      if (getArgs()[0] === o.long || getArgs()[0] === `-${o.short}`) {
        getArgs().splice(0, 1);
        const prom =
          opts?.invertedQuiet?.cmd === true
            ? makeSelection(o)
            : makeSelectionQuietly(o);
        prom.then(resolve);
        prom.catch(reject);
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
      const arg = getArgs().splice(0, 1)[0];
      if (arg === "_") {
        const prom =
          opts?.invertedQuiet?.cmd === true
            ? makeSelection(options[pos])
            : makeSelectionQuietly(options[pos]);
        prom.then(resolve);
        prom.catch(reject);
        return;
      } else if (CONTEXTS[arg] !== undefined) output(CONTEXTS[arg](arg) + "\n");
      else
        output(
          `${RED}Invalid argument in the current context: ${arg}${NORMAL_COLOR}\n`
        );
      getArgs().splice(0, getArgs().length);
    }

    output(" \n");
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
        const k = key.toString();
        // moveCursor(0, options.length - pos);
        // //let l = JSON.stringify(key);
        // //output(l);
        // stdout.write("" + yOffset);
        // moveCursor(-("" + yOffset).length, -options.length + pos);
        if (k === ENTER) {
          const prom =
            opts?.invertedQuiet?.cmd !== false
              ? makeSelection(options[pos])
              : makeSelectionQuietly(options[pos]);
          prom.then(resolve);
          prom.catch(reject);
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
          const prom = makeSelection(quick[k]);
          prom.then(resolve);
          prom.catch(reject);
          return;
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
  return new Promise<never>((resolve, reject) => {
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
    if (getArgs().length > 0) {
      const arg = getArgs()[0];
      const es = arg.split(",");
      const result: { [key: string]: boolean } = {};
      keys.forEach((e) => (result[e] = false));
      const illegal = es.filter((e) => !keys.includes(e));
      if (illegal.length > 0) {
        output(
          `${RED}Invalid arguments in the current context: ${illegal.join(
            ", "
          )}${NORMAL_COLOR}\n`
        );
      } else {
        es.forEach((e) => (result[e] = true));
      }
      getArgs().splice(0, getArgs().length);
      const prom = makeSelectionSuperInternal(() => after(selection));
      prom.then(resolve);
      prom.catch(reject);
      return;
    }
    const str: string[] = [];
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
        const k = key.toString();
        // moveCursor(0, options.length - pos);
        // //let l = JSON.stringify(key);
        // //output(l);
        // stdout.write("" + yOffset);
        // moveCursor(-("" + yOffset).length, -options.length + pos);
        if (k === ENTER) {
          if (pos === keys.length) {
            // Submit
            const selected = keys
              .filter((x) => selection[x] === true)
              .join(",");
            const prom = makeSelectionSuperInternal(
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
            );
            prom.then(resolve);
            prom.catch(reject);
            return;
          } else if (pos > keys.length) {
            // Exit
            const prom = makeSelectionQuietly({
              short: "x",
              long: "x",
              text: "exit",
              action: () => abort(),
            });
            prom.then(resolve);
            prom.catch(reject);
            return;
          } else {
            const sel = (selection[keys[pos]] = !selection[keys[pos]]);
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
          const prom = makeSelectionQuietly({
            short: "x",
            long: "x",
            text: "exit",
            action: () => abort(),
          });
          prom.then(resolve);
          prom.catch(reject);
          return;
        } else if (k === "s") {
          const selected = keys.filter((x) => selection[x] === true).join(",");
          const prom = makeSelectionSuperInternal(
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
          );
          prom.then(resolve);
          prom.catch(reject);
          return;
        }
        // write the key to stdout all normal like
        // output(key);
      })
    );
  });
}

let interval: NodeJS.Timeout | undefined;
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
export enum Formatting {
  Normal,
  Minimal,
}
export function shortText(
  prompt: string,
  description: string,
  defaultValueArg: string | null,
  options?: { hide?: Visibility; formatting?: Formatting }
) {
  return new Promise<string>((resolve) => {
    const hide = options?.hide === undefined ? Visibility.Public : options.hide;
    const formatting =
      options?.formatting === undefined
        ? Formatting.Normal
        : options.formatting;
    if (hide === Visibility.Secret) hasSecret = true;
    const defaultValue = defaultValueArg === null ? "" : defaultValueArg;
    if (getArgs()[0] !== undefined) {
      const result = getArgs()[0] === "_" ? defaultValue : getArgs()[0];
      command +=
        " " +
        (result.includes(" ")
          ? `'${result}'`
          : result.length === 0
          ? "_"
          : result);
      getArgs().splice(0, 1);
      moveToBottom();
      cleanup();
      if (listener !== undefined) stdin.removeListener("data", listener);
      resolve(result);
      return;
    }

    let str = prompt;
    if (formatting === Formatting.Normal) {
      if (defaultValue === "") str += ` (${YELLOW}optional${NORMAL_COLOR})`;
      else str += ` (suggestion: ${YELLOW}${defaultValue}${NORMAL_COLOR})`;
      str += ": ";
    }

    output(" \n");
    output(str);
    const [prevX, prevY] = getCursorPosition();
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
        const k = key.toString();
        // moveCursor(-str.length, 0);
        // const l = JSON.stringify(key);
        // output(l);
        // output("" + afterCursor.length);
        // moveCursor(str.length - l.length, 0);
        // moveCursor(-l.length, -options.length + pos);
        if (k === ENTER) {
          moveToBottom();
          cleanup();
          const combinedStr = beforeCursor + afterCursor;
          const result = combinedStr.length === 0 ? defaultValue : combinedStr;
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
          const [prevX, prevY] = getCursorPosition();
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
          /^[A-Za-z0-9@_, .\-/:;#=&*?!"'`^%£$€+<>()\[\]{}\\]+$/.test(k)
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

let seconds = 0;
export function timer_start(suffix = "") {
  if (!stdout.isTTY) return;
  seconds = 0;
  const out = seconds.toString().padStart(3, " ") + suffix;
  output(out);
  interval = setInterval(() => time(suffix), 1000);
}
function time(suffix: string) {
  seconds++;
  const out = seconds.toString().padStart(3, " ") + suffix;
  moveCursor(-out.length, 0);
  output(out);
}
export function timer_stop() {
  if (interval !== undefined) {
    clearInterval(interval);
    interval = undefined;
    return true;
  }
  return false;
}

export function exit() {
  moveToBottom();
  cleanup();
}

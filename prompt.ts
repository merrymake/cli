import { stdin, stdout } from "node:process";
import { getArgs } from "./args.js";
import { CONTEXTS } from "./contexts.js";
import { getCommand } from "./mmCommand.js";
import { Str } from "@merrymake/utils";
import { finish } from "./exitMessages.js";

export const CTRL_C = "\u0003";
// const CR = "\u000D";
export const BACKSPACE = "\b";
export const ESCAPE = "\u001b";
export const DELETE = "\u001b[3~";
export const ENTER = "\r";

let xOffset = 0;
let yOffset = 0;
let maxYOffset = 0;
export function output(str: string) {
  const cleanStr = Str.withoutInvisible(str);
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

export function moveToBottom() {
  moveCursor(-xOffset, maxYOffset - yOffset);
}

function getCursorPosition() {
  return [xOffset, yOffset];
}

let command = "";
let hasSecret = false;

export function resetCommand(str: string) {
  command = getCommand() + (str.length === 0 ? "" : " " + str);
}

function makeSelectionSuperInternal(
  action: () => Promise<never>,
  extra: () => void = () => {}
) {
  if (command.length === 0) command = getCommand();
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
  output(Str.FG_DEFAULT + Str.BG_DEFAULT + Str.SHOW_CURSOR);
}

export type Option = {
  long: string;
  short?: string;
  weight?: number;
  text: string;
  action: () => Promise<never>;
};

export function choice(
  staticOptions: Option[],
  dynamicOptionsMaker: () => Promise<{
    options: Option[];
    header: string;
    def?: number;
  }>,
  opts?: {
    disableAutoPick?: boolean;
    invertedQuiet?: { cmd: boolean };
    errorMessage?: string;
  }
) {
  return new Promise<never>(async (resolve, reject) => {
    if (getArgs().length > 0) {
      // First try static options (FAST)
      const o = staticOptions.find(
        (x) => getArgs()[0] === x.long || getArgs()[0] === `-${x.short}`
      );
      if (o !== undefined) {
        getArgs().splice(0, 1);
        const prom =
          opts?.invertedQuiet?.cmd === true
            ? makeSelection(o)
            : makeSelectionQuietly(o);
        prom.then(resolve);
        prom.catch(reject);
        return;
      }
    }
    // No static option found, time to run the slow options
    const dynamic = await dynamicOptionsMaker();
    const { options: dynamicOptions, header: heading } = dynamic;
    dynamicOptions.forEach((o) => (o.weight = o.weight || 1));
    const options = staticOptions.concat(dynamicOptions);
    options.sort((a, b) => (b.weight || 0) - (a.weight || 0));
    if (options.length === 0) {
      console.log(opts?.errorMessage || "There are no options.");
      process.exit(1);
    }
    for (let i = 0; i < Math.min(10, options.length); i++)
      if (options[i].short === undefined)
        options[i].short = ((i + 1) % 10).toString();
      else break;
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
    if (!["x", "-x"].includes(getArgs()[0]))
      options.push({
        short: "x",
        long: "x",
        text: "exit",
        action: () => finish(),
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
      str.push(`  ${Str.FG_GRAY}[`);
      str.push(o.short || "_");
      str.push(`]${Str.FG_DEFAULT} `);
      const index = o.text.indexOf(o.long);
      if (index >= 0) {
        const before = o.text.substring(0, index);
        const after = o.text.substring(index + o.long.length);
        str.push(before);
        str.push(Str.FG_YELLOW);
        str.push(o.long);
        str.push(Str.FG_DEFAULT);
        str.push(after);
      } else {
        str.push(o.text);
      }
      str.push("\n");
    }
    let pos = dynamic?.def || 0;
    if (getArgs().length > 0) {
      const arg = getArgs().splice(0, 1)[0];
      if (arg === "x") {
        output(" \n");
        output(str.join(""));
        const prom = makeSelectionQuietly({
          short: "x",
          long: "x",
          text: "exit",
          action: () => finish(),
        });
        prom.then(resolve);
        prom.catch(reject);
        return;
      } else if (arg === "_") {
        const prom =
          opts?.invertedQuiet?.cmd === true
            ? makeSelection(options[pos])
            : makeSelectionQuietly(options[pos]);
        prom.then(resolve);
        prom.catch(reject);
        return;
      } else if (CONTEXTS[arg] !== undefined)
        output((await CONTEXTS[arg](arg)) + "\n");
      else
        output(
          `${Str.FG_RED}Invalid argument in the current context: ${arg}${Str.FG_DEFAULT}\n`
        );
      getArgs().splice(0, getArgs().length);
    }

    output(" \n");
    output(Str.HIDE_CURSOR);
    output(str.join(""));

    if (!stdin.isTTY || stdin.setRawMode === undefined) {
      console.log(
        "This console does not support TTY, please use the 'mmk'-command instead."
      );
      process.exit(1);
    }

    output(Str.FG_YELLOW);
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
        } else if (k === Str.UP && pos <= 0) {
          return;
        } else if (k === Str.UP) {
          pos--;
          output(` `);
          moveCursor(-1, -1);
          output(`>`);
          moveCursor(-1, 0);
        } else if (k === Str.DOWN && pos >= options.length - 1) {
          return;
        } else if (k === Str.DOWN) {
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
  heading: string,
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
          `${
            Str.FG_RED
          }Invalid arguments in the current context: ${illegal.join(", ")}${
            Str.FG_DEFAULT
          }\n`
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
    const str: string[] = [heading + "\n"];
    for (let i = 0; i < keys.length; i++) {
      str.push("  ");
      str.push(selection[keys[i]] === true ? SELECTED_MARK : NOT_SELECTED_MARK);
      str.push(" ");
      str.push(keys[i]);
      str.push("\n");
    }

    // Add submit and exit
    str.push(`  ${Str.FG_GRAY}[s]${Str.FG_DEFAULT} submit\n`);
    str.push(`  ${Str.FG_GRAY}[x]${Str.FG_DEFAULT} exit\n`);

    output(" \n");
    output(Str.HIDE_CURSOR);
    output(str.join(""));

    if (!stdin.isTTY || stdin.setRawMode === undefined) {
      console.log(
        "This console does not support TTY, please use the 'mmk'-command instead."
      );
      process.exit(1);
    }

    let pos = 0;
    output(Str.FG_YELLOW);
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
              action: () => finish(),
            });
            prom.then(resolve);
            prom.catch(reject);
            return;
          } else {
            const sel = (selection[keys[pos]] = !selection[keys[pos]]);
            moveCursor(2, 0);
            output(Str.FG_DEFAULT);
            output(sel ? SELECTED_MARK : NOT_SELECTED_MARK);
            output(Str.FG_YELLOW);
            moveCursor(-3, 0);
          }
          return;
        } else if (k === Str.UP && pos <= 0) {
          return;
        } else if (k === Str.UP) {
          pos--;
          output(` `);
          moveCursor(-1, -1);
          output(`>`);
          moveCursor(-1, 0);
        } else if (k === Str.DOWN && pos >= keys.length + 2 - 1) {
          return;
        } else if (k === Str.DOWN) {
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
            action: () => finish(),
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

// let interval: NodeJS.Timeout | undefined;
// let spinnerIndex = 0;
// const SPINNER = ["│", "/", "─", "\\"];
// export function spinner_start() {
//   if (!stdout.isTTY) return;
//   interval = setInterval(spin, 200);
// }
// function spin() {
//   output(SPINNER[(spinnerIndex = (spinnerIndex + 1) % SPINNER.length)]);
//   moveCursor(-1, 0);
// }
// export function spinner_stop() {
//   if (interval !== undefined) {
//     clearInterval(interval);
//     interval = undefined;
//   }
// }

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
      if (defaultValue === "")
        str += ` (${Str.FG_YELLOW}optional${Str.FG_DEFAULT})`;
      else
        str += ` (suggestion: ${Str.FG_YELLOW}${defaultValue}${Str.FG_DEFAULT})`;
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
        } else if (k === Str.UP || k === Str.DOWN) {
        } else if (k === ESCAPE) {
          const [prevX, prevY] = getCursorPosition();
          moveCursor(-str.length - beforeCursor.length, 1);
          output(description);
          moveCursorTo(prevX, prevY);
        } else if (k === Str.LEFT && beforeCursor.length > 0) {
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
        } else if (k === Str.RIGHT && afterCursor.length > 0) {
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

// let seconds = 0;
// export function timer_start(suffix = "") {
//   if (!stdout.isTTY) return;
//   seconds = 0;
//   const out = seconds.toString().padStart(3, " ") + suffix;
//   output(out);
//   interval = setInterval(() => time(suffix), 1000);
// }
// function time(suffix: string) {
//   seconds++;
//   const out = seconds.toString().padStart(3, " ") + suffix;
//   moveCursor(-out.length, 0);
//   output(out);
// }
// export function timer_stop() {
//   if (interval !== undefined) {
//     clearInterval(interval);
//     interval = undefined;
//     return true;
//   }
//   return false;
// }

export function exit() {
  moveToBottom();
  cleanup();
}

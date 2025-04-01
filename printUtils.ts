import { Str } from "@merrymake/utils";
import { ExecOptions, spawn } from "child_process";
import { createRequire } from "module";
import { homedir } from "os";
import { addExitMessage } from "./exitMessages.js";
import { getShortCommand } from "./mmCommand.js";
import { execPromise, execStreamPromise } from "./utils.js";
import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
const require = createRequire(import.meta.url);
// IN THE FUTURE: import conf from "./package.json" with {type:"json"};
export const package_json = require("./package.json");

const COMMAND_COLOR = Str.PURPLE;

const historyFolder = homedir() + "/.merrymake/";
const historyFile = "history";
const updateFile = "last_update_check";
export async function checkVersionIfOutdated() {
  try {
    if (!existsSync(historyFolder)) await mkdir(historyFolder);
    const lastCheck = existsSync(historyFolder + updateFile)
      ? +(await readFile(historyFolder + updateFile).toString())
      : 0;
    if (Date.now() - lastCheck > 4 * 60 * 60 * 1000) {
      await checkVersion();
    }
  } catch (e) {}
}
async function checkVersion() {
  try {
    const call = await execPromise("npm show @merrymake/cli dist-tags --json");
    const version: { latest: string } = JSON.parse(call);
    if (Str.semanticVersionLessThan(package_json.version, version.latest)) {
      addExitMessage(`
New version of merrymake-cli available (${package_json.version} -> ${version.latest}). You can read the release notes here:
  https://github.com/merrymake/cli/blob/main/CHANGELOG.md
To update run the command:
  ${COMMAND_COLOR}npm install --global @merrymake/cli@latest${Str.NORMAL_COLOR}`);
    }
    await writeFile(historyFolder + updateFile, "" + Date.now());
  } catch (e) {}
}
let timer: ReturnType<typeof Str.Timer.start> | undefined;
export function outputGit(str: string) {
  const st = (str || "").trimEnd();
  if (st.endsWith("elapsed")) {
    return;
  } else if (timer !== undefined) {
    timer.stop();
    timer = undefined;
    process.stdout.write(`\n`);
  }
  console.log(
    st
      .split("\n")
      .map((x) => {
        const lineParts = x.trimEnd().split("remote: ");
        const line = lineParts[lineParts.length - 1];
        const color =
          line.match(/fail|error|fatal/i) !== null
            ? Str.RED
            : line.match(/warn/i) !== null
            ? Str.YELLOW
            : line.match(/succe/i) !== null
            ? Str.GREEN
            : Str.NORMAL_COLOR;
        const commands = line.split("'mm");
        for (let i = 1; i < commands.length; i++) {
          const ind = commands[i].indexOf("'");
          const cmd = commands[i].substring(0, ind);
          const rest = commands[i].substring(ind);
          commands[
            i
          ] = `'${COMMAND_COLOR}${getShortCommand()}${cmd}${color}${rest}`;
        }
        lineParts[lineParts.length - 1] =
          color + commands.join("") + Str.NORMAL_COLOR;
        return lineParts.join(`${Str.GRAY}remote: `);
      })
      .join("\n")
  );
  if (st.endsWith("(this may take a few minutes)...")) {
    process.stdout.write(`${Str.GRAY}remote: ${Str.NORMAL_COLOR}    `);
    timer = Str.Timer.start(new Str.Timer.Seconds("s elapsed"));
  }
}

export async function execute(command: string, alsoPrint = false) {
  try {
    const result: string[] = [];
    const onData = (s: string) => {
      result.push(s);
      if (alsoPrint) outputGit(s);
    };
    await execStreamPromise(command, onData);
    return result.join("");
  } catch (e) {
    throw e;
  }
}

export function spawnPromise(str: string) {
  return new Promise<void>((resolve, reject) => {
    const [cmd, ...args] = str.split(" ");
    const options: ExecOptions = {
      cwd: ".",
      shell: "sh",
    };
    const ls = spawn(cmd, args, options);
    ls.stdout.on("data", (data: Buffer | string) => {
      outputGit(data.toString());
    });
    ls.stderr.on("data", (data: Buffer | string) => {
      outputGit(data.toString());
    });
    ls.on("close", (code) => {
      if (code === 0) resolve();
      else reject();
    });
  });
}

interface CacheFile {
  registered: boolean;
  hasOrgs: boolean;
}

export function getCache(): CacheFile {
  if (!existsSync(`${historyFolder}cache`)) {
    return { registered: false, hasOrgs: false };
  }
  return JSON.parse(readFile(`${historyFolder}cache`).toString());
}
export function saveCache(cache: CacheFile) {
  writeFile(`${historyFolder}cache`, JSON.stringify(cache));
}

export function debugLog(msg: string) {
  if ((process.env.ASDF_DEBUG || "").toLowerCase() === "true") console.log(msg);
}

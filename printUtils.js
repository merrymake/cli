import { spawn } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { execPromise, execStreamPromise } from "./utils.js";
import { Str } from "@merrymake/utils";
import { GRAY, GREEN, NORMAL_COLOR, PURPLE, RED, YELLOW } from "./prompt.js";
import { getShortCommand } from "./mmCommand.js";
import { addExitMessage } from "./exitMessages.js";
import { homedir } from "os";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
// IN THE FUTURE: import conf from "./package.json" with {type:"json"};
export const package_json = require("./package.json");
const COMMAND_COLOR = PURPLE;
// TODO Use merrymake/utils
function versionIsOlder(old, new_) {
    const os = old.split(".");
    const ns = new_.split(".");
    if (+os[0] < +ns[0])
        return true;
    else if (+os[0] > +ns[0])
        return false;
    else if (+os[1] < +ns[1])
        return true;
    else if (+os[1] > +ns[1])
        return false;
    else if (+os[2] < +ns[2])
        return true;
    return false;
}
const historyFolder = homedir() + "/.merrymake/";
const historyFile = "history";
const updateFile = "last_update_check";
export async function checkVersionIfOutdated() {
    try {
        if (!existsSync(historyFolder))
            mkdirSync(historyFolder);
        const lastCheck = existsSync(historyFolder + updateFile)
            ? +readFileSync(historyFolder + updateFile).toString()
            : 0;
        if (Date.now() - lastCheck > 4 * 60 * 60 * 1000) {
            await checkVersion();
        }
    }
    catch (e) { }
}
async function checkVersion() {
    try {
        const call = await execPromise("npm show @merrymake/cli dist-tags --json");
        const version = JSON.parse(call);
        if (versionIsOlder(package_json.version, version.latest)) {
            addExitMessage(`
New version of merrymake-cli available (${package_json.version} -> ${version.latest}). You can read the release notes here:
  https://github.com/merrymake/cli/blob/main/CHANGELOG.md
To update run the command:
  ${COMMAND_COLOR}npm install --global @merrymake/cli@latest${NORMAL_COLOR}`);
        }
    }
    catch (e) { }
    writeFileSync(historyFolder + updateFile, "" + Date.now());
}
let timer;
export function outputGit(str) {
    const st = (str || "").trimEnd();
    if (st.endsWith("elapsed")) {
        return;
    }
    else if (timer !== undefined) {
        timer.stop();
        timer = undefined;
        process.stdout.write(`\n`);
    }
    console.log(st
        .split("\n")
        .map((x) => {
        const lineParts = x.trimEnd().split("remote: ");
        const line = lineParts[lineParts.length - 1];
        const color = line.match(/fail|error|fatal/i) !== null
            ? RED
            : line.match(/warn/i) !== null
                ? YELLOW
                : line.match(/succe/i) !== null
                    ? GREEN
                    : NORMAL_COLOR;
        const commands = line.split("'mm");
        for (let i = 1; i < commands.length; i++) {
            const ind = commands[i].indexOf("'");
            const cmd = commands[i].substring(0, ind);
            const rest = commands[i].substring(ind);
            commands[i] = `'${COMMAND_COLOR}${getShortCommand()}${cmd}${color}${rest}`;
        }
        lineParts[lineParts.length - 1] =
            color + commands.join("") + NORMAL_COLOR;
        return lineParts.join(`${GRAY}remote: `);
    })
        .join("\n"));
    if (st.endsWith("(this may take a few minutes)...")) {
        process.stdout.write(`${GRAY}remote: ${NORMAL_COLOR}    `);
        timer = Str.Timer.start(new Str.Timer.Seconds("s elapsed"));
    }
}
export async function execute(command, alsoPrint = false) {
    try {
        const result = [];
        const onData = (s) => {
            result.push(s);
            if (alsoPrint)
                outputGit(s);
        };
        await execStreamPromise(command, onData);
        return result.join("");
    }
    catch (e) {
        throw e;
    }
}
export function spawnPromise(str) {
    return new Promise((resolve, reject) => {
        const [cmd, ...args] = str.split(" ");
        const options = {
            cwd: ".",
            shell: "sh",
        };
        const ls = spawn(cmd, args, options);
        ls.stdout.on("data", (data) => {
            outputGit(data.toString());
        });
        ls.stderr.on("data", (data) => {
            outputGit(data.toString());
        });
        ls.on("close", (code) => {
            if (code === 0)
                resolve();
            else
                reject();
        });
    });
}
export function getCache() {
    if (!existsSync(`${historyFolder}cache`)) {
        return { registered: false, hasOrgs: false };
    }
    return JSON.parse(readFileSync(`${historyFolder}cache`).toString());
}
export function saveCache(cache) {
    writeFileSync(`${historyFolder}cache`, JSON.stringify(cache));
}
export function debugLog(msg) {
    if ((process.env.ASDF_DEBUG || "").toLowerCase() === "true")
        console.log(msg);
}

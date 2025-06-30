import { Str } from "@merrymake/utils";
import { spawn } from "child_process";
import { createRequire } from "module";
import { addExitMessage } from "./exitMessages.js";
import { getShortCommand } from "./mmCommand.js";
import { getConfig, setConfig } from "./persistance.js";
import { execPromise, execStreamPromise } from "./utils.js";
const require = createRequire(import.meta.url);
// IN THE FUTURE: import conf from "./package.json" with {type:"json"};
export const package_json = require("./package.json");
export const COMMAND_COLOR = Str.FG_PURPLE;
export async function checkVersionIfOutdated() {
    try {
        const lastCheck = await getConfig("last-version-check");
        if (Date.now() - +lastCheck > 24 * 60 * 60 * 1000) {
            await getLatestVersion();
            const latestVersion = await getConfig("latest-version");
            if (Str.semanticVersionLessThan(package_json.version, latestVersion)) {
                addExitMessage(`
    A newer version of the merrymake-cli is available (${package_json.version} -> ${latestVersion}).
    Release notes: https://github.com/merrymake/cli/blob/main/CHANGELOG.md
    Update command: ${COMMAND_COLOR}npm install --global @merrymake/cli@latest${Str.FG_DEFAULT}`);
            }
        }
    }
    catch (e) { }
}
async function getLatestVersion() {
    const call = await execPromise("npm show @merrymake/cli dist-tags --json");
    const version = JSON.parse(call);
    setConfig({
        "latest-version": version.latest,
        "last-version-check": Date.now().toString(),
    });
}
let timer;
export function outputGit(str, col = Str.FG_GRAY) {
    const st = (str || "").trimEnd();
    if (st.endsWith("elapsed")) {
        return;
    }
    else if (timer !== undefined) {
        timer.stop();
        timer = undefined;
        process.stdout.write(`\n`);
    }
    console.log(col +
        st
            .split("\n")
            .map((x) => {
            const lineParts = x.trimEnd().split("remote: ");
            const line = lineParts[lineParts.length - 1];
            const color = line.match(/fail|error|fatal/i) !== null
                ? Str.FG_RED
                : line.match(/warn/i) !== null
                    ? Str.FG_YELLOW
                    : line.match(/succe/i) !== null
                        ? Str.FG_GREEN
                        : lineParts.length > 1
                            ? Str.FG_DEFAULT
                            : col;
            const commands = line.split("'mm");
            for (let i = 1; i < commands.length; i++) {
                const ind = commands[i].indexOf("'");
                const cmd = commands[i].substring(0, ind);
                const rest = commands[i].substring(ind);
                commands[i] = `'${COMMAND_COLOR}${getShortCommand()}${cmd}${color}${rest}`;
            }
            lineParts[lineParts.length - 1] = color + commands.join("") + col;
            return lineParts.join(`remote: `);
        })
            .join("\n") +
        Str.FG_DEFAULT);
    if (st.endsWith("(this may take a few minutes)...")) {
        process.stdout.write(`${col}remote: ${Str.FG_DEFAULT}    `);
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
export function debugLog(msg) {
    if ((process.env.ASDF_DEBUG || "").toLowerCase() === "true")
        console.log(msg);
}

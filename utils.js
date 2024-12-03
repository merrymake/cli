import { exec, spawn } from "child_process";
import fs from "fs";
import http from "http";
import https from "https";
import { readdirSync } from "node:fs";
import os from "os";
import path from "path";
import { SSH_HOST } from "./config.js";
// IN THE FUTURE: import conf from "./package.json" with {type:"json"};
import { BLUE, GRAY, GREEN, NORMAL_COLOR, RED, REMOVE_INVISIBLE, YELLOW, exit, output, spinner_start, spinner_stop, timer_start, timer_stop, } from "./prompt.js";
import { createRequire } from "node:module";
import { stdout } from "process";
const require = createRequire(import.meta.url);
export const package_json = require("./package.json");
export const lowercase = "abcdefghijklmnopqrstuvwxyz";
export const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const digits = "0123456789";
export const underscore = "_";
export const dash = "-";
export const all = lowercase + uppercase + digits + underscore + dash;
export function generateString(length, alphabet) {
    let result = "";
    for (let i = 0; i < length; i++) {
        result += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    return result;
}
export class Path {
    offset;
    constructor(offset = ".") {
        this.offset = offset;
        let end = this.offset.length;
        while (this.offset.charAt(end - 1) === "/")
            end--;
        this.offset = this.offset.substring(0, end);
        if (this.offset.length === 0)
            this.offset = ".";
    }
    with(next) {
        return new Path(path.join(this.offset, next));
    }
    withoutLastUp() {
        return new Path(this.offset.substring(0, this.offset.lastIndexOf("..")));
    }
    toString() {
        return this.offset;
    }
}
export function getFiles(path) {
    return getFiles_internal(path, "");
}
function getFiles_internal(path, prefix) {
    if (!fs.existsSync(path.toString()))
        return [];
    return readdirSync(path.toString(), { withFileTypes: true }).flatMap((x) => x.isDirectory()
        ? getFiles_internal(path.with(x.name), prefix + x.name + "/")
        : [prefix + x.name]);
}
const toExecute = [];
let dryrun = false;
export function setDryrun() {
    outputGit(`${BLUE}Dryrun mode, changes will not be performed.${NORMAL_COLOR}`);
    dryrun = true;
}
export function addToExecuteQueue(f) {
    if (!dryrun)
        toExecute.push(f);
}
let printOnExit = [];
export function addExitMessage(str) {
    printOnExit.push(str);
}
function printExitMessages() {
    printOnExit.forEach((x) => output(x + "\n"));
}
export function abort() {
    exit();
    printExitMessages();
    process.exit(0);
}
export async function finish() {
    try {
        exit();
        for (let i = 0; i < toExecute.length; i++) {
            await toExecute[i]();
        }
        printExitMessages();
        process.exit(0);
    }
    catch (e) {
        throw e;
    }
}
export function TODO() {
    console.log("TODO");
    exit();
    process.exit(0);
}
export function getCache() {
    if (!fs.existsSync(`${historyFolder}cache`)) {
        return { registered: false, hasOrgs: false };
    }
    return JSON.parse(fs.readFileSync(`${historyFolder}cache`).toString());
}
export function saveCache(cache) {
    fs.writeFileSync(`${historyFolder}cache`, JSON.stringify(cache));
}
export function fetchOrgRaw() {
    if (fs.existsSync(path.join(".merrymake", "conf.json"))) {
        const org = JSON.parse("" + fs.readFileSync(path.join(".merrymake", "conf.json")));
        return { org, serviceGroup: null, pathToRoot: "." + path.sep };
    }
    const cwd = process.cwd().split(/\/|\\/);
    let out = "";
    let folder = path.sep;
    let serviceGroup = null;
    for (let i = cwd.length - 1; i >= 0; i--) {
        if (fs.existsSync(out + path.join("..", ".merrymake", "conf.json"))) {
            serviceGroup = cwd[i];
            const org = (JSON.parse("" + fs.readFileSync(path.join(`${out}..`, `.merrymake`, `conf.json`))));
            return { org, serviceGroup, pathToRoot: out + ".." + path.sep };
        }
        folder = path.sep + cwd[i] + folder;
        out += ".." + path.sep;
    }
    return { org: null, serviceGroup: null, pathToRoot: null };
}
export function fetchOrg() {
    const res = fetchOrgRaw();
    if (res.org === null)
        throw "Not inside a Merrymake organization";
    return res;
}
export function printWithPrefix(str, prefix = "") {
    const prefixLength = prefix.replace(REMOVE_INVISIBLE, "").length;
    console.log(prefix +
        str
            .trimEnd()
            .split("\n")
            .flatMap((x) => x
            .match(new RegExp(`.{1,${stdout.getWindowSize()[0] - prefixLength}}( |$)|.{1,${stdout.getWindowSize()[0] - prefixLength}}`, "g"))
            .map((x) => x.trimEnd()))
            .join(`\n${prefix}`));
}
export function outputGit(str) {
    const st = (str || "").trimEnd();
    if (st.endsWith("elapsed")) {
        return;
    }
    else {
        const wasRunning = timer_stop();
        if (wasRunning)
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
            commands[i] = `'${YELLOW}mm ${cmd}${color}${rest}`;
        }
        lineParts[lineParts.length - 1] =
            color + commands.join("") + NORMAL_COLOR;
        return lineParts.join(`${GRAY}remote: `);
    })
        .join("\n"));
    if (st.endsWith("(this may take a few minutes)...")) {
        process.stdout.write(`${GRAY}remote: ${NORMAL_COLOR} `);
        timer_start("s elapsed");
    }
}
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
export function execPromise(cmd, cwd) {
    return new Promise((resolve, reject) => {
        const a = exec(cmd, { cwd }, (error, stdout, stderr) => {
            const err = error?.message || stderr;
            if (err) {
                reject(stderr || stdout);
            }
            else {
                resolve(stdout);
            }
        });
    });
}
const historyFolder = os.homedir() + "/.merrymake/";
const historyFile = "history";
const updateFile = "last_update_check";
export async function checkVersion() {
    if (!fs.existsSync(historyFolder))
        fs.mkdirSync(historyFolder);
    const lastCheck = fs.existsSync(historyFolder + updateFile)
        ? +fs.readFileSync(historyFolder + updateFile).toString()
        : 0;
    if (Date.now() - lastCheck > 4 * 60 * 60 * 1000) {
        try {
            const call = await execPromise("npm show @merrymake/cli dist-tags --json");
            const version = JSON.parse(call);
            if (versionIsOlder(package_json.version, version.latest)) {
                addExitMessage(`
New version of merrymake-cli available, ${process.env["UPDATE_MESSAGE"]}`);
            }
        }
        catch (e) { }
        fs.writeFileSync(historyFolder + updateFile, "" + Date.now());
    }
}
export function typedKeys(o) {
    return Object.keys(o);
}
export function execStreamPromise(full, onData, cwd) {
    return new Promise((resolve, reject) => {
        const [cmd, ...args] = full.split(" ");
        const p = spawn(cmd, args, { cwd, shell: "sh" });
        p.stdout.on("data", (data) => {
            onData(data.toString());
        });
        p.stderr.on("data", (data) => {
            console.log(data.toString());
        });
        p.on("exit", (code) => {
            if (code !== 0)
                reject("subprocess failed");
            else
                resolve();
        });
    });
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
function sshReqInternal(cmd) {
    return execPromise(`ssh -o ConnectTimeout=10 mist@${SSH_HOST} "${cmd}"`);
}
export async function sshReq(...cmd) {
    try {
        spinner_start();
        const result = await sshReqInternal(cmd
            .map((x) => (x.length === 0 || x.includes(" ") ? `\\"${x}\\"` : x))
            .join(" "));
        spinner_stop();
        return result;
    }
    catch (e) {
        throw e;
    }
}
export function partition(str, radix) {
    const index = str.indexOf(radix);
    if (index < 0)
        return [str, ""];
    return [str.substring(0, index), str.substring(index + radix.length)];
}
export function urlReq(url, method = "GET", data, contentType = "application/json") {
    return new Promise((resolve, reject) => {
        const [protocol, fullPath] = url.indexOf("://") >= 0 ? partition(url, "://") : ["http", url];
        const [base, path] = partition(fullPath, "/");
        const [host, port] = partition(base, ":");
        let headers;
        if (data !== undefined)
            headers = {
                "Content-Type": contentType,
                "Content-Length": data.length,
            };
        const sender = protocol === "http" ? http : https;
        const req = sender.request({
            host,
            port,
            path: "/" + path,
            method,
            headers,
        }, (resp) => {
            let str = "";
            resp.on("data", (chunk) => {
                str += chunk;
            });
            resp.on("end", () => {
                resolve({ body: str, code: resp.statusCode });
            });
        });
        req.on("error", (e) => {
            reject(`Unable to connect to ${host}. Please verify your internet connection.`);
        });
        if (data !== undefined)
            req.write(data);
        req.end();
    });
}
export function directoryNames(path, exclude) {
    if (!fs.existsSync(path.toString()))
        return [];
    return fs
        .readdirSync(path.toString(), { withFileTypes: true })
        .filter((x) => x.isDirectory() && !exclude.includes(x.name) && !x.name.startsWith("."));
}
export function toFolderName(str) {
    return str.toLowerCase().replace(/[^a-z0-9\-_]/g, "-");
}

import { exec, spawn } from "child_process";
import { existsSync } from "fs";
import http from "http";
import https from "https";
import path from "path";
import { SSH_HOST, SSH_USER } from "./config.js";
import { MEGABYTES, Promise_all, Str } from "@merrymake/utils";
import { debugLog } from "./printUtils.js";
import { readdir, readFile } from "fs/promises";
export const lowercase = "abcdefghijklmnopqrstuvwxyz";
export const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const digits = "0123456789";
export const underscore = "_";
export const dash = "-";
export const all = lowercase + uppercase + digits + underscore + dash;
export function generateString(length, ...alphabets) {
    const alphabet = alphabets.join("");
    const result = new Array(length);
    for (let i = 0; i < length; i++) {
        result.push(alphabet.charAt(Math.floor(Math.random() * alphabet.length)));
    }
    return result.join("");
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
async function getFiles_internal(path, prefix) {
    try {
        if (!existsSync(path.toString()))
            return [];
        return (await Promise_all(...(await readdir(path.toString(), { withFileTypes: true }).then()).map((x) => x.isDirectory()
            ? getFiles_internal(path.with(x.name), prefix + x.name + "/")
            : Promise.resolve([prefix + x.name]))).then()).flat();
    }
    catch (e) {
        throw e;
    }
}
export async function fetchOrgRaw() {
    try {
        if (existsSync(path.join(".merrymake", "conf.json"))) {
            const org = JSON.parse(await readFile(path.join(".merrymake", "conf.json"), "utf-8"));
            return { org, serviceGroup: null, pathToRoot: "." + path.sep };
        }
        const cwd = process.cwd().split(/\/|\\/);
        let out = "";
        let folder = path.sep;
        let serviceGroup = null;
        for (let i = cwd.length - 1; i >= 0; i--) {
            if (existsSync(out + path.join("..", ".merrymake", "conf.json"))) {
                serviceGroup = cwd[i];
                const org = (JSON.parse("" + readFile(path.join(`${out}..`, `.merrymake`, `conf.json`))));
                return { org, serviceGroup, pathToRoot: out + ".." + path.sep };
            }
            folder = path.sep + cwd[i] + folder;
            out += ".." + path.sep;
        }
        return { org: null, serviceGroup: null, pathToRoot: null };
    }
    catch (e) {
        throw e;
    }
}
export async function fetchOrg() {
    try {
        const res = await fetchOrgRaw();
        if (res.org === null)
            throw "Not inside a Merrymake organization";
        return res;
    }
    catch (e) {
        throw e;
    }
}
export function execPromise(cmd, cwd) {
    return new Promise((resolve, reject) => {
        debugLog(cmd);
        exec(cmd, { cwd, maxBuffer: 10 * MEGABYTES }, (error, stdout, stderr) => {
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
function sshReqInternal(cmd) {
    return execPromise(`ssh -o ConnectTimeout=10 ${SSH_USER}@${SSH_HOST} "${cmd}"`);
}
export async function sshReq(...cmd) {
    const spinner = typeof process.stdout.moveCursor === "function"
        ? Str.Spinner.start()
        : undefined;
    try {
        const result = await sshReqInternal(cmd
            .map((x) => (x.length === 0 || x.includes(" ") ? `\\"${x}\\"` : x))
            .join(" "));
        return result;
    }
    catch (e) {
        throw e;
    }
    finally {
        spinner?.stop();
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
export async function directoryNames(path, exclude) {
    try {
        if (!existsSync(path.toString()))
            return [];
        return (await readdir(path.toString(), { withFileTypes: true })).filter((x) => x.isDirectory() && !exclude.includes(x.name) && !x.name.startsWith("."));
    }
    catch (e) {
        throw e;
    }
}
export function toSubdomain(displayName) {
    return displayName
        .toLowerCase()
        .replace(/[ _]/g, "-")
        .replace(/[^a-z0-9\-]/g, ""); // Remove special characters
}

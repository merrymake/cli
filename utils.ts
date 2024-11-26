import { exec, ExecOptions, spawn } from "child_process";
import fs from "fs";
import http from "http";
import https from "https";
import { readdirSync } from "node:fs";
import os from "os";
import path from "path";
import { SSH_HOST } from "./config";
import * as conf from "./package.json";
import {
  BLUE,
  NORMAL_COLOR,
  exit,
  output,
  spinner_start,
  spinner_stop,
} from "./prompt";
import { PathTo } from "./types";

export class Path {
  constructor(private offset = ".") {
    let end = this.offset.length;
    while (this.offset.charAt(end - 1) === "/") end--;
    this.offset = this.offset.substring(0, end);
    if (this.offset.length === 0) this.offset = ".";
  }
  with(next: string) {
    return new Path(path.join(this.offset, next));
  }
  withoutLastUp() {
    return new Path(this.offset.substring(0, this.offset.lastIndexOf("..")));
  }
  toString() {
    return this.offset;
  }
}

export function getFiles(path: PathTo): string[] {
  return getFiles_internal(path, "");
}

function getFiles_internal(path: PathTo, prefix: string): string[] {
  if (!fs.existsSync(path.toString())) return [];
  return readdirSync(path.toString(), { withFileTypes: true }).flatMap((x) =>
    x.isDirectory()
      ? getFiles_internal(path.with(x.name), prefix + x.name + "/")
      : [prefix + x.name]
  );
}

const toExecute: (() => Promise<unknown>)[] = [];
let dryrun = false;

export function setDryrun() {
  output2(`${BLUE}Dryrun mode, changes will not be performed.${NORMAL_COLOR}`);
  dryrun = true;
}
export function addToExecuteQueue(f: () => Promise<unknown>) {
  if (!dryrun) toExecute.push(f);
}

let printOnExit: string[] = [];
export function addExitMessage(str: string) {
  printOnExit.push(str);
}
function printExitMessages() {
  printOnExit.forEach((x) => output(x + "\n"));
}
export function abort(): never {
  exit();
  printExitMessages();
  process.exit(0);
}
export async function finish(): Promise<never> {
  try {
    exit();
    for (let i = 0; i < toExecute.length; i++) {
      await toExecute[i]();
    }
    printExitMessages();
    process.exit(0);
  } catch (e) {
    console.log("finish");
    throw e;
  }
}
export function TODO(): never {
  console.log("TODO");
  exit();
  process.exit(0);
}

export interface OrgFile {
  organizationId: string;
}
interface CacheFile {
  registered: boolean;
  hasOrgs: boolean;
}

export function getCache(): CacheFile {
  if (!fs.existsSync(`${historyFolder}cache`)) {
    return { registered: false, hasOrgs: false };
  }
  return JSON.parse(fs.readFileSync(`${historyFolder}cache`).toString());
}
export function saveCache(cache: CacheFile) {
  fs.writeFileSync(`${historyFolder}cache`, JSON.stringify(cache));
}

export function fetchOrgRaw() {
  if (fs.existsSync(path.join(".merrymake", "conf.json"))) {
    const org: OrgFile = JSON.parse(
      "" + fs.readFileSync(path.join(".merrymake", "conf.json"))
    );
    return { org, serviceGroup: null, pathToRoot: "." + path.sep };
  }

  const cwd = process.cwd().split(/\/|\\/);
  let out = "";
  let folder = path.sep;
  let serviceGroup: string | null = null;
  for (let i = cwd.length - 1; i >= 0; i--) {
    if (fs.existsSync(out + path.join("..", ".merrymake", "conf.json"))) {
      serviceGroup = cwd[i];
      const org = <OrgFile>(
        JSON.parse(
          "" + fs.readFileSync(path.join(`${out}..`, `.merrymake`, `conf.json`))
        )
      );
      return { org, serviceGroup, pathToRoot: out + ".." + path.sep };
    }
    folder = path.sep + cwd[i] + folder;
    out += ".." + path.sep;
  }
  return { org: null, serviceGroup: null, pathToRoot: null };
}
export function fetchOrg() {
  const res = fetchOrgRaw();
  if (res.org === null) throw "Not inside a Merrymake organization";
  return res;
}
export function output2(str: string) {
  console.log(
    (str || "")
      .trimEnd()
      .split("\n")
      .map((x) => x.trimEnd())
      .join("\n")
  );
}

function versionIsOlder(old: string, new_: string) {
  const os = old.split(".");
  const ns = new_.split(".");
  if (+os[0] < +ns[0]) return true;
  else if (+os[0] > +ns[0]) return false;
  else if (+os[1] < +ns[1]) return true;
  else if (+os[1] > +ns[1]) return false;
  else if (+os[2] < +ns[2]) return true;
  return false;
}

export function execPromise(cmd: string, cwd?: string) {
  return new Promise<string>((resolve, reject) => {
    const a = exec(cmd, { cwd }, (error, stdout, stderr) => {
      const err = error?.message || stderr;
      if (err) {
        reject(stderr || stdout);
      } else {
        resolve(stdout);
      }
    });
  });
}

const historyFolder = os.homedir() + "/.merrymake/";
const historyFile = "history";
const updateFile = "last_update_check";
export async function checkVersion() {
  if (!fs.existsSync(historyFolder)) fs.mkdirSync(historyFolder);
  const lastCheck = fs.existsSync(historyFolder + updateFile)
    ? +fs.readFileSync(historyFolder + updateFile).toString()
    : 0;
  if (Date.now() - lastCheck > 4 * 60 * 60 * 1000) {
    try {
      const call = await execPromise(
        "npm show @merrymake/cli dist-tags --json"
      );
      const version: { latest: string } = JSON.parse(call);
      if (versionIsOlder(conf.version, version.latest)) {
        addExitMessage(`
New version of merrymake-cli available, ${process.env["UPDATE_MESSAGE"]}`);
      }
    } catch (e) {}
    fs.writeFileSync(historyFolder + updateFile, "" + Date.now());
  }
}

export function typedKeys<T extends object>(o: T): Array<keyof T> {
  return Object.keys(o) as any;
}

export function execStreamPromise(
  full: string,
  onData: (_: string) => void,
  cwd?: string
) {
  return new Promise<void>((resolve, reject) => {
    const [cmd, ...args] = full.split(" ");
    const p = spawn(cmd, args, { cwd, shell: "sh" });
    p.stdout.on("data", (data) => {
      onData(data.toString());
    });
    p.stderr.on("data", (data) => {
      console.log(data.toString());
    });
    p.on("exit", (code) => {
      if (code !== 0) reject();
      else resolve();
    });
  });
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
      output2(data.toString());
    });
    ls.stderr.on("data", (data: Buffer | string) => {
      output2(data.toString());
    });
    ls.on("close", (code) => {
      if (code === 0) resolve();
      else reject();
    });
  });
}

function sshReqInternal(cmd: string) {
  return execPromise(`ssh -o ConnectTimeout=10 mist@${SSH_HOST} "${cmd}"`);
}
export async function sshReq(...cmd: string[]) {
  try {
    spinner_start();
    const result = await sshReqInternal(
      cmd
        .map((x) => (x.length === 0 || x.includes(" ") ? `\\"${x}\\"` : x))
        .join(" ")
    );
    spinner_stop();
    return result;
  } catch (e) {
    throw e;
  }
}

export function partition(str: string, radix: string) {
  const index = str.indexOf(radix);
  if (index < 0) return [str, ""];
  return [str.substring(0, index), str.substring(index + radix.length)];
}

export function urlReq(
  url: string,
  method: "POST" | "GET" = "GET",
  data?: string,
  contentType = "application/json"
) {
  return new Promise<{ body: string; code: number | undefined }>(
    (resolve, reject) => {
      const [protocol, fullPath] =
        url.indexOf("://") >= 0 ? partition(url, "://") : ["http", url];
      const [base, path] = partition(fullPath, "/");
      const [host, port] = partition(base, ":");
      let headers;
      if (data !== undefined)
        headers = {
          "Content-Type": contentType,
          "Content-Length": data.length,
        };
      const sender = protocol === "http" ? http : https;
      const req = sender.request(
        {
          host,
          port,
          path: "/" + path,
          method,
          headers,
        },
        (resp) => {
          let str = "";
          resp.on("data", (chunk) => {
            str += chunk;
          });
          resp.on("end", () => {
            resolve({ body: str, code: resp.statusCode });
          });
        }
      );
      req.on("error", (e) => {
        reject(
          `Unable to connect to ${host}. Please verify your internet connection.`
        );
      });
      if (data !== undefined) req.write(data);
      req.end();
    }
  );
}

export function directoryNames(path: PathTo, exclude: string[]) {
  if (!fs.existsSync(path.toString())) return [];
  return fs
    .readdirSync(path.toString(), { withFileTypes: true })
    .filter(
      (x) =>
        x.isDirectory() && !exclude.includes(x.name) && !x.name.startsWith(".")
    );
}

export function toFolderName(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9\-_]/g, "-");
}

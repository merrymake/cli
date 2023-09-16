import http from "http";
import https from "https";
import { SSH_HOST } from "./config";
import path from "path";
import os from "os";
import fs from "fs";
import { exec, spawn } from "child_process";
import { readdirSync } from "node:fs";
import * as conf from "./package.json";
import { COLOR3, NORMAL_COLOR, exit } from "./prompt";

export class Path {
  constructor(private offset = ".") {
    let end = offset.length;
    while (offset.charAt(end - 1) === "/") end--;
    offset = offset.substring(0, end);
  }
  with(next: string) {
    return new Path(path.join(this.offset, next));
  }
  toString() {
    return this.offset;
  }
}

export function getFiles(path: Path, prefix: string): string[] {
  return readdirSync(path.toString(), { withFileTypes: true }).flatMap((x) =>
    x.isDirectory()
      ? getFiles(path.with(x.name), prefix + x.name + "/")
      : [prefix + x.name]
  );
}

const toExecute: (() => void)[] = [];
let dryrun = false;

export function setDryrun() {
  dryrun = true;
}
export function addToExecuteQueue(f: () => void) {
  if (!dryrun) toExecute.push(f);
}

let printOnExit: undefined | string;
export function setExitMessage(str: string) {
  printOnExit = str;
}
export function abort(): never {
  exit();
  if (printOnExit !== undefined) console.log(printOnExit);
  process.exit(0);
}
export async function finish(): Promise<never> {
  try {
    exit();
    for (let i = 0; i < toExecute.length; i++) {
      await toExecute[i]();
    }
    if (printOnExit !== undefined) console.log(printOnExit);
    process.exit(0);
  } catch (e) {
    throw e;
  }
}
export function TODO(): never {
  console.log("TODO");
  exit();
  process.exit(0);
}

export interface OrgFile {
  name: string;
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
  if (fs.existsSync(".mist/conf.json")) {
    let org: OrgFile = JSON.parse("" + fs.readFileSync(`.mist/conf.json`));
    return { org, serviceGroup: null, pathToRoot: "./" };
  }
  if (fs.existsSync(".merrymake/conf.json")) {
    let org: OrgFile = JSON.parse("" + fs.readFileSync(`.merrymake/conf.json`));
    return { org, serviceGroup: null, pathToRoot: "./" };
  }

  let cwd = process.cwd().split(/\/|\\/);
  let out = "";
  let folder = "/";
  let serviceGroup: string | null = null;
  for (let i = cwd.length - 1; i >= 0; i--) {
    if (fs.existsSync(out + "../.mist/conf.json")) {
      serviceGroup = cwd[i];
      let org = <OrgFile>(
        JSON.parse("" + fs.readFileSync(`${out}../.mist/conf.json`))
      );
      return { org, serviceGroup, pathToRoot: out + "../" };
    }
    if (fs.existsSync(out + "../.merrymake/conf.json")) {
      serviceGroup = cwd[i];
      let org = <OrgFile>(
        JSON.parse("" + fs.readFileSync(`${out}../.merrymake/conf.json`))
      );
      return { org, serviceGroup, pathToRoot: out + "../" };
    }
    folder = "/" + cwd[i] + folder;
    out += "../";
  }
  return { org: null, serviceGroup: null, pathToRoot: null };
}
export function fetchOrg() {
  let res = fetchOrgRaw();
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
  let os = old.split(".");
  let ns = new_.split(".");
  if (+os[0] < +ns[0]) return true;
  else if (+os[0] > +ns[0]) return false;
  else if (+os[1] < +ns[1]) return true;
  else if (+os[1] > +ns[1]) return false;
  else if (+os[2] < +ns[2]) return true;
  return false;
}

export function execPromise(cmd: string, cwd?: string) {
  // output("Executing", cmd);
  return new Promise<string>((resolve, reject) => {
    exec(cmd, { cwd }, (error, stdout, stderr) => {
      let err = error?.message || stderr;
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
  let lastCheck = fs.existsSync(historyFolder + updateFile)
    ? +fs.readFileSync(historyFolder + updateFile).toString()
    : 0;
  if (Date.now() - lastCheck > 4 * 60 * 60 * 1000) {
    try {
      let call = await execPromise("npm show @merrymake/cli dist-tags --json");
      let version: { latest: string } = JSON.parse(call);
      if (versionIsOlder(conf.version, version.latest)) {
        setExitMessage(`
${COLOR3}New version of merrymake-cli available, to update run the command:
    npm update -g @merrymake/cli${NORMAL_COLOR}`);
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
    let [cmd, ...args] = full.split(" ");
    let p = spawn(cmd, args, { cwd, shell: "sh" });
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

function sshReqInternal(cmd: string) {
  return execPromise(`ssh mist@${SSH_HOST} "${cmd}"`);
}
export function sshReq(...cmd: string[]) {
  return sshReqInternal(
    cmd
      .map((x) => (x.length === 0 || x.includes(" ") ? `\\"${x}\\"` : x))
      .join(" ")
  );
}

export function partition(str: string, radix: string) {
  let index = str.indexOf(radix);
  if (index < 0) return [str, ""];
  return [str.substring(0, index), str.substring(index + radix.length)];
}

export function urlReq(
  url: string,
  method: "POST" | "GET" = "GET",
  body?: any
) {
  return new Promise<{ body: string; code: number | undefined }>(
    (resolve, reject) => {
      let [protocol, fullPath] =
        url.indexOf("://") >= 0 ? partition(url, "://") : ["http", url];
      let [base, path] = partition(fullPath, "/");
      let [host, port] = partition(base, ":");
      let data = JSON.stringify(body);
      let headers;
      if (body !== undefined)
        headers = {
          "Content-Type": "application/json",
          "Content-Length": data.length,
        };
      let sender = protocol === "http" ? http : https;
      let req = sender.request(
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

export function directoryNames(path: Path, exclude: string[]) {
  if (!fs.existsSync(path.toString())) return [];
  return fs
    .readdirSync(path.toString(), { withFileTypes: true })
    .filter(
      (x) =>
        x.isDirectory() && !exclude.includes(x.name) && !x.name.startsWith(".")
    );
}

import fs from "fs";
import os from "os";
import {
  OrgFile,
  Path,
  execPromise,
  fetchOrg,
  output2,
  addExitMessage,
  sshReq,
  urlReq,
  getCache,
  fetchOrgRaw,
} from "./utils";
import { API_URL, GIT_HOST, SSH_USER } from "./config";
import {
  detectProjectType,
  BUILD_SCRIPT_MAKERS,
} from "@merrymake/detect-project-type";
import { ExecOptions, spawn } from "child_process";
import { RED, YELLOW, NORMAL_COLOR, GREEN } from "./prompt";
import path from "path";
import { getArgs } from "./args";
import { stdout } from "process";
import { BITBUCKET_FILE, bitbucketStep } from "./commands/hosting";

export const SPECIAL_FOLDERS = ["event-catalogue", "public"];

function spawnPromise(str: string) {
  return new Promise<void>((resolve, reject) => {
    let [cmd, ...args] = str.split(" ");
    const options: ExecOptions = {
      cwd: ".",
      shell: "sh",
    };
    let ls = spawn(cmd, args, options);
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

export async function do_build() {
  try {
    let projectType = detectProjectType(".");
    output2(`Building ${projectType} project...`);
    let buildCommands = BUILD_SCRIPT_MAKERS[projectType](".");
    for (let i = 0; i < buildCommands.length; i++) {
      let x = buildCommands[i];
      await spawnPromise(x);
    }
  } catch (e) {
    throw e;
  }
}

export function alignRight(str: string, width: number) {
  return str.length > width
    ? str.substring(0, width - 3) + "..."
    : str.padStart(width, " ");
}

export function alignLeft(str: string, width: number) {
  return str.length > width
    ? str.substring(0, width - 3) + "..."
    : str.padEnd(width, " ");
}

export function printTableHeader(
  prefix: string,
  widths: { [key: string]: number }
) {
  if (getArgs().length > 0) return "";
  let totalWidth = stdout.getWindowSize()[0] - prefix.length;
  let vals = Object.values(widths);
  let rest =
    totalWidth -
    vals.reduce((acc, x) => acc + Math.max(x, 0)) -
    3 * (vals.length - 1);
  let header =
    prefix +
    Object.keys(widths)
      .map((k) =>
        k.trim().padEnd(widths[k] < 0 ? Math.max(rest, -widths[k]) : widths[k])
      )
      .join(" │ ");
  let result = header + "\n";
  let divider =
    prefix +
    Object.keys(widths)
      .map((k) =>
        "─".repeat(widths[k] < 0 ? Math.max(rest, -widths[k]) : widths[k])
      )
      .join("─┼─");
  result += divider;
  return result;
}

export async function do_help() {
  try {
    await urlReq("https://google.com");
  } catch (e) {
    output2(`${RED}No internet connection.${NORMAL_COLOR}`);
    return;
  }
  let whoami = JSON.parse(await sshReq("me-whoami"));
  if (whoami === undefined || whoami.length === 0) {
    let cache = getCache();
    if (!cache.registered) {
      output2(
        `${YELLOW}No key registered with ${process.env["COMMAND"]}.${NORMAL_COLOR}`
      );
    }
    output2(`${RED}No verified email.${NORMAL_COLOR}`);
  } else {
    output2(`${GREEN}Logged in as: ${whoami.join(", ")}.${NORMAL_COLOR}`);
  }
  let rawStruct = fetchOrgRaw();
  if (rawStruct.org === null) {
    output2(`${YELLOW}Not inside organization.${NORMAL_COLOR}`);
  } else {
    output2(
      `${GREEN}Inside organization: ${rawStruct.org.name}${NORMAL_COLOR}`
    );
  }
  if (rawStruct.serviceGroup === null) {
    output2(`${YELLOW}Not inside service group.${NORMAL_COLOR}`);
  } else {
    output2(
      `${GREEN}Inside service group: ${rawStruct.serviceGroup}${NORMAL_COLOR}`
    );
  }
  if (!fs.existsSync("merrymake.json")) {
    output2(`${YELLOW}Not inside service repo.${NORMAL_COLOR}`);
  } else {
    output2(`${GREEN}Inside service repo.${NORMAL_COLOR}`);
  }
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export async function do_spending(org: string) {
  try {
    let rows: {
      mth: string;
      grp: string;
      srv: string;
      hook: string;
      cnt: string;
      time_ms: number;
      cost_eur: string;
    }[] = JSON.parse(await sshReq(`spending`, `--org`, org));
    let mth = 0;
    let grp = "";
    let srv = "";
    rows.forEach((x) => {
      if (x.mth === null) return;
      let nmth = +x.mth;
      if (mth !== nmth) {
        if (mth !== 0) output2("");
        mth = nmth;
        output2(`Month: ${MONTHS[mth - 1]}`);
        printTableHeader("", {
          Group: 11,
          Service: 11,
          Hook: 20,
          Count: 7,
          Time: 7,
          "Est. Cost": 9,
        });
      }
      let group = x.grp === null ? "= Total" : x.grp === grp ? "" : x.grp;
      grp = x.grp;
      let service =
        x.grp === null
          ? ""
          : x.srv === null
          ? "= Total"
          : x.srv === srv
          ? ""
          : x.srv;
      srv = x.srv;
      let count = +x.cnt;
      let count_unit = " ";
      let count_str = "" + count + "  ";
      if (count > 1000) {
        count /= 1000;
        count_unit = "k";
        if (count > 1000) {
          count /= 1000;
          count_unit = "M";
          if (count > 1000) {
            count /= 1000;
            count_unit = "B";
          }
        }
        count_str = count.toFixed(1);
      }
      let time = x.time_ms;
      let time_unit = "ms";
      let time_str = "" + time + " ";
      if (time > 1000) {
        time /= 1000;
        time_unit = "s";
        if (time > 60) {
          time /= 60;
          time_unit = "m";
          if (time > 60) {
            time /= 60;
            time_unit = "h";
            if (time > 24) {
              time /= 24;
              time_unit = "d";
              if (time > 30) {
                time /= 30;
                time_unit = "M";
              }
            }
          }
        }
        time_str = time.toFixed(1);
      }
      let hook = x.srv === null ? "" : x.hook === null ? "= Total" : x.hook;
      output2(
        `${alignLeft(group, 11)} │ ${alignLeft(service, 11)} │ ${alignLeft(
          hook,
          20
        )} │ ${alignRight("" + count_str + " " + count_unit, 7)} │ ${alignRight(
          "" + time_str + " " + time_unit,
          7
        )} │ € ${alignRight(x.cost_eur, 7)}`
      );
    });
  } catch (e) {
    throw e;
  }
}

export async function do_delete_group(org: string, group: string) {
  try {
    output2(await sshReq(`team`, `--delete`, `--org`, org, group));
    if (fs.existsSync(group)) fs.renameSync(group, `(deleted) ${group}`);
  } catch (e) {
    throw e;
  }
}

export async function do_delete_org(org: string) {
  try {
    output2(await sshReq(`org`, `--delete`, org));
    if (fs.existsSync(org)) fs.renameSync(org, `(deleted) ${org}`);
  } catch (e) {
    throw e;
  }
}

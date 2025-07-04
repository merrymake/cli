import { stdout } from "process";
import { outputGit } from "./printUtils.js";
import { sshReq } from "./utils.js";
import { Str } from "@merrymake/utils";
export function alignRight(str, width) {
    return str.length > width
        ? str.substring(0, width - 3) + "..."
        : str.padStart(width, " ");
}
export function alignLeft(str, width) {
    return str.length > width
        ? str.substring(0, width - 3) + "..."
        : str.padEnd(width, " ");
}
export function alignCenter(str, width) {
    const half = ~~((width - str.length) / 2);
    return str.length > width
        ? str.substring(0, width - 3) + "..."
        : "".padStart(half, " ").concat(str).padEnd(width, " ");
}
export function printTableHeader(prefix, widths) {
    const totalWidth = (typeof stdout.getWindowSize !== "function"
        ? 80
        : stdout.getWindowSize()[0]) - prefix.length;
    const vals = Object.values(widths);
    const rest = totalWidth -
        vals.reduce((acc, x) => acc + Math.max(x, 0), 0) -
        3 * (vals.length - 1);
    const header = prefix +
        Object.keys(widths)
            .map((k) => k.padEnd(widths[k] < 0 ? Math.min(rest, -widths[k]) : widths[k]))
            .join(` ${Str.FG_GRAY}│${Str.FG_DEFAULT} `);
    let result = header + "\n";
    const divider = prefix +
        Object.keys(widths)
            .map((k) => "─".repeat(widths[k] < 0 ? Math.min(rest, -widths[k]) : widths[k]))
            .join("─┼─");
    result += Str.FG_GRAY + divider + Str.FG_DEFAULT;
    return result;
}
// export async function do_help() {
//   try {
//     await urlReq("https://google.com");
//   } catch (e) {
//     output2(`${RED}No internet connection.${FG_DEFAULT}`);
//     return;
//   }
//   const whoami = JSON.parse(await sshReq("me-whoami"));
//   if (whoami === undefined || whoami.length === 0) {
//     const cache = getCache();
//     if (!cache.registered) {
//       output2(
//         `${YELLOW}No key registered with ${process.env["COMMAND"]}.${FG_DEFAULT}`
//       );
//     }
//     output2(`${RED}No verified email.${FG_DEFAULT}`);
//   } else {
//     output2(`${GREEN}Logged in as: ${whoami.join(", ")}.${FG_DEFAULT}`);
//   }
//   const rawStruct = fetchOrgRaw();
//   if (rawStruct.org === null) {
//     output2(`${YELLOW}Not inside organization.${FG_DEFAULT}`);
//   } else {
//     output2(
//       `${GREEN}Inside organization: ${rawStruct.org.name}${FG_DEFAULT}`
//     );
//   }
//   if (rawStruct.serviceGroup === null) {
//     output2(`${YELLOW}Not inside service group.${FG_DEFAULT}`);
//   } else {
//     output2(
//       `${GREEN}Inside service group: ${rawStruct.serviceGroup}${FG_DEFAULT}`
//     );
//   }
//   if (!existsSync("merrymake.json")) {
//     output2(`${YELLOW}Not inside service repo.${FG_DEFAULT}`);
//   } else {
//     output2(`${GREEN}Inside service repo.${FG_DEFAULT}`);
//   }
// }
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
export async function do_spending(org) {
    try {
        const rows = JSON.parse(await sshReq(`spending`, `--org`, org));
        let mth = 0;
        let grp = "";
        let srv = "";
        rows.forEach((x) => {
            if (x.mth === null)
                return;
            const nmth = +x.mth;
            if (mth !== nmth) {
                if (mth !== 0)
                    outputGit("");
                mth = nmth;
                outputGit(`Month: ${MONTHS[mth - 1]}`);
                printTableHeader("", {
                    Group: 11,
                    Service: 11,
                    Hook: 20,
                    Count: 7,
                    Time: 7,
                    "Est. Cost": 9,
                });
            }
            const group = x.grp === null ? "= Total" : x.grp === grp ? "" : x.grp;
            grp = x.grp;
            const service = x.grp === null
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
            const hook = x.srv === null ? "" : x.hook === null ? "= Total" : x.hook;
            outputGit(`${alignLeft(group, 11)} ${Str.FG_GRAY}│${Str.FG_DEFAULT} ${alignLeft(service, 11)} ${Str.FG_GRAY}│${Str.FG_DEFAULT} ${alignLeft(hook, 20)} ${Str.FG_GRAY}│${Str.FG_DEFAULT} ${alignRight("" + count_str + " " + count_unit, 7)} ${Str.FG_GRAY}│${Str.FG_DEFAULT} ${alignRight("" + time_str + " " + time_unit, 7)} ${Str.FG_GRAY}│${Str.FG_DEFAULT} € ${alignRight(x.cost_eur, 7)}`);
        });
    }
    catch (e) {
        throw e;
    }
}

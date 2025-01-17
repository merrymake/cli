import { HOURS, Str, UnitType } from "@merrymake/utils";
import { stdout } from "process";
import { getArgs } from "../args.js";
import { alignLeft, alignRight, printTableHeader } from "../executors.js";
import {
  choice,
  GRAY,
  GREEN,
  INVISIBLE,
  NORMAL_COLOR,
  Option,
  RED,
  YELLOW,
} from "../prompt.js";
import { OrganizationId } from "../types.js";
import { sshReq } from "../utils.js";
import { post } from "./post.js";
import { finish } from "../exitMessages.js";
import { outputGit } from "../printUtils.js";

export async function do_queue_time(org: string, time: number) {
  try {
    const resp = await sshReq(`queue`, `--org`, org, `--time`, "" + time);
    const queue: {
      id: string;
      q: string;
      e: string;
      r: string;
      s: string;
    }[] = JSON.parse(resp);
    outputGit(
      printTableHeader("", {
        Id: 6,
        River: 12,
        Event: 12,
        Status: 7,
        "Queue time": 20,
      })
    );
    queue.forEach((x) =>
      outputGit(
        `${x.id} │ ${alignRight(x.r, 12)} │ ${alignLeft(x.e, 12)} │ ${alignLeft(
          x.s,
          7
        )} │ ${new Date(x.q).toLocaleString()}`
      )
    );
  } catch (e) {
    throw e;
  }
}

async function queue_event(id: string) {
  try {
    const res: {
      riverEvent: string;
      status: string;
      startedOn: string;
      memoryKilobytes: number;
      billingDuration: number;
      executionDuration: number;
      output: string;
      repo: string;
    }[] = JSON.parse(await sshReq(`rapids-inspect-trace`, `\\"${id}\\"`));
    res.forEach((r, i) => {
      console.log(" ");
      const prefix = r.repo;
      const color = {
        success: GREEN,
        failure: RED,
        timeout: RED,
        warning: YELLOW,
      }[r.status];
      const output = [
        `${YELLOW}${r.riverEvent}${GRAY} started at ${new Date(
          r.startedOn
        ).toLocaleString()}${NORMAL_COLOR}`,
      ];
      const out = r.output.trimEnd();
      if (out.length > 0) output.push(out);
      output.push(
        `${color}${r.status}${GRAY} after ${Str.withUnit(
          r.executionDuration,
          UnitType.Duration
        )} (billing ${Str.withUnit(
          r.billingDuration,
          UnitType.Duration
        )}) used ${Str.withUnit(
          r.memoryKilobytes,
          UnitType.Memory,
          "kb"
        )} ram${NORMAL_COLOR}`
      );
      Str.print(output.join("\n"), prefix, INVISIBLE, undefined);
    });
    return finish();
    // return choice(
    //   "Do you want to replay this service invocation?",
    //   [
    //     {
    //       long: "replay",
    //       text: "replay service invocation",
    //       action: () => queue_event_replay(org, id, river),
    //     },
    //   ],
    //   { disableAutoPick: true }
    // );
  } catch (e) {
    throw e;
  }
}
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat", "sun"];
function calcQuartile<T>(a: T[], f: (_: T) => number, q: number) {
  // Work out the position in the array of the percentile point
  const p = (a.length - 1) * q;
  const b = Math.floor(p);
  // Work out what we rounded off (if anything)
  const remainder = p - b;
  // See whether that data exists directly
  return a[b + 1] === undefined
    ? f(a[b]) !== null
      ? f(a[b])
      : Number.POSITIVE_INFINITY
    : f(a[b + 1]) !== null && Number.isFinite(f(a[b + 1]))
    ? f(a[b]) + remainder * (f(a[b + 1]) - f(a[b]))
    : Number.POSITIVE_INFINITY;
}
export async function queue(organizationId: OrganizationId) {
  try {
    const arg = getArgs().splice(0, 1)[0];
    if (arg !== undefined) {
      if (["post", "-p"].includes(arg)) return post(organizationId);
      else if (arg[0] !== "-" && arg !== "x") return queue_event(arg);
      getArgs().splice(0, 0, arg);
    }
    const options: (Option & { weight: number })[] = [];
    const resp = await sshReq(
      `rapids-compact-trace`,
      organizationId.toString()
    );
    const parsed: {
      events: string[];
      is: string[];
      es: number[];
      ss: string[];
      ls: string[];
      ds: number[];
      hs: number[];
    } = JSON.parse(resp);
    const longestEvent = parsed.events.reduce(
      (acc, x) => Math.max(acc, x.length),
      5
    );
    const tableHeader =
      "\n" +
      printTableHeader("      ", {
        Event: -longestEvent,
        "S/W/F": 7,
        Count: 5,
        Day: 3,
        "Resp. Time Range": 17,
        Latest: 9,
      });
    const buckets: {
      [key: string]: {
        e: string;
        s: string;
        points: { i: string; l: Date; d: number }[];
      };
    } = {};
    parsed.is.forEach((p, i) => {
      if (buckets[parsed.es[i] + parsed.ss[i] + parsed.hs[i]] === undefined)
        buckets[parsed.es[i] + parsed.ss[i] + parsed.hs[i]] = {
          e: parsed.events[parsed.es[i]],
          s: parsed.ss[i],
          points: [],
        };
      buckets[parsed.es[i] + parsed.ss[i] + parsed.hs[i]].points.push({
        i: parsed.is[i],
        l: new Date(parsed.ls[i]),
        d: parsed.ds[i],
      });
    });
    Object.values(buckets).forEach((p) => {
      p.points.sort((a, b) => a.d - b.d);
      const q1 = calcQuartile(p.points, (a) => a.d, 0.25);
      const q3 = calcQuartile(p.points, (a) => a.d, 0.75);
      const IQR = q3 - q1;
      // Freedman–Diaconis rule
      const RESOLUTION = (2 * IQR) / Math.pow(p.points.length, 1 / 3);
      const histogram: number[] = [];
      const min = p.points[0].d;
      p.points.forEach((x) => {
        const i = ~~((x.d - min) / RESOLUTION);
        histogram[i] = (histogram[i] || 0) + 1;
      });
      const sep: number[] = [];
      let prev = histogram[0];
      let increasing = true;
      for (let i = 0; i < histogram.length; i++) {
        const t = histogram[i] || 0;
        if (increasing && t < prev) {
          increasing = false;
        } else if (!increasing && t > prev) {
          increasing = true;
          sep.push((i - 0.5) * RESOLUTION + min);
        }
        prev = t;
      }
      const buckets: { d: number; i: string; l: Date }[][][] = new Array(7)
        .fill(null)
        .map((x) => new Array(sep.length + 1).fill(null).map((x) => []));
      p.points.forEach((x) => {
        let i = 0;
        while (i < sep.length && sep[i] < x.d) i++;
        buckets[x.l.getDay()][i].push(x);
      });
      buckets.forEach((bw) => {
        bw.forEach((b) => {
          if (b.length === 0) return;
          b.sort((a, b) => a.d - b.d);
          const latest = b.reduce((a, x) => (x.l > a.l ? x : a), b[0]);
          const t = [
            // b[0].d,
            b[Math.round((b.length - 1) / 4)].d,
            b[Math.round((b.length - 1) / 2)].d,
            b[Math.round((3 * (b.length - 1)) / 4)].d,
            // b[b.length - 1].d,
          ];
          const times = t.map((x) =>
            alignRight(
              Number.isFinite(x) ? Str.withUnit(x, UnitType.Duration) : "",
              5
            )
          );
          const empty = alignRight("", 5);
          const [q1, q2, q3] =
            b.length === 1
              ? [empty, NORMAL_COLOR + times[0] + GRAY, empty]
              : b.length === 2
              ? [times[0], empty, times[1]]
              : [times[0], times[1], times[2]];
          const st = p.s.split("/");
          const status =
            p.s === "1/0/0"
              ? GREEN + "succ" + NORMAL_COLOR + "   "
              : p.s === "0/1/0"
              ? YELLOW + "warn" + NORMAL_COLOR + "   "
              : p.s === "0/0/1"
              ? RED + "fail" + NORMAL_COLOR + "   "
              : " ".repeat(7 - p.s.length) +
                (+st[0] > 0 ? GREEN : GRAY) +
                st[0] +
                GRAY +
                "/" +
                (+st[1] > 0 ? YELLOW : "") +
                st[1] +
                GRAY +
                "/" +
                (+st[2] > 0 ? RED : "") +
                st[2] +
                NORMAL_COLOR;
          const timeDiff = Date.now() - latest.l.getTime();
          const time =
            timeDiff < 4 * HOURS
              ? Str.withUnit(timeDiff, UnitType.Duration) + " ago"
              : latest.l.getHours().toString().padStart(2, " ") +
                ":" +
                latest.l.getMinutes().toString().padStart(2, "0") +
                GRAY +
                ":" +
                latest.l.getSeconds().toString().padStart(2, "0") +
                NORMAL_COLOR;
          options.push({
            long: latest.i,
            text: `${alignRight(
              p.e,
              Math.min(
                (typeof stdout.getWindowSize !== "function"
                  ? 80
                  : stdout.getWindowSize()[0]) -
                  41 -
                  "─┼──┼──┼──┼──┼─".length -
                  "> [_] ".length,
                longestEvent
              )
            )} ${GRAY}│${NORMAL_COLOR} ${status} ${GRAY}│${NORMAL_COLOR} ${alignRight(
              b.length === 1 ? "" : b.length.toString(),
              5
            )} ${GRAY}│${NORMAL_COLOR} ${
              WEEKDAYS[latest.l.getDay()]
            } ${GRAY}│${NORMAL_COLOR} ${q1}${GRAY}¦${q2}¦${NORMAL_COLOR}${q3} ${GRAY}│${NORMAL_COLOR} ${time}`,
            action: () => queue_event(latest.i),
            weight: latest.l.getTime(),
          });
        });
      });
    });
    options.sort((a, b) => b.weight - a.weight);
    options.splice(15, options.length);
    options.push({
      long: "post",
      short: "p",
      text: "post message to rapids using an api-key",
      action: () => post(organizationId),
      weight: 0,
    });
    return await choice(
      "Which trace would you like to inspect?" + tableHeader,
      options
    ).then();
  } catch (e) {
    throw e;
  }
}

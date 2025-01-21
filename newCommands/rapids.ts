import { HOURS, is, Str, UnitType } from "@merrymake/utils";
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
        `${x.id} ${GRAY}│${NORMAL_COLOR} ${alignRight(
          x.r,
          12
        )} ${GRAY}│${NORMAL_COLOR} ${alignLeft(
          x.e,
          12
        )} ${GRAY}│${NORMAL_COLOR} ${alignLeft(
          x.s,
          7
        )} ${GRAY}│${NORMAL_COLOR} ${new Date(x.q).toLocaleString()}`
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
    //   "Would you like to replay this service invocation?",
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
function calcQuartile(a: { d: number }[], q: number) {
  // Work out the position in the array of the percentile point
  const p = (a.length - 1) * q;
  const b = Math.floor(p);
  // Work out what we rounded off (if anything)
  const remainder = p - b;
  // See whether that data exists directly
  return a[b + 1] === undefined
    ? a[b].d !== null
      ? a[b].d
      : Number.POSITIVE_INFINITY
    : a[b + 1].d !== null && Number.isFinite(a[b + 1].d)
    ? a[b].d + remainder * (a[b + 1].d - a[b].d)
    : Number.POSITIVE_INFINITY;
}

enum Interest {
  BORING = 1,
  MILDLY_INTERESTING = 2,
  MODERATELY_INTERESTING = 3,
  INTERESTING = 4,
}

function knuthBinWidth(sortedData: { d: number }[]): number {
  // Sort the data
  const n = sortedData.length;
  const range = sortedData[n - 1].d - sortedData[0].d;

  // Implementation of the negative log likelihood function
  function negLogLikelihood(M: number): number {
    const binWidth = range / M;
    const bins = new Array(M).fill(0);

    // Count data points in each bin
    for (const x of sortedData) {
      const binIndex = Math.min(
        Math.floor((x.d - sortedData[0].d) / binWidth),
        M - 1
      );
      bins[binIndex]++;
    }

    // Calculate the log likelihood using Knuth's formula
    let logL =
      n * Math.log(M) +
      logGamma(M / 2) -
      M * logGamma(1 / 2) -
      logGamma((2 * n + M) / 2);

    for (const nk of bins) {
      if (nk > 0) {
        logL += logGamma(nk + 0.5);
      }
    }

    return -logL;
  }

  // Helper function for log gamma
  function logGamma(x: number): number {
    return (
      Math.log(Math.sqrt(2 * Math.PI)) +
      (x - 0.5) * Math.log(x) -
      x +
      1 / (12 * x) -
      1 / (360 * Math.pow(x, 3))
    );
  }

  // Find optimal number of bins using golden section search
  let a = 1;
  let b = Math.ceil(Math.sqrt(n));
  const phi = (1 + Math.sqrt(5)) / 2;
  const resphi = 2 - phi;

  let c = Math.floor(b - (b - a) * resphi);
  let d = Math.floor(a + (b - a) * resphi);
  let fc = negLogLikelihood(c);
  let fd = negLogLikelihood(d);

  while (b - a > 1) {
    if (fc < fd) {
      b = d;
      d = c;
      fd = fc;
      c = Math.floor(b - (b - a) * resphi);
      fc = negLogLikelihood(c);
    } else {
      a = c;
      c = d;
      fc = fd;
      d = Math.floor(a + (b - a) * resphi);
      fd = negLogLikelihood(d);
    }
  }

  const optimalBins = Math.round((a + b) / 2);
  return range / optimalBins;
}

function histogram(
  data: { d: number }[],
  min: number,
  max: number,
  numBins: number = Math.ceil(Math.sqrt(data.length))
): [number[], number] {
  // p.points.sort((a, b) => a.d - b.d);
  // Freedman–Diaconis rule
  // const q1 = calcQuartile(p.points, 0.25);
  // const q3 = calcQuartile(p.points, 0.75);
  // const IQR = q3 - q1;
  // const RESOLUTION = (2 * IQR) / Math.pow(p.points.length, 1 / 3);
  // Knuth's rule
  // const RESOLUTION = knuthBinWidth(p.points);
  // Google sheets' method
  const resolution = (max - min) / (numBins - 1);
  const result: number[] = new Array(numBins).fill(0);
  data.forEach((x) => {
    const i = ~~((x.d - min) / resolution);
    if (!(0 <= i && i < numBins)) console.log(i, x.d, min, resolution);
    result[i]++;
  });
  return [result, resolution];
}

export async function queue(organizationId: OrganizationId) {
  try {
    const arg = getArgs().splice(0, 1)[0];
    if (arg !== undefined) {
      if (["post", "-p"].includes(arg)) return post(organizationId);
      else if (arg[0] !== "-" && arg !== "x") return queue_event(arg);
      getArgs().splice(0, 0, arg);
    }
    const options: (Option & { weight: number } & {
      day: number;
      interest: number;
    })[] = [];
    const resp = await sshReq(`rapids-all-traces`, organizationId.toString());
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
    const size =
      typeof stdout.getWindowSize !== "function"
        ? [80, 15]
        : stdout.getWindowSize();
    const varColumn = Math.min(
      size[0] - 41 - "─┼──┼──┼──┼──┼─".length - "> [_] ".length,
      longestEvent + 1
    );
    const height = size[1] - 7;
    const tableHeader =
      "\n" +
      printTableHeader("      ", {
        Event: varColumn,
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
        max: number;
        min: number;
        points: { i: string; l: Date; d: number }[];
      };
    } = {};
    parsed.is.forEach((p, i) => {
      if (buckets[parsed.es[i] + parsed.ss[i] + parsed.hs[i]] === undefined)
        buckets[parsed.es[i] + parsed.ss[i] + parsed.hs[i]] = {
          e: parsed.events[parsed.es[i]],
          s: parsed.ss[i],
          max: parsed.ds[i],
          min: parsed.ds[i],
          points: [],
        };
      if (
        buckets[parsed.es[i] + parsed.ss[i] + parsed.hs[i]].max < parsed.ds[i]
      )
        buckets[parsed.es[i] + parsed.ss[i] + parsed.hs[i]].max = parsed.ds[i];
      if (
        buckets[parsed.es[i] + parsed.ss[i] + parsed.hs[i]].min > parsed.ds[i]
      )
        buckets[parsed.es[i] + parsed.ss[i] + parsed.hs[i]].min = parsed.ds[i];
      buckets[parsed.es[i] + parsed.ss[i] + parsed.hs[i]].points.push({
        i: parsed.is[i],
        l: new Date(parsed.ls[i]),
        d: parsed.ds[i],
      });
    });
    Object.values(buckets).forEach((p) => {
      // Str.print(JSON.stringify(p.points.map((x) => x.d)));
      const [hg, resolution] = histogram(p.points, p.min, p.max);
      const sep: number[] = [];
      let prev = hg[0];
      let increasing = true;
      for (let i = 0; i < hg.length; i++) {
        const t = hg[i] || 0;
        if (increasing && t < prev) {
          increasing = false;
        } else if (!increasing && t > prev) {
          increasing = true;
          sep.push((i - 0.5) * resolution + p.min);
        }
        prev = t;
      }
      const buckets: { d: number; i: string; l: Date }[][][] = new Array(7)
        .fill(null)
        .map((x) => new Array(sep.length + 1).fill(null).map((x) => []));
      p.points.forEach((x) => {
        let i = 0;
        while (i < sep.length && sep[i] < +x.d) i++;
        buckets[x.l.getDay()][i].push(x);
      });
      buckets.forEach((bw) => {
        bw.forEach((b) => {
          if (b.length === 0) return;
          b.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
          const latest = b.reduce((a, x) => (x.l > a.l ? x : a), b[0]);
          const responseTime = (() => {
            const empty = " ".repeat(5);
            const mid = ~~((b.length - 1) / 2);
            const t = [
              b[Math.floor((b.length - 1) / 4)].d,
              (b[mid].d + b[b.length - 1 - mid].d) / 2,
              b[Math.ceil((3 * (b.length - 1)) / 4)].d,
            ];
            const times = t.map((x) =>
              Number.isFinite(x) ? Str.withUnit(x, UnitType.Duration) : ""
            );
            const [q1, q2, q3] =
              times[0] === times[2]
                ? [empty, Str.alignRight(times[0], 5), empty]
                : b.length === 2
                ? [
                    Str.alignRight(times[0], 5),
                    empty,
                    Str.alignRight(times[1], 5),
                  ]
                : b.length === 3
                ? [
                    Str.alignRight(times[0], 5),
                    Str.alignRight(GRAY + times[1], 5),
                    Str.alignRight(times[2], 5),
                  ]
                : [
                    Str.alignRight(times[0], 5),
                    /*[
                      `${GRAY}<<   `,
                      ` ${GRAY}<   `,
                      `  ${GRAY}|  `,
                      `   ${GRAY}> `,
                      `   ${GRAY}>>`,
                    ]*/
                    GRAY +
                      ["▇▄▃▁▁", "▅▇▄▃▁", "▁▄▇▄▁", "▁▃▄▇▅", "▁▁▃▄▇"][
                        ~~((t[1] - t[0]) / ((t[2] - t[0]) / 5))
                      ],
                    // (() => {
                    //   const slic = b; // b.slice(p[0], p[2]);
                    //   const [hg] = histogram(
                    //     slic,
                    //     slic[0].d,
                    //     slic[slic.length - 1].d,
                    //     5
                    //   );
                    //   console.log(hg);
                    //   const [min, max] = hg.reduce(
                    //     (a, x) => [Math.min(a[0], x), Math.max(a[1], x)],
                    //     [Number.POSITIVE_INFINITY, 0]
                    //   );
                    //   const yStep = (max - min) / 5;
                    //   return hg
                    //     .map((x) => "▁▃▄▅▆▇"[~~((x - min) / yStep)])
                    //     .join("");
                    // })(),
                    Str.alignRight(times[2], 5),
                  ];
            return `${q1}${GRAY}¦${NORMAL_COLOR}${q2}${GRAY}¦${NORMAL_COLOR}${q3}`;
          })();
          const st = p.s.split("/");
          const interest =
            st.length === 1
              ? Interest.BORING
              : +st[2] + +st[1] > 0
              ? Interest.INTERESTING
              : b.length === 1
              ? Interest.MODERATELY_INTERESTING
              : Interest.MILDLY_INTERESTING;
          const status =
            st.length === 1
              ? RED + p.s + NORMAL_COLOR + " ".repeat(7 - p.s.length)
              : p.s === "1/0/0"
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
              ? Str.alignRight(Str.withUnit(timeDiff, UnitType.Duration), 5) +
                " ago"
              : latest.l.getHours().toString().padStart(2, " ") +
                ":" +
                latest.l.getMinutes().toString().padStart(2, "0") +
                GRAY +
                ":" +
                latest.l.getSeconds().toString().padStart(2, "0") +
                NORMAL_COLOR +
                " ";
          options.push({
            long: latest.i,
            text: `${alignRight(
              p.e,
              varColumn
            )} ${GRAY}│${NORMAL_COLOR} ${status} ${GRAY}│${NORMAL_COLOR} ${alignRight(
              b.length === 1 ? "" : b.length.toString(),
              5
            )} ${GRAY}│${NORMAL_COLOR} ${
              WEEKDAYS[latest.l.getDay()]
            } ${GRAY}│${NORMAL_COLOR} ${responseTime} ${GRAY}│${NORMAL_COLOR} ${time}`,
            action: () => queue_event(latest.i),
            weight: latest.l.getTime(),
            day: latest.l.getDay(),
            interest,
          });
        });
      });
    });
    options.sort((a, b) => b.weight - a.weight);
    options.splice(height, options.length);
    let mostInteresting = 0;
    for (let i = 0; i < options.length - 1; i++) {
      if (options[mostInteresting].interest < options[i + 1].interest)
        mostInteresting = i + 1;
      if (options[i].day !== options[i + 1].day)
        options[i].text = options[i].text.replace(
          /( +)/g,
          (s) => `${GRAY}${"_".repeat(s.length)}${NORMAL_COLOR}`
        );
    }
    const opts: Option[] = options;
    opts.push({
      long: "post",
      short: "p",
      text: "post message to rapids using an api-key",
      action: () => post(organizationId),
    });
    return await choice(
      "Which trace would you like to inspect?" + tableHeader,
      opts,
      { def: mostInteresting }
    ).then();
  } catch (e) {
    throw e;
  }
}

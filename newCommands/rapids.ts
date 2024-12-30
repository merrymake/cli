import { stringWithUnit, UnitType } from "@merrymake/utils";
import {
  alignCenter,
  alignLeft,
  alignRight,
  printTableHeader,
} from "../executors.js";
import {
  choice,
  GRAY,
  GREEN,
  NORMAL_COLOR,
  Option,
  RED,
  YELLOW,
} from "../prompt.js";
import { OrganizationId } from "../types.js";
import { finish, outputGit, printWithPrefix, sshReq } from "../utils.js";
import { post } from "./post.js";

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
      const prefix = `${GRAY}${r.repo}: ${NORMAL_COLOR}`;
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
        `${color}${r.status}${GRAY} after ${stringWithUnit(
          r.executionDuration,
          UnitType.Duration
        )} (billing ${stringWithUnit(
          r.billingDuration,
          UnitType.Duration
        )}) used ${stringWithUnit(
          r.memoryKilobytes,
          UnitType.Memory,
          "kb"
        )} ram${NORMAL_COLOR}`
      );
      printWithPrefix(output.join("\n"), prefix);
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

export async function queue(organizationId: OrganizationId) {
  try {
    const options: (Option & { weight: number })[] = [];
    const resp = await sshReq(`rapids-view-trace`, organizationId.toString());
    const parsed: {
      i: string;
      e: string;
      s: string;
      l: string;
      d: number;
      h: number;
    }[] = JSON.parse(resp);
    const tableHeader =
      "\n" +
      printTableHeader("      ", {
        "Initiating Event": 16,
        "S/W/F": 7,
        Count: 5,
        "Resp. Times": 11,
        Latest: 22,
      });
    const buckets: {
      [key: string]: {
        e: string;
        s: string;
        points: { i: string; l: Date; d: number }[];
      };
    } = {};
    parsed.forEach((p) => {
      if (buckets[p.e + p.s + p.h] === undefined)
        buckets[p.e + p.s + p.h] = { e: p.e, s: p.s, points: [] };
      buckets[p.e + p.s + p.h].points.push({
        i: p.i,
        l: new Date(p.l),
        d: p.d,
      });
    });
    Object.values(buckets).forEach((p) => {
      const RESOLUTION = 100;
      const histogram: number[] = [];
      const min = p.points.reduce(
        (a, x) => Math.min(a, x.d),
        Number.POSITIVE_INFINITY
      );
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
      const buckets: { d: number; i: string; l: Date }[][] = new Array(
        sep.length + 1
      )
        .fill(null)
        .map((x) => []);
      p.points.forEach((x) => {
        let i = 0;
        while (i < sep.length && sep[i] < x.d) i++;
        buckets[i].push(x);
      });
      buckets.forEach((b) => {
        b.sort((a, b) => a.d - b.d);
        const latest = b.reduce((a, x) => (x.l > a.l ? x : a), b[0]);
        const min = b[0].d === null ? "∞" : b[0].d.toString();
        const max =
          "" + b[0].d === "" + b[b.length - 1].d
            ? ""
            : b[b.length - 1].d === null
            ? "-∞"
            : "-" + b[b.length - 1].d.toString();
        const status =
          p.s === "1/0/0"
            ? "succ"
            : p.s === "0/1/0"
            ? "warn"
            : p.s === "0/0/1"
            ? "fail"
            : p.s;
        options.push({
          long: latest.i,
          text: `${alignRight(p.e, 16)} │ ${alignCenter(
            status,
            7
          )} │ ${alignRight(
            b.length === 1 ? "" : b.length.toString(),
            5
          )} │ ${alignRight(min, 5)}${alignLeft(max, 6)} │ ${new Date(
            latest.l
          ).toLocaleString()}`,
          action: () => queue_event(latest.i),
          weight: latest.l.getTime(),
        });
      });
    });
    options.push({
      long: "post",
      short: "p",
      text: "post message to rapids using an api-key",
      action: () => post(organizationId),
      weight: 0,
    });
    options.sort((a, b) => b.weight - a.weight);
    return await choice(
      "Which event would you like to inspect?" + tableHeader,
      options
    ).then();
  } catch (e) {
    throw e;
  }
}

import { getArgs, initializeArgs } from "../args";
import { alignLeft, alignRight, printTableHeader } from "../executors";
import { Option, choice, shortText } from "../prompt";
import { addToExecuteQueue, finish, output2, sshReq } from "../utils";
import { post } from "../newCommands/post";
import { OrganizationId } from "../types";

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
    output2(
      printTableHeader("", {
        Id: 6,
        River: 12,
        Event: 12,
        Status: 7,
        "Queue time": 20,
      })
    );
    queue.forEach((x) =>
      output2(
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

async function queue_event(id: string, river: string) {
  try {
    const res = JSON.parse(
      await sshReq(`rapids-inspect`, `\\"${id}\\"`, `--river`, river)
    );
    const resout = res.output;
    delete res.output;
    console.log(res);
    output2("Output:");
    output2(resout);
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

let cache_queue: {
  id: string;
  q: string;
  e: string;
  r: string;
  s: string;
}[];

function queue_id(id: string) {
  const tableHeader = printTableHeader("      ", {
    River: 12,
    Event: 12,
    Status: 7,
    "Queue time": 23,
  });
  return choice(
    "Which event would you like to inspect?\n" + tableHeader,
    cache_queue
      .filter((x) => x.id === id)
      .map((x) => ({
        long: x.r,
        text: `${alignRight(x.r, 12)} │ ${alignLeft(x.e, 12)} │ ${alignLeft(
          x.s,
          7
        )} │ ${new Date(x.q).toLocaleString()}`,
        action: () => queue_event(x.id, x.r),
      })),
    { invertedQuiet: { cmd: true, select: true } }
  ).then();
}

function queue_time_value(org: string, time: number) {
  addToExecuteQueue(() => do_queue_time(org, time));
  return finish();
}

async function queue_time(org: string) {
  try {
    let d = new Date(
      await shortText(
        "Time",
        "Displays events _around_ specified time.",
        "1995-12-17T03:24:00"
      )
    ).getTime();
    while (isNaN(d)) {
      output2("Invalid date, please try again.");
      d = new Date(
        await shortText(
          "Time",
          "Displays events _around_ specified time.",
          "1995-12-17T03:24:00"
        )
      ).getTime();
    }
    return queue_time_value(org, d);
  } catch (e) {
    throw e;
  }
}

const QUEUE_COUNT = 15;
export async function queue(organizationId: OrganizationId) {
  try {
    const options: Option[] = [];
    const resp = await sshReq(`rapids-view`, organizationId.toString());
    cache_queue = JSON.parse(resp);
    const tableHeader =
      "\n" +
      printTableHeader("      ", {
        Id: 21,
        "River/Event": 19,
        Stat: 4,
        "Queue time": 20,
      });
    options.push(
      ...cache_queue.map((x) => ({
        long: x.id,
        text: `${x.id} │ ${alignLeft(x.r + "/" + x.e, 19)} │ ${alignLeft(
          x.s.substring(0, 4),
          4
        )} │ ${new Date(x.q).toLocaleString()}`,
        action: () => {
          if (getArgs().length === 0) initializeArgs([x.r]);
          return queue_id(x.id);
        },
      }))
    );
    options.push({
      long: "post",
      short: "p",
      text: "post message to rapids using an api-key",
      action: () => post(organizationId),
    });
    return await choice(
      "Which event would you like to inspect?" + tableHeader,
      options,
      {
        invertedQuiet: { cmd: false, select: false },
      }
    ).then();
  } catch (e) {
    throw e;
  }
}

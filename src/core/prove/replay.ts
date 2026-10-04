// Playtest replay: the Prove route turned into a timeline for a running bot.
// "Spotted" = the bot is on an exposed stretch (seen from the objective with no cover nearby).
import type { ProveResult } from "../types";

/** Running speed of the replay bot, metres per second (a jogging player). */
export const BOT_SPEED_MPS = 5;

export interface ReplayTimeline {
  /** Time (s) at which the bot reaches each path point. */
  times: number[];
  /** Per path point: true when the bot is exposed there. */
  spotted: boolean[];
  totalSeconds: number;
  spottedSeconds: number;
  /** Longest continuous time in the open (s): "how long you're a sitting duck". */
  longestExposedSeconds: number;
}

export function replayTimeline(prove: ProveResult | undefined): ReplayTimeline | null {
  const path = prove?.path;
  if (!path || path.length < 2) return null;
  const spotted = path.map((_, i) => !(prove?.covered?.[i] ?? false));
  const times = [0];
  let spottedSeconds = 0;
  let run = 0;
  let longest = 0;
  for (let i = 1; i < path.length; i++) {
    const dt = Math.hypot(path[i][0] - path[i - 1][0], path[i][2] - path[i - 1][2]) / BOT_SPEED_MPS;
    times.push(times[i - 1] + dt);
    if (spotted[i] && spotted[i - 1]) {
      spottedSeconds += dt;
      run += dt;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
  }
  return { times, spotted, totalSeconds: times[times.length - 1], spottedSeconds, longestExposedSeconds: longest };
}

/** Position on the path at time t (s), linearly interpolated, plus whether the bot is spotted. */
export function sampleReplay(prove: ProveResult, tl: ReplayTimeline, t: number): { x: number; z: number; heading: number; spotted: boolean } {
  const path = prove.path!;
  const { times } = tl;
  let i = 1;
  while (i < times.length - 1 && times[i] < t) i++;
  const t0 = times[i - 1];
  const t1 = times[i];
  const f = t1 > t0 ? Math.min(1, Math.max(0, (t - t0) / (t1 - t0))) : 1;
  const a = path[i - 1];
  const b = path[i];
  return {
    x: a[0] + (b[0] - a[0]) * f,
    z: a[2] + (b[2] - a[2]) * f,
    heading: Math.atan2(b[0] - a[0], b[2] - a[2]),
    spotted: tl.spotted[f < 0.5 ? i - 1 : i],
  };
}

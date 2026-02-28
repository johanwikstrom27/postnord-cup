"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Player = {
  season_player_id: string;
  name: string;
  avatar_url: string | null;
};

type Props = {
  seasonId: string;
  players: Player[];
};

type Tab = "singles" | "teams";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function shuffle<T>(arr: T[]) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

// Angle helpers:
// We treat "pointer" as pointing straight up (12 o’clock).
// SVG/canvas typical 0° is to the right (3 o’clock) and positive clockwise in CSS.
// We'll compute everything in degrees where 0° is "up" for selection logic.
function normDeg(d: number) {
  let x = d % 360;
  if (x < 0) x += 360;
  return x;
}

function labelShort(name: string) {
  const max = 14;
  return name.length > max ? name.slice(0, max - 1) + "…" : name;
}

function avatarSeed(name: string) {
  // simple stable seed for "fake avatar" circle
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function firstName(name: string) {
  const s = String(name ?? "").trim();
  if (!s) return "Okänd";
  return s.split(/\s+/)[0] ?? s;
}

export default function SpinTheWheelClient({ players }: Props) {
  const [tab, setTab] = useState<Tab>("singles");

  // selection UI
  const [selected, setSelected] = useState<Record<string, boolean>>(() => {
    // default: all selected
    const o: Record<string, boolean> = {};
    for (const p of players) o[p.season_player_id] = true;
    return o;
  });

  const selectedPlayers = useMemo(
    () => players.filter((p) => selected[p.season_player_id]),
    [players, selected]
  );

  // config
  const [simCount, setSimCount] = useState(3); // singles sims
  const [teamSimCount, setTeamSimCount] = useState(3); // teams sims
  const [teamCount, setTeamCount] = useState(6); // number of teams

  // state for wheel
  const [pool, setPool] = useState<Player[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0); // degrees (CSS rotate) where positive rotates clockwise
  const [landed, setLanded] = useState<Player | null>(null);

  // results state
  // singles: each sim has up to 4 players
  const [sims, setSims] = useState<Player[][]>([[], [], []]);

  // teams: simulator → teams → players (2 teams per sim max, but teamCount can exceed sims*2, then overflow teams still exist)
  const [teams, setTeams] = useState<Player[][]>([]);
  const [teamSims, setTeamSims] = useState<Player[][][]>([]); // sim -> teamSlots(2) -> players

  // animation refs
  const rafRef = useRef<number | null>(null);

  // init / reset when tab or key settings change
  useEffect(() => {
    const base = shuffle(selectedPlayers);
    setPool(base);
    setRotation(0);
    setSpinning(false);
    setLanded(null);

    // singles sims
    setSimCount((n) => clamp(n, 2, 3));
    setSims(simCount === 2 ? [[], []] : [[], [], []]);

    // teams
    const tc = clamp(teamCount, 2, 12);
    setTeamCount(tc);
    setTeams(Array.from({ length: tc }, () => []));
    const sc = clamp(teamSimCount, 2, 3);
    setTeamSimCount(sc);

    // each sim has 2 teams (compact)
    setTeamSims(Array.from({ length: sc }, () => [[], []]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selectedPlayers.length]);

  // keep within sane and react immediately to simulator/team count changes
  useEffect(() => {
    if (tab === "singles") {
      const sc = clamp(simCount, 2, 3);
      setSimCount(sc);
      setSims(sc === 2 ? [sims[0] ?? [], sims[1] ?? []] : [sims[0] ?? [], sims[1] ?? [], sims[2] ?? []]);
    } else {
      const sc = clamp(teamSimCount, 2, 3);
      setTeamSimCount(sc);
      setTeamSims((prev) => {
        const base = prev.slice(0, sc);
        while (base.length < sc) base.push([[], []]);
        return base.map((sim) => [sim?.[0] ?? [], sim?.[1] ?? []]);
      });
      const tc = clamp(teamCount, 2, 12);
      setTeamCount(tc);
      setTeams((prev) => {
        const base = prev.slice(0, tc);
        while (base.length < tc) base.push([]);
        return base;
      });
    }
  }, [tab, simCount, teamSimCount, teamCount]);

  function markAll() {
    const o: Record<string, boolean> = {};
    for (const p of players) o[p.season_player_id] = true;
    setSelected(o);
  }

  function clearAll() {
    const o: Record<string, boolean> = {};
    for (const p of players) o[p.season_player_id] = false;
    setSelected(o);
  }

  function togglePlayer(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  // --- assignment logic ---
  function nextSimIndexForSingles(nextPlayer: Player, simsArr: Player[][]) {
    // least filled sim, capacity 4
    let best = -1;
    let bestLen = 999;
    for (let i = 0; i < simsArr.length; i++) {
      const len = simsArr[i].length;
      if (len >= 4) continue;
      if (len < bestLen) {
        bestLen = len;
        best = i;
      }
    }
    return best; // -1 means full
  }

  function findNextTeamSlot(teamsArr: Player[][]) {
    // first team with <2 players
    for (let i = 0; i < teamsArr.length; i++) {
      if (teamsArr[i].length < 2) return i;
    }
    return -1;
  }

  function placeTeamIntoSimulator(teamIndex: number, teamPlayers: Player[], simSlots: Player[][][]) {
    // Each simulator has 2 team slots: [teamA, teamB], each max 2 players.
    // We map teamIndex to a simulator slot if possible (compact): sim = floor(teamIndex / 2), slot = teamIndex % 2
    const simIndex = Math.floor(teamIndex / 2);
    const slotIndex = teamIndex % 2;

    const simsCopy = simSlots.map((s) => [s[0].slice(), s[1].slice()]);
    if (simIndex < simsCopy.length) {
      simsCopy[simIndex][slotIndex] = teamPlayers.slice();
    }
    return simsCopy;
  }

  function stopRaf() {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }

  const POINTER_DEG = 0; // 0 = straight up (12 o'clock)

  function indexAtPointer(rotationDeg: number, n: number, pointerDeg: number = POINTER_DEG) {
    if (n <= 0) return -1;
    const slice = 360 / n;
    const pointerInWheel = normDeg(pointerDeg - rotationDeg);
    return Math.floor(pointerInWheel / slice) % n;
  }

  // --- wheel rendering geometry ---
  // We'll use an SVG wheel with N equal slices.
  // Pointer is at top (12 o’clock). We guarantee selection matches pointer by:
  // 1) choose index i to land on
  // 2) compute target rotation so that center of slice i ends at angle 0 (top)
  // In CSS rotate(deg): rotation is clockwise.
  function computeTargetRotationDeg(index: number, n: number, currentRotation: number, pointerDeg: number = POINTER_DEG) {
    const slice = 360 / n;
    const centerAngleFromUp = index * slice + slice / 2; // 0..360, where 0 is up
    // We want that center angle to be exactly at pointer angle after rotation.
    // If wheel is rotated clockwise by R, then what was at angle A moves to A + R.
    // So we need A + R ≡ pointerDeg (mod 360) => R ≡ pointerDeg - A
    let desired = pointerDeg - centerAngleFromUp;
    // Add extra full spins for drama
    const extraSpins = 5; // slower/longer, feels better
    desired -= 360 * extraSpins;

    let target = desired;
    // Keep moving in the same spin direction and guarantee enough movement.
    const minDelta = 360 * 4;
    while (target > currentRotation - minDelta) target -= 360;
    return target;
  }

  function spinOnce() {
    if (spinning) return;
    if (pool.length === 0) return;

    // if everything is full (singles all sims full OR teams all teams full), still allow spin? No.
    if (tab === "singles") {
      const anySpace = sims.some((s) => s.length < 4);
      if (!anySpace) return;
    } else {
      const teamSlot = findNextTeamSlot(teams);
      if (teamSlot === -1) return;
    }

    setSpinning(true);
    setLanded(null);

    const n = pool.length;
    // choose a random index in pool
    const targetIndex = Math.floor(Math.random() * n);

    // compute rotation to land that slice under pointer
    const startRot = rotation;
    const targetRot = computeTargetRotationDeg(targetIndex, n, startRot, POINTER_DEG);

    // animate (slower)
    const durationMs = 3200; // slower than before
    const start = performance.now();

    stopRaf();
    const tick = (now: number) => {
      const t = clamp((now - start) / durationMs, 0, 1);
      const e = easeOutCubic(t);
      const r = startRot + (targetRot - startRot) * e;
      setRotation(r);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // finished
        rafRef.current = null;

        // Read actual landed slice from stop angle to ensure UI pointer and selected player always match.
        const landedIndex = indexAtPointer(targetRot, n, POINTER_DEG);
        const picked = landedIndex >= 0 ? pool[landedIndex] : null;
        if (!picked) {
          setSpinning(false);
          return;
        }

        setLanded(picked);

        setPool((prev) => {
          const next = prev.slice();
          const idx = next.findIndex((p) => p.season_player_id === picked.season_player_id);
          if (idx >= 0) next.splice(idx, 1);
          return next;
        });

        if (tab === "singles") {
          setSims((prev) => {
            const copy = prev.map((s) => s.slice());
            const si = nextSimIndexForSingles(picked, copy);
            if (si >= 0) copy[si].push(picked);
            return copy;
          });
        } else {
          setTeams((prevTeams) => {
            const copyTeams = prevTeams.map((t) => t.slice());
            const ti = findNextTeamSlot(copyTeams);
            if (ti >= 0) {
              copyTeams[ti].push(picked);

              // also reflect compact sim view
              setTeamSims((prevSims) => {
                // rebuild sim slots from teams (compact mapping)
                let nextSims = prevSims.map((s) => [s[0].slice(), s[1].slice()]);
                // place each team into its sim slot
                for (let teamIndex = 0; teamIndex < copyTeams.length; teamIndex++) {
                  nextSims = placeTeamIntoSimulator(teamIndex, copyTeams[teamIndex], nextSims);
                }
                return nextSims;
              });
            }
            return copyTeams;
          });
        }

        setSpinning(false);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }

  const canSpin = useMemo(() => {
    if (spinning) return false;
    if (pool.length === 0) return false;
    if (tab === "singles") return sims.some((s) => s.length < 4);
    return findNextTeamSlot(teams) !== -1;
  }, [spinning, pool.length, tab, sims, teams]);

  // --- Wheel SVG ---
  const wheelSize = 560; // responsive via CSS too
  const rOuter = 260;
  const rInner = 80;

  function slicePath(i: number, n: number) {
    const slice = (2 * Math.PI) / n;
    const a0 = -Math.PI / 2 + i * slice;
    const a1 = a0 + slice;

    const x0 = rOuter * Math.cos(a0);
    const y0 = rOuter * Math.sin(a0);
    const x1 = rOuter * Math.cos(a1);
    const y1 = rOuter * Math.sin(a1);

    const xi0 = rInner * Math.cos(a0);
    const yi0 = rInner * Math.sin(a0);
    const xi1 = rInner * Math.cos(a1);
    const yi1 = rInner * Math.sin(a1);

    const largeArc = slice > Math.PI ? 1 : 0;

    // ring segment from inner radius to outer radius
    return [
      `M ${xi0} ${yi0}`,
      `L ${x0} ${y0}`,
      `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x1} ${y1}`,
      `L ${xi1} ${yi1}`,
      `A ${rInner} ${rInner} 0 ${largeArc} 0 ${xi0} ${yi0}`,
      "Z",
    ].join(" ");
  }

  // label positioning: place text at mid-angle, at radius between inner+outer
  function labelTransform(i: number, n: number) {
    const slice = 360 / n;
    const mid = i * slice + slice / 2; // degrees from up
    // rotate around center, then translate outward
    const radius = (rInner + rOuter) / 2 + 8;
    // For readability, keep upright-ish: rotate to mid angle, then rotate text by 90 so it reads along radius
    // We'll rotate group to mid, then translate, then rotate text so baseline is tangent
    return { mid, radius };
  }

  const poolCount = pool.length;
  const selectedCount = selectedPlayers.length;
  const wheelLabelSize = poolCount >= 12 ? 14 : poolCount >= 10 ? 15 : 16;

  return (
    <div className="space-y-6">
      {/* Header / Tabs */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">SpinThePostbil</h1>
            <div className="text-sm text-white/60">Lotta spelare till simulatorer och lag</div>
          </div>

          <div className="inline-flex rounded-2xl border border-white/10 bg-black/20 p-1">
            <button
              onClick={() => setTab("singles")}
              className={[
                "px-4 py-2 rounded-2xl text-sm font-semibold transition",
                tab === "singles" ? "bg-white/10 text-white" : "text-white/70 hover:text-white",
              ].join(" ")}
            >
              Vanliga tävlingar
            </button>
            <button
              onClick={() => setTab("teams")}
              className={[
                "px-4 py-2 rounded-2xl text-sm font-semibold transition",
                tab === "teams" ? "bg-white/10 text-white" : "text-white/70 hover:text-white",
              ].join(" ")}
            >
              Lagtävling
            </button>
          </div>
        </div>
      </section>

      {/* Main layout */}
      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Wheel card */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 overflow-hidden">
          <div className="flex flex-col items-center gap-4">
            {/* Wheel wrapper */}
            <div className="relative w-full flex items-center justify-center">
              <div className="relative" style={{ width: "min(92vw, 620px)", height: "min(92vw, 620px)" }}>
                {/* Truck pointer (bigger) */}
                <div className="absolute left-1/2 -top-5 -translate-x-1/2 z-20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/icons/truck-pointer.png"
                    alt="Pointer"
                    className="h-16 w-16 object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.55)]"
                  />
                </div>
                {/* Exact pointer tip used by selection logic */}
                <div className="absolute left-1/2 top-[30px] -translate-x-1/2 z-30">
                  <div className="h-0 w-0 border-l-[9px] border-r-[9px] border-t-[14px] border-l-transparent border-r-transparent border-t-white drop-shadow-[0_2px_5px_rgba(0,0,0,0.8)]" />
                </div>

                {/* Wheel */}
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{
                    transform: `rotate(${rotation}deg)`,
                    transition: spinning ? "none" : "transform 120ms linear",
                  }}
                >
                  <svg
                    viewBox={`${-wheelSize / 2} ${-wheelSize / 2} ${wheelSize} ${wheelSize}`}
                    className="h-full w-full"
                  >
                    {/* outer rim */}
                    <circle r={rOuter + 8} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.10)" strokeWidth="2" />
                    <circle r={rOuter} fill="rgba(0,0,0,0.20)" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />

                    {poolCount > 0 ? (
                      <>
                        {pool.map((p, i) => {
                          const dark = i % 2 === 0;
                          const d = slicePath(i, poolCount);
                          const { mid, radius } = labelTransform(i, poolCount);
                          const text = labelShort(p.name);

                          return (
                            <g key={p.season_player_id}>
                              <path
                                d={d}
                                fill={dark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.09)"}
                                stroke="rgba(255,255,255,0.05)"
                                strokeWidth="1"
                              />
                              <g transform={`rotate(${mid}) translate(0 ${-radius})`}>
                                <text
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                  fill="rgba(255,255,255,0.85)"
                                  fontSize={wheelLabelSize}
                                  fontWeight="600"
                                  style={{ userSelect: "none" }}
                                  transform="rotate(90)"
                                >
                                  {text}
                                </text>
                              </g>
                            </g>
                          );
                        })}
                      </>
                    ) : null}

                    {/* inner hub */}
                    <circle r={rInner + 6} fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.10)" strokeWidth="2" />
                    <circle r={rInner} fill="rgba(0,0,0,0.25)" />

                    {/* center logo */}
                    <g>
                      <circle r={52} fill="rgba(0,0,0,0.25)" stroke="rgba(255,255,255,0.10)" strokeWidth="2" />
                      <foreignObject x={-42} y={-42} width={84} height={84}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/icons/pncuplogga-v4.png"
                          alt="PostNord Cup"
                          style={{ width: "84px", height: "84px", objectFit: "contain" }}
                        />
                      </foreignObject>
                    </g>
                  </svg>
                </div>
              </div>
            </div>

            {/* Spin button */}
            <button
              onClick={spinOnce}
              disabled={!canSpin}
              className="relative overflow-hidden rounded-2xl px-8 py-3 text-sm font-semibold
                bg-gradient-to-br from-emerald-500/90 to-emerald-600 text-white
                shadow-lg shadow-emerald-900/30 hover:from-emerald-400 hover:to-emerald-600
                disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {spinning ? "Snurrar…" : "Snurra"}
              <span className="absolute inset-0 rounded-2xl ring-1 ring-white/15" />
            </button>
          </div>
        </div>

        {/* Side panel */}
        <aside className="space-y-6">
          {/* Landed */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm text-white/60 mb-1">Vald spelare</div>
            {landed ? (
              <div className="flex items-center gap-3">
                <div
                  className="h-12 w-12 overflow-hidden rounded-2xl border border-white/10 bg-black/30 shrink-0"
                  title={landed.name}
                >
                  {landed.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={landed.avatar_url} alt={landed.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-white/80">
                      {String(avatarSeed(landed.name)).slice(0, 2)}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-xl font-semibold truncate">{firstName(landed.name)}</div>
                  <div className="text-sm text-white/60">Tilldelad automatiskt ✅</div>
                </div>
              </div>
            ) : (
              <div className="text-white/60">Snurra för att välja nästa.</div>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between">
              <div className="text-sm text-white/70">🎯 Pool: {poolCount}</div>
              <div className="text-sm text-white/70">✅ Valda: {selectedCount}</div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={markAll}
                className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/15"
              >
                Markera alla
              </button>
              <button
                onClick={clearAll}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold hover:bg-white/10"
              >
                Rensa
              </button>
            </div>

            {/* Config */}
            <div className="mt-5 space-y-3">
              {tab === "singles" ? (
                <label className="flex items-center justify-between gap-3">
                  <span className="text-sm text-white/70">🖥️ Simulatorer</span>
                  <select
                    value={simCount}
                    onChange={(e) => setSimCount(Number(e.target.value))}
                    className="w-28 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm"
                  >
                    <option value={2}>2 sim</option>
                    <option value={3}>3 sim</option>
                  </select>
                </label>
              ) : (
                <>
                  <label className="flex items-center justify-between gap-3">
                    <span className="text-sm text-white/70">🖥️ Simulatorer</span>
                    <select
                      value={teamSimCount}
                      onChange={(e) => setTeamSimCount(Number(e.target.value))}
                      className="w-28 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm"
                    >
                      <option value={2}>2 sim</option>
                      <option value={3}>3 sim</option>
                    </select>
                  </label>

                  <label className="flex items-center justify-between gap-3">
                    <span className="text-sm text-white/70">👥 Antal lag</span>
                    <input
                      type="number"
                      min={2}
                      max={12}
                      value={teamCount}
                      onChange={(e) => setTeamCount(clamp(Number(e.target.value || 2), 2, 12))}
                      className="w-28 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-right"
                    />
                  </label>

                  <div className="text-xs text-white/50">
                    Lagtävling: max 2 pers/lag, max 4 pers/sim (2 lag per sim).
                  </div>
                </>
              )}
            </div>
          </div>
        </aside>
      </section>

      {/* Results */}
      <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
        {tab === "singles" ? (
          <div className="space-y-4">
            <div className="text-lg font-semibold">Simulatorer</div>
            <div className={`grid gap-4 ${simCount === 2 ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
              {sims.map((sim, i) => (
                <div key={i} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-sm font-semibold mb-3">Simulator {i + 1}</div>
                  {sim.length === 0 ? (
                    <div className="text-sm text-white/50">Inget än.</div>
                  ) : (
                    <div className="space-y-2">
                      {sim.map((p) => (
                        <div
                          key={p.season_player_id}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
                        >
                          {p.name}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 text-xs text-white/50">{sim.length}/4</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-lg font-semibold">Simulatorer & lag</div>
            <div className={`grid gap-4 ${teamSimCount === 2 ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
              {teamSims.map((sim, si) => (
                <div key={si} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold">Simulator {si + 1}</div>
                    <div className="text-xs text-white/50">
                      {sim[0].length + sim[1].length}/4
                    </div>
                  </div>

                  <div className="grid gap-3">
                    {sim.map((teamSlot, ti) => {
                      const globalTeamIndex = si * 2 + ti;
                      return (
                        <div key={ti} className="rounded-xl border border-white/10 bg-white/5 p-3">
                          <div className="text-xs text-white/60 mb-2">Lag {globalTeamIndex + 1}</div>
                          {teamSlot.length === 0 ? (
                            <div className="text-sm text-white/50">Tomt</div>
                          ) : (
                            <div className="space-y-2">
                              {teamSlot.map((p) => (
                                <div
                                  key={p.season_player_id}
                                  className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
                                >
                                  {p.name}
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="mt-2 text-xs text-white/50">{teamSlot.length}/2</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* overflow teams (if teamCount > teamSimCount*2) */}
            {teamCount > teamSimCount * 2 ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-sm font-semibold mb-2">Övriga lag (utan simulator-slot)</div>
                <div className="grid gap-3 md:grid-cols-3">
                  {teams.slice(teamSimCount * 2).map((t, idx) => {
                    const teamIndex = teamSimCount * 2 + idx;
                    return (
                      <div key={teamIndex} className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <div className="text-xs text-white/60 mb-2">Lag {teamIndex + 1}</div>
                        {t.length === 0 ? (
                          <div className="text-sm text-white/50">Tomt</div>
                        ) : (
                          <div className="space-y-2">
                            {t.map((p) => (
                              <div
                                key={p.season_player_id}
                                className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
                              >
                                {p.name}
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="mt-2 text-xs text-white/50">{t.length}/2</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>

      {/* Player picker */}
      <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="text-lg font-semibold mb-4">Deltagare</div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {players.map((p) => {
            const checked = !!selected[p.season_player_id];
            return (
              <label
                key={p.season_player_id}
                className={[
                  "flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 cursor-pointer select-none",
                  checked ? "border-emerald-400/25 bg-emerald-400/5" : "border-white/10 bg-black/20 hover:bg-black/25",
                ].join(" ")}
              >
                <span className="min-w-0">
                  <span className="font-semibold truncate block">{p.name}</span>
                </span>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => togglePlayer(p.season_player_id)}
                />
              </label>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export type Circuit = {
  id: string;
  name: string;
  available: boolean;
  music?: { file: string; gain: number };
};
export type StageResult = { driver: string; place: number };
export const seasonLengths = [2, 3, 4, 5, 6, 7, 8] as const;
export const forestCircuit: Circuit = {
  id: "bosque",
  name: "Whispering Woods",
  available: true,
  music: { file: "bosque-theme.wav", gain: .52 },
};
export const circuits: readonly Circuit[] = [forestCircuit];
export const pointsByPlace = [25, 18, 15, 12, 10, 8, 6, 4] as const;

export function championshipCalendar(count: number, catalog = circuits) {
  const available = catalog.filter(track => track.available);
  return Array.from({ length: count }, (_, index) => ({
    number: index + 1,
    circuit: available[index] ?? null,
  }));
}

export function championshipStandings(stages: readonly (readonly StageResult[])[]) {
  const standings = new Map<string, { driver: string; points: number; wins: number }>();
  for (const stage of stages) {
    const registered = new Set<string>();
    for (const result of stage) {
      if (registered.has(result.driver) || !Number.isInteger(result.place) || result.place < 1) continue;
      registered.add(result.driver);
      const row = standings.get(result.driver) ?? { driver: result.driver, points: 0, wins: 0 };
      row.points += pointsByPlace[result.place - 1] ?? 0;
      row.wins += Number(result.place === 1);
      standings.set(result.driver, row);
    }
  }
  return [...standings.values()].sort((a,b) => b.points - a.points || b.wins - a.wins || a.driver.localeCompare(b.driver));
}

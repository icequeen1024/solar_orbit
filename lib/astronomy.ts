export const AU_IN_KM = 149_597_870.7;
export const DAY_MS = 86_400_000;
export const JULIAN_CENTURY_DAYS = 36_525;
export const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
export const RANGE_START_MS = Date.UTC(2000, 0, 1, 0, 0, 0);
export const RANGE_END_MS = Date.UTC(4000, 0, 1, 0, 0, 0);

export const PLANET_IDS = [
  "mercury",
  "venus",
  "earth",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
] as const;

export type PlanetId = (typeof PLANET_IDS)[number];

type OrbitalPair = readonly [base: number, ratePerCentury: number];

type PlanetDefinition = {
  id: PlanetId;
  name: string;
  radiusKm: number;
  color: string;
  accent: string;
  a: OrbitalPair;
  e: OrbitalPair;
  inclination: OrbitalPair;
  meanLongitude: OrbitalPair;
  longitudePerihelion: OrbitalPair;
  longitudeNode: OrbitalPair;
  correction?: readonly [b: number, c: number, s: number, f: number];
};

// NASA/JPL Solar System Dynamics, Table 2a/2b: approximate planetary positions.
// The source fit is valid from 3000 BCE to 3000 CE. The product deliberately
// extrapolates its secular rates from 3000 to 4000 CE and discloses that limit.
export const PLANETS: readonly PlanetDefinition[] = [
  {
    id: "mercury",
    name: "Mercury",
    radiusKm: 2_439.4,
    color: "#aeb1ae",
    accent: "#d6d7d2",
    a: [0.38709843, 0],
    e: [0.20563661, 0.00002123],
    inclination: [7.00559432, -0.00590158],
    meanLongitude: [252.25166724, 149472.67486623],
    longitudePerihelion: [77.45771895, 0.15940013],
    longitudeNode: [48.33961819, -0.12214182],
  },
  {
    id: "venus",
    name: "Venus",
    radiusKm: 6_051.8,
    color: "#d9a95f",
    accent: "#f0c985",
    a: [0.72332102, -0.00000026],
    e: [0.00676399, -0.00005107],
    inclination: [3.39777545, 0.00043494],
    meanLongitude: [181.9797085, 58517.8156026],
    longitudePerihelion: [131.76755713, 0.05679648],
    longitudeNode: [76.67261496, -0.27274174],
  },
  {
    id: "earth",
    name: "Earth",
    radiusKm: 6_371.0,
    color: "#4f8fbf",
    accent: "#82b8dc",
    a: [1.00000018, -0.00000003],
    e: [0.01673163, -0.00003661],
    inclination: [-0.00054346, -0.01337178],
    meanLongitude: [100.46691572, 35999.37306329],
    longitudePerihelion: [102.93005885, 0.3179526],
    longitudeNode: [-5.11260389, -0.24123856],
  },
  {
    id: "mars",
    name: "Mars",
    radiusKm: 3_389.5,
    color: "#b95e43",
    accent: "#db856c",
    a: [1.52371243, 0.00000097],
    e: [0.09336511, 0.00009149],
    inclination: [1.85181869, -0.00724757],
    meanLongitude: [-4.56813164, 19140.29934243],
    longitudePerihelion: [-23.91744784, 0.45223625],
    longitudeNode: [49.71320984, -0.26852431],
  },
  {
    id: "jupiter",
    name: "Jupiter",
    radiusKm: 69_911,
    color: "#c49b70",
    accent: "#e4c49c",
    a: [5.20248019, -0.00002864],
    e: [0.0485359, 0.00018026],
    inclination: [1.29861416, -0.00322699],
    meanLongitude: [34.33479152, 3034.90371757],
    longitudePerihelion: [14.27495244, 0.18199196],
    longitudeNode: [100.29282654, 0.13024619],
    correction: [-0.00012452, 0.0606406, -0.35635438, 38.35125],
  },
  {
    id: "saturn",
    name: "Saturn",
    radiusKm: 58_232,
    color: "#d7bd78",
    accent: "#ead59c",
    a: [9.54149883, -0.00003065],
    e: [0.05550825, -0.00032044],
    inclination: [2.49424102, 0.00451969],
    meanLongitude: [50.07571329, 1222.11494724],
    longitudePerihelion: [92.86136063, 0.54179478],
    longitudeNode: [113.63998702, -0.25015002],
    correction: [0.00025899, -0.13434469, 0.87320147, 38.35125],
  },
  {
    id: "uranus",
    name: "Uranus",
    radiusKm: 25_362,
    color: "#72b9c5",
    accent: "#a5dbe3",
    a: [19.18797948, -0.00020455],
    e: [0.0468574, -0.0000155],
    inclination: [0.77298127, -0.00180155],
    meanLongitude: [314.20276625, 428.49512595],
    longitudePerihelion: [172.43404441, 0.09266985],
    longitudeNode: [73.96250215, 0.05739699],
    correction: [0.00058331, -0.97731848, 0.17689245, 7.67025],
  },
  {
    id: "neptune",
    name: "Neptune",
    radiusKm: 24_622,
    color: "#4168aa",
    accent: "#7295d1",
    a: [30.06952752, 0.00006447],
    e: [0.00895439, 0.00000818],
    inclination: [1.7700552, 0.000224],
    meanLongitude: [304.22289287, 218.46515314],
    longitudePerihelion: [46.68158724, 0.01009938],
    longitudeNode: [131.78635853, -0.00606302],
    correction: [-0.00041348, 0.68346318, -0.10162547, 7.67025],
  },
] as const;

export const SUN = {
  name: "Sun",
  radiusKm: 695_700,
  color: "#f2b84b",
  accent: "#ffe1a0",
} as const;

export type Point3 = { x: number; y: number; z: number };
export type PlanetPosition = Point3 & {
  id: PlanetId;
  distanceFromSunAu: number;
};

const PLANET_BY_ID = new Map(PLANETS.map((planet) => [planet.id, planet]));
const DEG = Math.PI / 180;

function elementAt([base, rate]: OrbitalPair, centuries: number) {
  return base + rate * centuries;
}

function normalizeRadians(value: number) {
  const fullTurn = Math.PI * 2;
  const normalized = value % fullTurn;
  return normalized > Math.PI
    ? normalized - fullTurn
    : normalized < -Math.PI
      ? normalized + fullTurn
      : normalized;
}

function solveEccentricAnomaly(meanAnomaly: number, eccentricity: number) {
  let eccentricAnomaly = meanAnomaly + eccentricity * Math.sin(meanAnomaly);
  for (let iteration = 0; iteration < 12; iteration += 1) {
    const delta =
      (meanAnomaly -
        (eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly))) /
      (1 - eccentricity * Math.cos(eccentricAnomaly));
    eccentricAnomaly += delta;
    if (Math.abs(delta) < 1e-12) break;
  }
  return eccentricAnomaly;
}

function orbitalState(planet: PlanetDefinition, daysSinceJ2000: number) {
  const centuries = daysSinceJ2000 / JULIAN_CENTURY_DAYS;
  const a = elementAt(planet.a, centuries);
  const e = elementAt(planet.e, centuries);
  const inclination = elementAt(planet.inclination, centuries) * DEG;
  const meanLongitude = elementAt(planet.meanLongitude, centuries);
  const longitudePerihelion = elementAt(
    planet.longitudePerihelion,
    centuries,
  );
  const longitudeNode = elementAt(planet.longitudeNode, centuries) * DEG;
  const argumentPerihelion = longitudePerihelion * DEG - longitudeNode;

  let meanAnomalyDegrees = meanLongitude - longitudePerihelion;
  if (planet.correction) {
    const [b, c, s, f] = planet.correction;
    meanAnomalyDegrees +=
      b * centuries * centuries +
      c * Math.cos(f * centuries * DEG) +
      s * Math.sin(f * centuries * DEG);
  }

  return {
    a,
    e,
    inclination,
    longitudeNode,
    argumentPerihelion,
    meanAnomaly: normalizeRadians(meanAnomalyDegrees * DEG),
  };
}

function rotateFromOrbitalPlane(
  xPrime: number,
  yPrime: number,
  argumentPerihelion: number,
  longitudeNode: number,
  inclination: number,
): Point3 {
  const cosW = Math.cos(argumentPerihelion);
  const sinW = Math.sin(argumentPerihelion);
  const cosO = Math.cos(longitudeNode);
  const sinO = Math.sin(longitudeNode);
  const cosI = Math.cos(inclination);
  const sinI = Math.sin(inclination);

  return {
    x:
      (cosW * cosO - sinW * sinO * cosI) * xPrime +
      (-sinW * cosO - cosW * sinO * cosI) * yPrime,
    y:
      (cosW * sinO + sinW * cosO * cosI) * xPrime +
      (-sinW * sinO + cosW * cosO * cosI) * yPrime,
    z: sinW * sinI * xPrime + cosW * sinI * yPrime,
  };
}

export function daysSinceJ2000(dateMs: number) {
  return (dateMs - J2000_MS) / DAY_MS;
}

export function planetPositionAtDays(
  id: PlanetId,
  daysFromJ2000: number,
): PlanetPosition {
  const planet = PLANET_BY_ID.get(id);
  if (!planet) throw new Error(`Unknown planet: ${id}`);

  const state = orbitalState(planet, daysFromJ2000);
  const eccentricAnomaly = solveEccentricAnomaly(
    state.meanAnomaly,
    state.e,
  );
  const xPrime = state.a * (Math.cos(eccentricAnomaly) - state.e);
  const yPrime =
    state.a * Math.sqrt(1 - state.e * state.e) * Math.sin(eccentricAnomaly);
  const point = rotateFromOrbitalPlane(
    xPrime,
    yPrime,
    state.argumentPerihelion,
    state.longitudeNode,
    state.inclination,
  );

  return {
    id,
    ...point,
    distanceFromSunAu: Math.hypot(point.x, point.y, point.z),
  };
}

export function planetPosition(id: PlanetId, dateMs: number) {
  return planetPositionAtDays(id, daysSinceJ2000(dateMs));
}

export function allPlanetPositions(dateMs: number) {
  const days = daysSinceJ2000(dateMs);
  return PLANET_IDS.map((id) => planetPositionAtDays(id, days));
}

export function physicalDistance(a: Point3, b: Point3) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function nearestPlanetFromPositions(
  selected: PlanetId,
  positions: readonly PlanetPosition[],
  included: readonly PlanetId[] = PLANET_IDS,
) {
  const selectedPosition = positions.find((position) => position.id === selected);
  if (!selectedPosition) throw new Error(`Missing position for ${selected}`);
  const includedIds = new Set(included);

  let nearest: PlanetPosition | undefined;
  let distanceAu = Number.POSITIVE_INFINITY;

  for (const position of positions) {
    if (position.id === selected || !includedIds.has(position.id)) continue;
    const candidateDistance = physicalDistance(selectedPosition, position);
    const shouldReplaceTie =
      nearest &&
      Math.abs(candidateDistance - distanceAu) <= 1e-12 &&
      PLANET_IDS.indexOf(position.id) < PLANET_IDS.indexOf(nearest.id);
    if (candidateDistance < distanceAu - 1e-12 || shouldReplaceTie) {
      nearest = position;
      distanceAu = candidateDistance;
    }
  }

  if (!nearest) throw new Error(`No nearest planet found for ${selected}`);
  return { planet: nearest, distanceAu };
}

export function nearestPlanet(selected: PlanetId, dateMs: number) {
  return nearestPlanetFromPositions(selected, allPlanetPositions(dateMs));
}

export function sampleOrbit(
  id: PlanetId,
  dateMs: number,
  sampleCount = 180,
) {
  const planet = PLANET_BY_ID.get(id);
  if (!planet) throw new Error(`Unknown planet: ${id}`);
  const state = orbitalState(planet, daysSinceJ2000(dateMs));
  const points: Point3[] = [];

  for (let index = 0; index <= sampleCount; index += 1) {
    const eccentricAnomaly = (index / sampleCount) * Math.PI * 2;
    const xPrime = state.a * (Math.cos(eccentricAnomaly) - state.e);
    const yPrime =
      state.a * Math.sqrt(1 - state.e * state.e) * Math.sin(eccentricAnomaly);
    points.push(
      rotateFromOrbitalPlane(
        xPrime,
        yPrime,
        state.argumentPerihelion,
        state.longitudeNode,
        state.inclination,
      ),
    );
  }

  return points;
}

export function getPlanet(id: PlanetId) {
  const planet = PLANET_BY_ID.get(id);
  if (!planet) throw new Error(`Unknown planet: ${id}`);
  return planet;
}

export function isPlanetId(value: unknown): value is PlanetId {
  return typeof value === "string" && PLANET_IDS.includes(value as PlanetId);
}

export function clampToRange(dateMs: number) {
  return Math.min(RANGE_END_MS, Math.max(RANGE_START_MS, dateMs));
}

export function formatDistance(distanceAu: number) {
  const millionKm = (distanceAu * AU_IN_KM) / 1_000_000;
  return {
    au: `${distanceAu.toFixed(distanceAu < 1 ? 3 : 2)} AU`,
    millionKm: `${millionKm.toFixed(millionKm < 10 ? 2 : 1)} million km`,
  };
}

export const MODEL_METADATA = {
  id: "jpl-keplerian-table-2-v1",
  title: "NASA/JPL approximate Keplerian elements",
  sourceUrl: "https://ssd.jpl.nasa.gov/planets/approx_pos.html",
  fittedThroughYear: 3000,
  productEndYear: 4000,
  extrapolationDisclosure:
    "NASA/JPL's element fit ends at 3000 CE. Secular rates are extrapolated from 3000 to 4000 CE, so later positions are illustrative.",
} as const;

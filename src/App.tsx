import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import nearestStatisticsJson from "../data/nearest-percentages.json";
import {
  MODEL_METADATA,
  PLANETS,
  PLANET_IDS,
  RANGE_END_MS,
  RANGE_START_MS,
  SUN,
  allPlanetPositions,
  clampToRange,
  formatDistance,
  getPlanet,
  isPlanetId,
  nearestPlanetFromPositions,
  sampleOrbit,
  type PlanetId,
  type PlanetPosition,
  type Point3,
} from "../lib/astronomy";
import {
  percentagesAt,
  prepareFilteredNearestTimeline,
  type RankedTimelines,
} from "../lib/nearest-statistics";
import { playbackDirectionFromBoundary } from "../lib/playback";

type StatisticsFile = {
  method: {
    sampleHours: number;
    transitionToleranceMinutes: number;
    samples: number;
    detectedRankingTransitions: number;
  };
  rankings: RankedTimelines;
};

type Camera = { zoom: number; panX: number; panY: number };
type ScreenPoint = { x: number; y: number };
type HitRegion = {
  id: PlanetId;
  body: ScreenPoint;
  label: { x: number; y: number; width: number; height: number };
  line: { start: ScreenPoint; end: ScreenPoint };
};

const statistics = nearestStatisticsJson as unknown as StatisticsFile;
const STORAGE_KEY = "solar-orbit-state-v1";
const MAX_CUSTOM_MULTIPLIER = 1_000_000_000_000;
const YEAR_SECONDS = 365.25 * 24 * 60 * 60;

const SPEED_PRESETS = [
  { id: "realtime", label: "Real time", shortLabel: "1×", multiplier: 1 },
  { id: "day", label: "1 day / sec", shortLabel: "1 d/s", multiplier: 86_400 },
  {
    id: "month",
    label: "30 days / sec",
    shortLabel: "30 d/s",
    multiplier: 30 * 86_400,
  },
  {
    id: "year",
    label: "1 year / sec",
    shortLabel: "1 y/s",
    multiplier: YEAR_SECONDS,
  },
  {
    id: "decade",
    label: "10 years / sec",
    shortLabel: "10 y/s",
    multiplier: YEAR_SECONDS * 10,
  },
] as const;

const LABEL_OFFSETS: Record<PlanetId, [number, number]> = {
  mercury: [30, -60],
  venus: [36, 36],
  earth: [34, -32],
  mars: [36, 24],
  jupiter: [42, -36],
  saturn: [44, 30],
  uranus: [42, -32],
  neptune: [42, 24],
};

function formatDate(dateMs: number) {
  const date = new Date(dateMs);
  const month = new Intl.DateTimeFormat("en-US", {
    month: "short",
    timeZone: "UTC",
  })
    .format(date)
    .toUpperCase();
  const day = String(date.getUTCDate()).padStart(2, "0");
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${month} ${day} ${year} · ${hours}:${minutes} UTC`;
}

function toDateTimeInput(dateMs: number) {
  const date = new Date(dateMs);
  return `${String(date.getUTCFullYear()).padStart(4, "0")}-${String(
    date.getUTCMonth() + 1,
  ).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}T${String(
    date.getUTCHours(),
  ).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

function formatPercentageRange(dateMs: number) {
  if (dateMs <= RANGE_START_MS) return "Starting at Jan 1, 2000";
  const date = new Date(dateMs);
  const month = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ][date.getUTCMonth()];
  return `Jan 1, 2000–${month} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

function parseDateTimeInput(value: string) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return Number.NaN;
  const [, year, month, day, hour, minute] = match;
  return Date.UTC(+year, +month - 1, +day, +hour, +minute, 0, 0);
}

function pointToSegmentDistance(
  point: ScreenPoint,
  start: ScreenPoint,
  end: ScreenPoint,
) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) /
        lengthSquared,
    ),
  );
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

function BodyIcon({ id, size = 24 }: { id: PlanetId; size?: number }) {
  const planet = getPlanet(id);
  return (
    <span
      aria-hidden="true"
      className={`body-icon body-icon--${id}`}
      style={
        {
          "--body-color": planet.color,
          "--body-accent": planet.accent,
          "--body-size": `${size}px`,
        } as CSSProperties
      }
    />
  );
}

function drawArrow(
  context: CanvasRenderingContext2D,
  from: ScreenPoint,
  to: ScreenPoint,
  color: string,
) {
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(from.x, from.y);
  context.lineTo(to.x, to.y);
  context.stroke();

  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const arrowSize = 4;
  context.beginPath();
  context.moveTo(to.x, to.y);
  context.lineTo(
    to.x - Math.cos(angle - Math.PI / 6) * arrowSize,
    to.y - Math.sin(angle - Math.PI / 6) * arrowSize,
  );
  context.lineTo(
    to.x - Math.cos(angle + Math.PI / 6) * arrowSize,
    to.y - Math.sin(angle + Math.PI / 6) * arrowSize,
  );
  context.closePath();
  context.fill();
}

function OrbitCanvas({
  dateMs,
  positions,
  selected,
  nearest,
  included,
  camera,
  onCameraChange,
  onSelect,
}: {
  dateMs: number;
  positions: readonly PlanetPosition[];
  selected: PlanetId | null;
  nearest: PlanetId | null;
  included: ReadonlySet<PlanetId>;
  camera: Camera;
  onCameraChange: (camera: Camera) => void;
  onSelect: (planet: PlanetId) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hitRegionsRef = useRef<HitRegion[]>([]);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originPanX: number;
    originPanY: number;
    moved: boolean;
  } | null>(null);
  const [dimensions, setDimensions] = useState({ width: 1, height: 1 });
  const [hovered, setHovered] = useState<PlanetId | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setDimensions({ width, height });
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  const orbitEpoch = Math.floor(new Date(dateMs).getUTCFullYear() / 10) * 10;
  const orbitPaths = useMemo(() => {
    const epoch = Date.UTC(orbitEpoch, 0, 1, 0, 0, 0);
    return Object.fromEntries(
      PLANET_IDS.map((id) => [id, sampleOrbit(id, epoch, 150)]),
    ) as Record<PlanetId, Point3[]>;
  }, [orbitEpoch]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width < 2 || dimensions.height < 2) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(dimensions.width * pixelRatio);
    canvas.height = Math.floor(dimensions.height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, dimensions.width, dimensions.height);

    const center = {
      x: dimensions.width / 2 + camera.panX,
      y: dimensions.height / 2 - 10 + camera.panY,
    };
    const minDimension = Math.min(dimensions.width, dimensions.height);
    const systemRadius = minDimension * 0.43 * camera.zoom;
    const maxPhysicalRadius = 31;

    const toScreen = (point: Point3): ScreenPoint => {
      const radius = Math.hypot(point.x, point.y);
      if (radius < 1e-10) return center;
      const compressedRadius =
        (Math.log1p(radius) / Math.log1p(maxPhysicalRadius)) * systemRadius;
      return {
        x: center.x + (point.x / radius) * compressedRadius,
        y: center.y - (point.y / radius) * compressedRadius,
      };
    };

    // A sparse, deterministic field gives depth without competing with labels.
    context.fillStyle = "rgba(224, 219, 195, 0.24)";
    for (let index = 0; index < 110; index += 1) {
      const x = ((index * 73.17) % 101) / 101;
      const y = ((index * 41.73 + 17) % 97) / 97;
      const size = index % 13 === 0 ? 1.2 : 0.65;
      context.beginPath();
      context.arc(x * dimensions.width, y * dimensions.height, size, 0, Math.PI * 2);
      context.fill();
    }

    for (const planet of PLANETS) {
      const path = orbitPaths[planet.id];
      context.save();
      context.globalAlpha = included.has(planet.id) ? 1 : 0.22;
      context.strokeStyle =
        planet.id === selected
          ? "rgba(227, 181, 85, 0.48)"
          : "rgba(222, 220, 202, 0.13)";
      context.lineWidth = planet.id === selected ? 1.25 : 0.7;
      context.beginPath();
      path.forEach((point, index) => {
        const screen = toScreen(point);
        if (index === 0) context.moveTo(screen.x, screen.y);
        else context.lineTo(screen.x, screen.y);
      });
      context.stroke();
      context.restore();
    }

    const selectedPosition = positions.find((position) => position.id === selected);
    const nearestPosition = positions.find((position) => position.id === nearest);
    if (selectedPosition && nearestPosition) {
      const from = toScreen(selectedPosition);
      const to = toScreen(nearestPosition);
      context.save();
      context.strokeStyle = "rgba(236, 187, 80, 0.92)";
      context.lineWidth = 1.5;
      context.setLineDash([7, 6]);
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
      context.stroke();
      context.setLineDash([]);
      const midpoint = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
      context.fillStyle = "rgba(6, 8, 7, 0.9)";
      context.fillRect(midpoint.x - 34, midpoint.y - 10, 68, 20);
      context.fillStyle = "#e8c26d";
      context.font = "600 9px Inter, system-ui, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText("NEAREST", midpoint.x, midpoint.y);
      context.restore();
    }

    const bodyScale = (minDimension * 0.027) / SUN.radiusKm;
    const sunRadius = SUN.radiusKm * bodyScale;
    context.save();
    context.shadowColor = "rgba(242, 184, 75, 0.58)";
    context.shadowBlur = 20;
    context.fillStyle = SUN.color;
    context.beginPath();
    context.arc(center.x, center.y, sunRadius, 0, Math.PI * 2);
    context.fill();
    context.restore();
    context.fillStyle = "rgba(247, 232, 187, 0.72)";
    context.font = "600 10px Inter, system-ui, sans-serif";
    context.textAlign = "center";
    context.fillText("SUN", center.x, center.y + sunRadius + 20);

    const hitRegions: HitRegion[] = [];
    for (const position of positions) {
      const planet = getPlanet(position.id);
      const isIncluded = included.has(position.id);
      const body = toScreen(position);
      const bodyRadius = planet.radiusKm * bodyScale;
      const isSelected = position.id === selected;
      const isNearest = position.id === nearest;
      const isHovered = position.id === hovered;
      context.save();
      context.globalAlpha = isIncluded ? 1 : 0.22;

      if (isSelected || isNearest || isHovered) {
        context.strokeStyle = isSelected ? "#f0c565" : "rgba(240, 197, 101, 0.72)";
        context.lineWidth = isSelected ? 1.5 : 1;
        context.beginPath();
        context.arc(body.x, body.y, Math.max(8, bodyRadius + 7), 0, Math.PI * 2);
        context.stroke();
        if (isSelected) {
          context.beginPath();
          context.moveTo(body.x - 13, body.y);
          context.lineTo(body.x - 7, body.y);
          context.moveTo(body.x + 7, body.y);
          context.lineTo(body.x + 13, body.y);
          context.moveTo(body.x, body.y - 13);
          context.lineTo(body.x, body.y - 7);
          context.moveTo(body.x, body.y + 7);
          context.lineTo(body.x, body.y + 13);
          context.stroke();
        }
      }

      context.fillStyle = planet.color;
      context.beginPath();
      context.arc(body.x, body.y, Math.max(0.08, bodyRadius), 0, Math.PI * 2);
      context.fill();

      if (position.id === "saturn" && bodyRadius > 0.4) {
        context.save();
        context.strokeStyle = "rgba(235, 213, 156, 0.72)";
        context.lineWidth = 0.55;
        context.translate(body.x, body.y);
        context.rotate(-0.25);
        context.scale(1, 0.35);
        context.beginPath();
        context.arc(0, 0, bodyRadius * 1.9, 0, Math.PI * 2);
        context.stroke();
        context.restore();
      }

      const [offsetX, offsetY] = LABEL_OFFSETS[position.id];
      const labelWidth = planet.name.length * 7.4 + 22;
      const labelHeight = 24;
      const placeLeft = body.x > dimensions.width * 0.72;
      const labelX = placeLeft
        ? body.x - labelWidth - offsetX
        : body.x + offsetX;
      const labelY = body.y + offsetY - labelHeight / 2;
      const arrowStart = {
        x: placeLeft ? labelX + labelWidth : labelX,
        y: labelY + labelHeight / 2,
      };
      const arrowEnd = {
        x: body.x + (placeLeft ? 7 : -7),
        y: body.y,
      };
      drawArrow(
        context,
        arrowStart,
        arrowEnd,
        isSelected || isNearest || isHovered
          ? "rgba(235, 191, 94, 0.82)"
          : "rgba(219, 218, 200, 0.45)",
      );

      context.fillStyle =
        isSelected || isNearest || isHovered
          ? "rgba(22, 22, 17, 0.96)"
          : "rgba(8, 10, 9, 0.82)";
      context.fillRect(labelX, labelY, labelWidth, labelHeight);
      context.strokeStyle =
        isSelected || isNearest
          ? "rgba(235, 191, 94, 0.72)"
          : "rgba(226, 223, 203, 0.2)";
      context.strokeRect(labelX + 0.5, labelY + 0.5, labelWidth - 1, labelHeight - 1);
      context.fillStyle = isSelected ? "#f4ce76" : "#e5e2d5";
      context.font = "600 10px Inter, system-ui, sans-serif";
      context.textAlign = "left";
      context.textBaseline = "middle";
      context.fillText(planet.name.toUpperCase(), labelX + 11, labelY + labelHeight / 2);

      context.restore();
      if (isIncluded) {
        hitRegions.push({
          id: position.id,
          body,
          label: { x: labelX, y: labelY, width: labelWidth, height: labelHeight },
          line: { start: arrowStart, end: arrowEnd },
        });
      }
    }
    hitRegionsRef.current = hitRegions;
  }, [camera, dimensions, hovered, included, nearest, orbitPaths, positions, selected]);

  const findHit = useCallback((x: number, y: number) => {
    for (const region of [...hitRegionsRef.current].reverse()) {
      const inBody = Math.hypot(x - region.body.x, y - region.body.y) <= 13;
      const inLabel =
        x >= region.label.x &&
        x <= region.label.x + region.label.width &&
        y >= region.label.y &&
        y <= region.label.y + region.label.height;
      const onLeader =
        pointToSegmentDistance({ x, y }, region.line.start, region.line.end) <= 7;
      if (inBody || inLabel || onLeader) return region.id;
    }
    return null;
  }, []);

  const localPoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const point = localPoint(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: point.x,
      startY: point.y,
      originPanX: camera.panX,
      originPanY: camera.panY,
      moved: false,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const point = localPoint(event);
    const drag = dragRef.current;
    if (drag && drag.pointerId === event.pointerId) {
      const dx = point.x - drag.startX;
      const dy = point.y - drag.startY;
      if (Math.hypot(dx, dy) > 3) drag.moved = true;
      if (drag.moved) {
        onCameraChange({
          ...camera,
          panX: drag.originPanX + dx,
          panY: drag.originPanY + dy,
        });
      }
      return;
    }
    setHovered(findHit(point.x, point.y));
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const point = localPoint(event);
    const drag = dragRef.current;
    if (drag && !drag.moved) {
      const hit = findHit(point.x, point.y);
      if (hit) onSelect(hit);
    }
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleWheel = (event: ReactWheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * 0.0012);
    onCameraChange({
      ...camera,
      zoom: Math.max(0.62, Math.min(4, camera.zoom * factor)),
    });
  };

  return (
    <canvas
      ref={canvasRef}
      className={hovered ? "orbit-canvas orbit-canvas--hover" : "orbit-canvas"}
      aria-label="Interactive top-down map of the Sun and eight planets. Excluded planets are dimmed; use the planet controls for keyboard selection."
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        dragRef.current = null;
      }}
      onPointerLeave={() => setHovered(null)}
      onWheel={handleWheel}
    />
  );
}

export default function App() {
  const [dateMs, setDateMs] = useState(RANGE_START_MS);
  const [selected, setSelected] = useState<PlanetId | null>(null);
  const [excludedPlanets, setExcludedPlanets] = useState<PlanetId[]>([]);
  const [playing, setPlaying] = useState(false);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [speedId, setSpeedId] = useState("year");
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(YEAR_SECONDS);
  const [customMultiplier, setCustomMultiplier] = useState(String(YEAR_SECONDS));
  const [customError, setCustomError] = useState("");
  const [jumpValue, setJumpValue] = useState(toDateTimeInput(RANGE_START_MS));
  const [jumpError, setJumpError] = useState("");
  const [boundaryMessage, setBoundaryMessage] = useState("");
  const [camera, setCamera] = useState<Camera>({ zoom: 1, panX: 0, panY: 0 });
  const [methodsOpen, setMethodsOpen] = useState(false);
  const [liveMessage, setLiveMessage] = useState("");
  const restoredRef = useRef(false);
  const previousNearestRef = useRef<PlanetId | null>(null);

  const positions = useMemo(() => allPlanetPositions(dateMs), [dateMs]);
  const excludedSet = useMemo(() => new Set(excludedPlanets), [excludedPlanets]);
  const includedIds = useMemo(
    () => PLANET_IDS.filter((id) => !excludedSet.has(id)),
    [excludedSet],
  );
  const includedSet = useMemo(() => new Set(includedIds), [includedIds]);
  const nearestResult = useMemo(
    () =>
      selected
        ? nearestPlanetFromPositions(selected, positions, includedIds)
        : null,
    [includedIds, positions, selected],
  );
  const nearestId = nearestResult?.planet.id ?? null;
  const distance = nearestResult ? formatDistance(nearestResult.distanceAu) : null;
  const selectedPlanet = selected ? getPlanet(selected) : null;
  const filteredTimeline = useMemo(
    () =>
      selected
        ? prepareFilteredNearestTimeline(
            selected,
            statistics.rankings[selected],
            includedIds,
          )
        : null,
    [includedIds, selected],
  );
  const livePercentages = useMemo(
    () => (filteredTimeline ? percentagesAt(filteredTimeline, dateMs) : []),
    [dateMs, filteredTimeline],
  );

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as {
          dateMs?: unknown;
          selected?: unknown;
          direction?: unknown;
          speedId?: unknown;
          speedMultiplier?: unknown;
          customMultiplier?: unknown;
          camera?: Partial<Camera>;
          excludedPlanets?: unknown;
        };
        const restoredExcluded =
          Array.isArray(parsed.excludedPlanets) &&
          parsed.excludedPlanets.every(isPlanetId) &&
          new Set(parsed.excludedPlanets).size === parsed.excludedPlanets.length &&
          parsed.excludedPlanets.length <= PLANET_IDS.length - 2
            ? parsed.excludedPlanets
            : [];
        setExcludedPlanets(restoredExcluded);
        if (typeof parsed.dateMs === "number" && Number.isFinite(parsed.dateMs)) {
          const restoredDate = clampToRange(parsed.dateMs);
          setDateMs(restoredDate);
          setJumpValue(toDateTimeInput(restoredDate));
        }
        if (
          isPlanetId(parsed.selected) &&
          !restoredExcluded.includes(parsed.selected)
        ) {
          setSelected(parsed.selected);
        }
        if (parsed.direction === 1 || parsed.direction === -1) {
          setDirection(parsed.direction);
        }
        if (typeof parsed.speedId === "string") setSpeedId(parsed.speedId);
        if (
          typeof parsed.speedMultiplier === "number" &&
          parsed.speedMultiplier > 0 &&
          parsed.speedMultiplier <= MAX_CUSTOM_MULTIPLIER
        ) {
          setSpeedMultiplier(parsed.speedMultiplier);
        }
        if (typeof parsed.customMultiplier === "string") {
          setCustomMultiplier(parsed.customMultiplier);
        }
        if (parsed.camera) {
          const { zoom, panX, panY } = parsed.camera;
          if (
            typeof zoom === "number" &&
            typeof panX === "number" &&
            typeof panY === "number"
          ) {
            setCamera({
              zoom: Math.max(0.62, Math.min(4, zoom)),
              panX,
              panY,
            });
          }
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      restoredRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!restoredRef.current) return;
    const timeout = window.setTimeout(() => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          dateMs,
          selected,
          direction,
          speedId,
          speedMultiplier,
          customMultiplier,
          camera,
          excludedPlanets,
        }),
      );
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [
    camera,
    customMultiplier,
    dateMs,
    direction,
    excludedPlanets,
    selected,
    speedId,
    speedMultiplier,
  ]);

  useEffect(() => {
    if (!playing) return;
    let animationFrame = 0;
    let previousFrame = performance.now();
    const animate = (now: number) => {
      const elapsedRealMs = Math.min(now - previousFrame, 100);
      previousFrame = now;
      setDateMs((current) => {
        const next = current + elapsedRealMs * speedMultiplier * direction;
        if (next >= RANGE_END_MS) {
          setPlaying(false);
          setBoundaryMessage("Reached Jan 1, 4000. Playback paused.");
          setJumpValue(toDateTimeInput(RANGE_END_MS));
          return RANGE_END_MS;
        }
        if (next <= RANGE_START_MS) {
          setPlaying(false);
          setBoundaryMessage("Reached Jan 1, 2000. Playback paused.");
          setJumpValue(toDateTimeInput(RANGE_START_MS));
          return RANGE_START_MS;
        }
        return next;
      });
      animationFrame = requestAnimationFrame(animate);
    };
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [direction, playing, speedMultiplier]);

  useEffect(() => {
    if (!selected || !nearestId) {
      previousNearestRef.current = null;
      return;
    }
    if (previousNearestRef.current !== nearestId) {
      setLiveMessage(
        `${getPlanet(nearestId).name} is now nearest to ${getPlanet(selected).name}.`,
      );
      previousNearestRef.current = nearestId;
    }
  }, [nearestId, selected]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (methodsOpen) setMethodsOpen(false);
      else setSelected(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [methodsOpen]);

  const selectSpeed = (value: string) => {
    setSpeedId(value);
    setBoundaryMessage("");
    if (value === "custom") {
      const parsed = Number(customMultiplier);
      if (
        !Number.isFinite(parsed) ||
        parsed <= 0 ||
        parsed > MAX_CUSTOM_MULTIPLIER
      ) {
        setCustomError(
          `Enter a value from 0 to ${MAX_CUSTOM_MULTIPLIER.toLocaleString()}.`,
        );
        return;
      }
      setCustomError("");
      setSpeedMultiplier(parsed);
      return;
    }
    const preset = SPEED_PRESETS.find((entry) => entry.id === value);
    if (preset) {
      setSpeedMultiplier(preset.multiplier);
      setCustomError("");
    }
  };

  const applyCustomSpeed = () => selectSpeed("custom");

  const jumpToDate = () => {
    const parsed = parseDateTimeInput(jumpValue);
    if (!Number.isFinite(parsed)) {
      setJumpError("Enter a valid UTC date and time.");
      return;
    }
    if (parsed < RANGE_START_MS || parsed > RANGE_END_MS) {
      setJumpError("Choose a date from Jan 1, 2000 through Jan 1, 4000.");
      return;
    }
    setDateMs(parsed);
    setPlaying(false);
    setJumpError("");
    setBoundaryMessage("");
  };

  const reset = () => {
    setDateMs(RANGE_START_MS);
    setJumpValue(toDateTimeInput(RANGE_START_MS));
    setPlaying(false);
    setDirection(1);
    setBoundaryMessage("");
  };

  const togglePlanetInclusion = (id: PlanetId) => {
    const planetName = getPlanet(id).name;
    if (excludedSet.has(id)) {
      setExcludedPlanets((current) => current.filter((planet) => planet !== id));
      setLiveMessage(`${planetName} is included in nearest-neighbor results.`);
      return;
    }
    if (includedIds.length <= 2) {
      setLiveMessage("At least two planets must remain included.");
      return;
    }
    setExcludedPlanets((current) => [...current, id]);
    if (selected === id) setSelected(null);
    setLiveMessage(`${planetName} is excluded from nearest-neighbor results.`);
  };

  const includeAllPlanets = () => {
    setExcludedPlanets([]);
    setLiveMessage("All planets are included in nearest-neighbor results.");
  };

  const currentSpeed =
    SPEED_PRESETS.find((entry) => entry.id === speedId)?.shortLabel ??
    `${speedMultiplier.toLocaleString()}×`;

  return (
    <main className="app-shell">
      <div className="scene" aria-label="Solar System simulation">
        <OrbitCanvas
          dateMs={dateMs}
          positions={positions}
          selected={selected}
          nearest={nearestId}
          included={includedSet}
          camera={camera}
          onCameraChange={setCamera}
          onSelect={setSelected}
        />
      </div>

      <header className="masthead">
        <div className="brand-mark" aria-hidden="true">
          <span />
          <i />
        </div>
        <div>
          <p>Planetary proximity atlas</p>
          <h1>Solar Orbit</h1>
        </div>
      </header>

      <section className="date-readout" aria-label="Current simulation time">
        <p>Heliocentric study · UTC</p>
        <time dateTime={new Date(dateMs).toISOString()}>{formatDate(dateMs)}</time>
      </section>

      <div className="top-actions">
        <button
          type="button"
          className="text-button"
          onClick={() => setMethodsOpen(true)}
        >
          Method & scale
        </button>
        <button
          type="button"
          className="text-button"
          onClick={() => setCamera({ zoom: 1, panX: 0, panY: 0 })}
        >
          Fit system
        </button>
      </div>

      {selected && selectedPlanet && nearestId && distance ? (
        <aside className="selection-panel" aria-label={`${selectedPlanet.name} details`}>
          <div className="selection-panel__heading">
            <BodyIcon id={selected} size={42} />
            <div>
              <p>Selected planet</p>
              <h2>{selectedPlanet.name}</h2>
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label={`Close ${selectedPlanet.name} details`}
              onClick={() => setSelected(null)}
            >
              ×
            </button>
          </div>

          <div className="nearest-summary">
            <p>Nearest included planet</p>
            <div>
              <BodyIcon id={nearestId} size={26} />
              <strong>{getPlanet(nearestId).name}</strong>
              <span>{distance.au}</span>
            </div>
            <small>{distance.millionKm} · center to center</small>
          </div>

          <div className="percentage-heading">
            <div>
              <p>Nearest among included</p>
              <span>
                {formatPercentageRange(dateMs)} · {livePercentages.length}{" "}
                candidate{livePercentages.length === 1 ? "" : "s"}
              </span>
            </div>
            <button type="button" onClick={() => setMethodsOpen(true)}>
              How?
            </button>
          </div>

          <ol className="percentage-list">
            {livePercentages.map((entry) => (
              <li key={entry.id}>
                <div className="percentage-list__row">
                  <span className="percentage-list__planet">
                    <BodyIcon id={entry.id} size={18} />
                    {getPlanet(entry.id).name}
                  </span>
                  <strong>{entry.percentage.toFixed(1)}%</strong>
                </div>
                <div className="percentage-track" aria-hidden="true">
                  <span style={{ width: `${entry.percentage}%` }} />
                </div>
              </li>
            ))}
          </ol>
        </aside>
      ) : (
        <aside className="instruction-card" aria-label="Getting started">
          <span>01</span>
          <p>Select a planet to reveal its nearest neighbor through time.</p>
        </aside>
      )}

      <aside className="planet-rail" aria-label="Planet inclusion and selection">
        <div className="planet-rail__heading">
          <div>
            <p>Planets</p>
            <span>{includedIds.length} / {PLANET_IDS.length} included</span>
          </div>
          {excludedPlanets.length > 0 ? (
            <button type="button" onClick={includeAllPlanets}>
              Include all
            </button>
          ) : null}
        </div>
        <div className="planet-rail__rows">
          {PLANETS.map((planet, index) => {
            const isIncluded = includedSet.has(planet.id);
            const inclusionLocked = isIncluded && includedIds.length <= 2;
            return (
              <div
                key={planet.id}
                className={`planet-rail__row${isIncluded ? "" : " is-excluded"}`}
              >
                <button
                  type="button"
                  className={`planet-rail__select${selected === planet.id ? " is-selected" : ""}`}
                  aria-label={`Select ${planet.name}`}
                  aria-pressed={selected === planet.id}
                  disabled={!isIncluded}
                  onClick={() => setSelected(planet.id)}
                >
                  <span className="planet-rail__number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <BodyIcon id={planet.id} size={18} />
                  <span>{planet.name}</span>
                </button>
                <label
                  className="planet-rail__toggle"
                  title={
                    inclusionLocked
                      ? "At least two planets must remain included"
                      : `${isIncluded ? "Exclude" : "Include"} ${planet.name}`
                  }
                >
                  <input
                    type="checkbox"
                    checked={isIncluded}
                    disabled={inclusionLocked}
                    onChange={() => togglePlanetInclusion(planet.id)}
                  />
                  <span className="planet-rail__toggle-visual" aria-hidden="true">
                    <i />
                  </span>
                  <span className="sr-only">
                    Include {planet.name} in nearest-neighbor results
                  </span>
                </label>
              </div>
            );
          })}
        </div>
      </aside>

      <div className="scale-disclosure">
        <span className="scale-disclosure__line" />
        <p>Orbital distances compressed</p>
        <span>Body diameters proportionally scaled</span>
      </div>

      <section className="time-console" aria-label="Time controls">
        <div className="transport-controls">
          <button
            type="button"
            className={direction === -1 ? "is-active" : ""}
            aria-label="Play backward"
            aria-pressed={direction === -1}
            onClick={() => {
              setDirection(-1);
              setBoundaryMessage("");
            }}
          >
            ←
          </button>
          <button
            type="button"
            className="play-button"
            aria-label={playing ? "Pause simulation" : "Play simulation"}
            onClick={() => {
              if (!playing) {
                setDirection((current) =>
                  playbackDirectionFromBoundary(dateMs, current),
                );
              }
              setPlaying(!playing);
              setBoundaryMessage("");
            }}
          >
            {playing ? "Ⅱ" : "▶"}
          </button>
          <button
            type="button"
            className={direction === 1 ? "is-active" : ""}
            aria-label="Play forward"
            aria-pressed={direction === 1}
            onClick={() => {
              setDirection(1);
              setBoundaryMessage("");
            }}
          >
            →
          </button>
        </div>

        <div className="control-group speed-group">
          <label htmlFor="speed-select">Playback speed</label>
          <div className="field-row">
            <select
              id="speed-select"
              value={speedId}
              onChange={(event) => selectSpeed(event.target.value)}
            >
              {SPEED_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
              <option value="custom">Custom multiplier</option>
            </select>
            <span className="direction-badge">
              {direction === -1 ? "−" : "+"}
              {currentSpeed}
            </span>
          </div>
          {speedId === "custom" ? (
            <div className="custom-speed-row">
              <input
                aria-label="Custom speed multiplier"
                inputMode="decimal"
                value={customMultiplier}
                onChange={(event) => setCustomMultiplier(event.target.value)}
                onBlur={applyCustomSpeed}
              />
              <span>× real time</span>
              <button type="button" onClick={applyCustomSpeed}>
                Apply
              </button>
            </div>
          ) : null}
          {customError ? <small className="field-error">{customError}</small> : null}
        </div>

        <div className="console-divider" />

        <div className="control-group jump-group">
          <label htmlFor="jump-date">Jump to UTC date</label>
          <div className="field-row">
            <input
              id="jump-date"
              type="datetime-local"
              min="2000-01-01T00:00"
              max="4000-01-01T00:00"
              value={jumpValue}
              onChange={(event) => setJumpValue(event.target.value)}
            />
            <button type="button" onClick={jumpToDate}>
              Jump
            </button>
          </div>
          {jumpError ? <small className="field-error">{jumpError}</small> : null}
        </div>

        <button type="button" className="reset-button" onClick={reset}>
          Reset to 2000
        </button>
      </section>

      {boundaryMessage ? (
        <div className="boundary-message" role="status">
          {boundaryMessage}
        </div>
      ) : null}

      <div className="sr-only" aria-live="polite">
        {liveMessage}
      </div>

      {methodsOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section
            className="methods-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="methods-title"
          >
            <div className="methods-modal__heading">
              <div>
                <p>Scientific method</p>
                <h2 id="methods-title">How to read this atlas</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Close scientific method"
                onClick={() => setMethodsOpen(false)}
                autoFocus
              >
                ×
              </button>
            </div>

            <div className="methods-grid">
              <article>
                <span>01</span>
                <h3>Physical positions</h3>
                <p>
                  Planet positions use heliocentric Keplerian elements published by
                  NASA/JPL and are projected onto the ecliptic plane. Nearest planets
                  are calculated in physical three-dimensional coordinates.
                </p>
              </article>
              <article>
                <span>02</span>
                <h3>Readable scale</h3>
                <p>
                  Orbital distances use logarithmic compression. Every body uses the
                  same diameter scale, so the Sun and planets retain their true size
                  ratios even when a planet is nearly a point.
                </p>
              </article>
              <article>
                <span>03</span>
                <h3>Time percentages</h3>
                <p>
                  A complete distance-order timeline from 2000–4000 was sampled every{" "}
                  {statistics.method.sampleHours} hours across{" "}
                  {statistics.method.samples.toLocaleString()} samples. Changes were
                  refined to within {statistics.method.transitionToleranceMinutes} minute.
                  The panel totals time from Jan 1, 2000 to the displayed instant, so it
                  grows forward, rewinds in reverse, and updates after a date jump. Values
                  start at zero and then round to total exactly 100.0%. Planet filters
                  re-evaluate that entire interval using only included candidates, so
                  excluded planets make no sampling contribution.
                </p>
              </article>
              <article className="methods-warning">
                <span>!</span>
                <h3>Model limit</h3>
                <p>{MODEL_METADATA.extrapolationDisclosure}</p>
              </article>
            </div>

            <a
              className="source-link"
              href={MODEL_METADATA.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              View the NASA/JPL source ↗
            </a>
          </section>
        </div>
      ) : null}
    </main>
  );
}

const dot = (a, b) => a.x * b.x + a.y * b.y;
const cross = (a, b) => a.x * b.y - a.y * b.x;
const subtract = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const epsilon = 1e-5;

export function unitVector(vector) {
  const length = Math.hypot(vector.x, vector.y);
  return length > epsilon ? { x: vector.x / length, y: vector.y / length } : { x: 1, y: 0 };
}
export function mirrorEndpoints(mirror) {
  const dx = Math.cos(mirror.angle) * mirror.radius, dy = Math.sin(mirror.angle) * mirror.radius;
  return [{ x: mirror.x - dx, y: mirror.y - dy }, { x: mirror.x + dx, y: mirror.y + dy }];
}
export function reflectRay(direction, angle) {
  const normal = { x: -Math.sin(angle), y: Math.cos(angle) }, incident = dot(direction, normal);
  return unitVector({ x: direction.x - 2 * incident * normal.x, y: direction.y - 2 * incident * normal.y });
}
function segmentDistance(origin, direction, { from: a, to: b }) {
  const edge = subtract(b, a), offset = subtract(a, origin);
  const denominator = cross(direction, edge);
  if (Math.abs(denominator) < epsilon) return Infinity;
  const distance = cross(offset, edge) / denominator, along = cross(offset, direction) / denominator;
  return distance > epsilon && along >= 0 && along <= 1 ? distance : Infinity;
}
function targetDistance(origin, direction, target) {
  const offset = subtract(target, origin), projected = dot(offset, direction);
  const perpendicular = dot(offset, offset) - projected * projected;
  if (perpendicular > target.radius ** 2) return Infinity;
  const distance = projected - Math.sqrt(Math.max(0, target.radius ** 2 - perpendicular));
  return distance > epsilon ? distance : Infinity;
}
export function laserPuzzle(width, height, angles) {
  const radius = Math.min(width * .105, height * .16, 62);
  return { width, height, source: { x: width * .1, y: height * .62 }, direction: { x: 1, y: 0 },
    mirrors: [{ x: width * .35, y: height * .62, angle: angles[0], radius },
      { x: width * .63, y: height * .3, angle: angles[1], radius }],
    walls: [{ from: { x: width * .5, y: height * .5 }, to: { x: width * .5, y: height * .75 } }],
    target: { x: width * .88, y: height * .58, radius: Math.max(8, Math.min(14, width * .028)) } };
}
export function traceLaser({ source, direction, mirrors, walls = [], target, width, height, maxBounces = 12 }) {
  let origin = { ...source }, ray = unitVector(direction);
  const segments = [];
  for (let bounce = 0; bounce <= maxBounces; bounce++) {
    const xEdge = Math.abs(ray.x) < epsilon ? Infinity : (ray.x > 0 ? width - origin.x : -origin.x) / ray.x;
    const yEdge = Math.abs(ray.y) < epsilon ? Infinity : (ray.y > 0 ? height - origin.y : -origin.y) / ray.y;
    let distance = Math.min(xEdge, yEdge), event = 'edge', selected = null;
    mirrors.forEach((mirror, index) => {
      const [from, to] = mirrorEndpoints(mirror), candidate = segmentDistance(origin, ray, { from, to });
      if (candidate < distance) { distance = candidate; event = 'mirror'; selected = index; }
    });
    walls.forEach(wall => {
      const candidate = segmentDistance(origin, ray, wall);
      if (candidate < distance) { distance = candidate; event = 'wall'; selected = null; }
    });
    const goal = targetDistance(origin, ray, target);
    if (goal < distance) { distance = goal; event = 'target'; }
    const point = { x: origin.x + ray.x * distance, y: origin.y + ray.y * distance };
    segments.push({ from: origin, to: point, event, mirror: selected });
    if (event !== 'mirror') return { segments, hit: event === 'target' };
    ray = reflectRay(ray, mirrors[selected].angle);
    origin = { x: point.x + ray.x * epsilon * 2, y: point.y + ray.y * epsilon * 2 };
  }
  return { segments, hit: false };
}

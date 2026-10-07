const dot = (a, b) => a.x * b.x + a.y * b.y;
const cross = (a, b) => a.x * b.y - a.y * b.x;
const subtract = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
export function unitVector(vector) {
  const length = Math.hypot(vector.x, vector.y);
  return length > 1e-9 ? { x: vector.x / length, y: vector.y / length } : { x: 1, y: 0 };
}

export function prismVertices(center, radius) {
  return [{ x: center.x, y: center.y - radius },
    { x: center.x + radius * Math.sqrt(3) / 2, y: center.y + radius / 2 },
    { x: center.x - radius * Math.sqrt(3) / 2, y: center.y + radius / 2 }];
}

export function insidePrism(point, vertices) {
  return vertices.every((a, i) => cross(subtract(vertices[(i + 1) % 3], a), subtract(point, a)) >= -1e-7);
}

export function rayIntersection(origin, direction, a, b) {
  const edge = subtract(b, a), offset = subtract(a, origin), denominator = cross(direction, edge);
  if (Math.abs(denominator) < 1e-9) return null;
  const distance = cross(offset, edge) / denominator, along = cross(offset, direction) / denominator;
  if (distance <= 1e-5 || along < -1e-7 || along > 1 + 1e-7) return null;
  return { distance, point: { x: origin.x + direction.x * distance, y: origin.y + direction.y * distance },
    normal: unitVector({ x: edge.y, y: -edge.x }) };
}

// Vector Snell refraction. The normal faces the incident medium.
export function refractRay(direction, normal, ratio) {
  const cosine = Math.max(0, Math.min(1, -dot(direction, normal)));
  const discriminant = 1 - ratio * ratio * (1 - cosine * cosine);
  if (discriminant < 0) return { reflected: true,
    direction: unitVector({ x: direction.x + 2 * cosine * normal.x, y: direction.y + 2 * cosine * normal.y }) };
  const bend = ratio * cosine - Math.sqrt(discriminant);
  return { reflected: false, direction: unitVector({ x: ratio * direction.x + bend * normal.x,
    y: ratio * direction.y + bend * normal.y }) };
}

export function tracePrismRay(source, direction, vertices, index, reach) {
  let origin = { ...source }, ray = unitVector(direction), inside = insidePrism(source, vertices);
  const segments = [];
  for (let bounce = 0; bounce < 7; bounce++) {
    let hit = null;
    vertices.forEach((a, i) => {
      const candidate = rayIntersection(origin, ray, a, vertices[(i + 1) % 3]);
      if (candidate && (!hit || candidate.distance < hit.distance)) hit = candidate;
    });
    if (!hit) {
      segments.push({ from: origin, to: { x: origin.x + ray.x * reach, y: origin.y + ray.y * reach }, inside });
      break;
    }
    segments.push({ from: origin, to: hit.point, inside });
    const normal = inside ? { x: -hit.normal.x, y: -hit.normal.y } : hit.normal;
    const next = refractRay(ray, normal, inside ? index : 1 / index);
    if (!next.reflected) inside = !inside;
    ray = next.direction;
    origin = { x: hit.point.x + ray.x * 1e-4, y: hit.point.y + ray.y * 1e-4 };
  }
  return segments;
}

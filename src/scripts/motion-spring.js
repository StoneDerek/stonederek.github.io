// Critically damped motion, evaluated from elapsed time rather than frame count.
// Both gallery browsing and the About edge use project-width units per millisecond.
export function createMotionSpring({ from, to, velocity = 0, unit = 1, response = 280 }) {
  const displacement = from - to;
  // A fast flick can require more damping to stop without crossing its target.
  // Increasing the response rate preserves the incoming velocity at t = 0.
  const rate = Math.max(6 / response,
    displacement * velocity < 0 ? Math.abs(velocity / displacement) : 0);
  const coefficient = velocity + rate * displacement;
  const sample = elapsed => {
    const time = Math.max(0, elapsed);
    const decay = Math.exp(-rate * time);
    const position = to + (displacement + coefficient * time) * decay;
    const speed = (velocity - rate * coefficient * time) * decay;
    return { position, velocity: speed,
      done: Math.abs(position - to) * unit < .5 && Math.abs(speed) * unit < .005 };
  };
  // Let secondary title motion finish with the gallery, without controlling it.
  let duration = 0;
  while (!sample(duration).done) duration += 16;
  return { sample, duration };
}

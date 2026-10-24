// The links space keeps the final project's index without inventing an article.
export function galleryFrame(value, projectCount) {
  const last = projectCount - 1;
  const position = Math.max(0, Math.min(projectCount, value));
  return { position, project: Math.min(last, Math.round(position)),
    endProgress: Math.max(0, position - last), links: position >= last + .5 };
}

// Navigation/selection triggers a complete entrance or exit. Never pass slide
// progress to the caption: after the trigger, elapsed time owns every glyph.
export function galleryCaptionFrame(frame, firstProject, destination = null) {
  const boundaryVisible = frame.project <= firstProject && !frame.links
    ? (destination === null ? frame.project : Math.round(destination)) >= firstProject
    : null;
  return {
    project: Math.max(firstProject, frame.project),
    visible: !frame.links && (frame.project >= firstProject || boundaryVisible === true),
    interactive: !frame.links && frame.project >= firstProject,
    links: frame.links,
    boundaryVisible
  };
}

export function settleProjectSwipe({ start, position, velocity = 0, deltaX, unit, touch = false, cancelled = false }) {
  const momentum = cancelled ? 0 : Math.max(-.55, Math.min(.55, velocity * 180));
  const target = Math.round(position + momentum);
  const threshold = touch ? Math.max(18, Math.min(42, unit * .1125)) : Math.max(24, Math.min(54, unit * .09));
  if (cancelled || Math.abs(deltaX) < threshold) return target;
  const direction = -Math.sign(deltaX);
  const next = Math.round(start) + direction;
  return direction > 0 ? Math.max(target, next) : Math.min(target, next);
}

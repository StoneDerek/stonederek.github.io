const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Coordinates are in the viewer's CSS pixels; zoom 1 is the fitted image.
export function fitImage(width, height, viewportWidth, viewportHeight) {
  const fit = Math.min(1, viewportWidth / width, viewportHeight / height);
  return constrainImage({
    width: width * fit, height: height * fit, viewportWidth, viewportHeight,
    fit, maxZoom: 1 / fit, zoom: 1, x: 0, y: 0
  });
}

export function constrainImage(image) {
  const width = image.width * image.zoom, height = image.height * image.zoom;
  return { ...image,
    x: width <= image.viewportWidth ? (image.viewportWidth - width) / 2 : clamp(image.x, image.viewportWidth - width, 0),
    y: height <= image.viewportHeight ? (image.viewportHeight - height) / 2 : clamp(image.y, image.viewportHeight - height, 0)
  };
}

export function zoomImage(image, zoom, point = { x: image.viewportWidth / 2, y: image.viewportHeight / 2 }) {
  zoom = clamp(zoom, 1, image.maxZoom);
  const ratio = zoom / image.zoom;
  return constrainImage({ ...image, zoom,
    x: point.x - (point.x - image.x) * ratio,
    y: point.y - (point.y - image.y) * ratio
  });
}

export function panImage(image, x, y) {
  return constrainImage({ ...image, x: image.x + x, y: image.y + y });
}

// Keep the inspected source point and pixel scale when the viewport changes.
export function resizeImage(image, next) {
  const x = (image.viewportWidth / 2 - image.x) / (image.width * image.zoom);
  const y = (image.viewportHeight / 2 - image.y) / (image.height * image.zoom);
  const zoom = clamp(image.zoom * image.fit / next.fit, 1, next.maxZoom);
  return constrainImage({ ...next, zoom,
    x: next.viewportWidth / 2 - x * next.width * zoom,
    y: next.viewportHeight / 2 - y * next.height * zoom
  });
}

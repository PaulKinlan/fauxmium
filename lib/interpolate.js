export function interpolate(template, values) {
  return template.replace(/###(\w+)###/g, (placeholder, key) =>
    Object.hasOwn(values, key) ? String(values[key]) : placeholder
  );
}

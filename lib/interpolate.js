export function interpolate(template, values) {
  return Object.entries(values).reduce((acc, [key, value]) => {
    return acc.replaceAll(`###${key}###`, value);
  }, template);
}

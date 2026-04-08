/**
 * Deep-merge a `source` object onto a `target` object.
 * - Nested plain objects are merged recursively.
 * - Arrays and primitives in `source` overwrite the target value.
 * - Returns a new object; neither argument is mutated.
 *
 * Used to overlay translated fields (e.g. German) onto the English caseData.
 */
export function deepMerge(target, source) {
  if (!source || typeof source !== "object") return target;
  if (!target || typeof target !== "object") return source;

  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key])
    ) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

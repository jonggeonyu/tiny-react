export function copyDependencies(dependencies) {
  if (dependencies === undefined) {
    return undefined;
  }

  if (!Array.isArray(dependencies)) {
    throw new TypeError('의존성은 배열이거나 생략되어야 합니다.');
  }

  return [...dependencies];
}

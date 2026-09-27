export function getLongestCommonPrefix(values: readonly string[]): string {
  if (values.length === 0) {
    return "";
  }

  let prefix = values[0] ?? "";

  for (const value of values.slice(1)) {
    let index = 0;

    while (index < prefix.length && index < value.length && prefix[index] === value[index]) {
      index += 1;
    }

    prefix = prefix.slice(0, index);

    if (prefix.length === 0) {
      break;
    }
  }

  return prefix;
}

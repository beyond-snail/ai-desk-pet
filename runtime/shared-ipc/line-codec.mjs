export function createLineReader(onLine) {
  let buffer = '';
  return (chunk) => {
    buffer += chunk;
    while (true) {
      const index = buffer.indexOf('\n');
      if (index < 0) {
        break;
      }
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (line.length > 0) {
        onLine(line);
      }
    }
  };
}

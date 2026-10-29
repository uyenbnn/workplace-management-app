// Supplied token data is flattened without changing its values. Run after reference updates.
const fs = require('node:fs');
fs.mkdirSync('src/styles', { recursive: true });
function leaves(value, path = [], output = []) {
  if (value && typeof value === 'object') {
    if ('$value' in value) output.push({ path: path.join('-'), token: value });
    else for (const [key, child] of Object.entries(value)) leaves(child, [...path, key], output);
  }
  return output;
}
for (const [source, target] of [
  ['Primitives', 'primitives'],
  ['Tokens-Light', 'semantic-tokens'],
  ['Mobile', 'typography'],
]) {
  const tokens = leaves(JSON.parse(fs.readFileSync(`references/${source}.tokens.json`, 'utf8')));
  const properties = tokens.flatMap(({ path, token }) => {
    const value = token.$value;
    const name = '--' + path.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    if (value && typeof value === 'object' && value.hex) {
      const alias = token.$extensions?.['com.figma.aliasData']?.targetVariableName;
      return [
        `  ${name}: ${source === 'Tokens-Light' && alias ? `var(--${alias.replaceAll('/', '-')}, ${value.hex})` : value.hex};`,
      ];
    }
    if (typeof value === 'number')
      return [`  ${name}: ${value}${/size|line-?height|letter-spacing/.test(name) ? 'px' : ''};`];
    if (typeof value === 'string')
      return [`  ${name}: ${/family/.test(name) ? `'${value}', sans-serif` : value};`];
    return [];
  });
  fs.writeFileSync(
    `src/styles/_${target}.scss`,
    '// Supplied design tokens. Regenerate with node tools/build-tokens.cjs.\n:root {\n' +
      properties.join('\n') +
      '\n}\n',
  );
}

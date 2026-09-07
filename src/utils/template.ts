/**
 * Minimal template renderer for the templates/ directory.
 *
 * Supports:
 *   {{identifier}}                         -> variable substitution
 *   {% if identifier === 'literal' %}...{% else %}...{% endif %}
 *
 * Conditionals are not nested (the provided templates never nest them).
 */
export type TemplateVars = Record<string, string | number | boolean>;

const BLOCK_OPEN = /^\{%\s*if\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:===|==|=)\s*'([^']+)'\s*%\}$/;
const VARIABLE = /\{\{\s*([\w.]+)\s*\}\}/g;

function chooseBranch(
  condition: string,
  body: string,
  vars: TemplateVars,
): string {
  const parsed = condition.match(BLOCK_OPEN);
  if (!parsed) {
    throw new Error(`Unsupported template condition: ${condition}`);
  }
  const pass = String(vars[parsed[1]]) === parsed[2];

  const elseIdx = body.indexOf('{% else %}');
  const thenBody = elseIdx === -1 ? body : body.slice(0, elseIdx);
  const elseBody = elseIdx === -1 ? '' : body.slice(elseIdx + '{% else %}'.length);

  return pass ? thenBody : elseBody;
}

export function renderTemplate(
  source: string,
  vars: TemplateVars,
): string {
  let out = source;

  while (true) {
    const openMatch = out.match(/\{%\s*if\s+[^%]*%\}/);
    if (!openMatch) break;

    const openIdx = openMatch.index as number;
    const openTag = out.slice(openIdx, openIdx + openMatch[0].length);
    const closeIdx = out.indexOf('{% endif %}', openIdx + openMatch[0].length);
    if (closeIdx === -1) {
      throw new Error('Unclosed {% if ... %} block in template.');
    }

    const body = out.slice(openIdx + openMatch[0].length, closeIdx);
    const branch = chooseBranch(openTag, body, vars);

    out = out.slice(0, openIdx) + branch + out.slice(closeIdx + '{% endif %}'.length);
  }

  out = out.replace(VARIABLE, (_match, key) => {
    const value = vars[key];
    return value === undefined ? `{{${key}}}` : String(value);
  });

  return out;
}
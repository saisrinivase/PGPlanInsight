export interface ExpressionEvidence {
  source: string;
  text: string;
}

export interface CoercionEvidence {
  source: string;
  expression: string;
  targetType: string;
  context: "predicate" | "output";
  confidence: "High";
  operand?: string;
}

const predicateSources = /^(Index Cond|Recheck Cond|Hash Cond|Merge Cond|Join Filter|Filter)$/i;
const postgresCast = /::\s*((?:double\s+precision|character\s+varying|timestamp(?:\s+with(?:out)?\s+time\s+zone)?|[a-z_][\w.]*)(?:\[\])?)/gi;
const standardCast = /\bcast\s*\([\s\S]*?\s+as\s+((?:double\s+precision|character\s+varying|timestamp(?:\s+with(?:out)?\s+time\s+zone)?|[a-z_][\w.]*)(?:\[\])?)\s*\)/gi;

function literalImmediatelyBefore(expression: string, castIndex: number): boolean {
  const prefix = expression.slice(0, castIndex).trimEnd();
  return /(?:^|[\s(,=<>])(?:'[^']*'|[-+]?\d+(?:\.\d+)?)$/.test(prefix);
}

export function coercionEvidence(expressions: ExpressionEvidence[]): CoercionEvidence[] {
  const evidence: CoercionEvidence[] = [];
  for (const item of expressions) {
    for (const pattern of [postgresCast, standardCast]) {
      pattern.lastIndex = 0;
      for (const match of item.text.matchAll(pattern)) {
        if (pattern === postgresCast && literalImmediatelyBefore(item.text, match.index ?? 0)) continue;
        const before = item.text.slice(0, match.index ?? 0);
        const operand = pattern === postgresCast ? before.match(/(?:\(?\s*)((?:"?[a-z_][\w$]*"?\.)?"?[a-z_][\w$]*"?)\)?\s*$/i)?.[1]?.replaceAll('"', '') : match[0].match(/cast\s*\(\s*((?:"?[a-z_][\w$]*"?\.)?"?[a-z_][\w$]*"?)/i)?.[1]?.replaceAll('"', '');
        evidence.push({ source: item.source, expression: item.text, targetType: match[1].replace(/\s+/g, " ").trim(), context: predicateSources.test(item.source) ? "predicate" : "output", confidence: "High", operand });
      }
    }
  }
  return evidence;
}

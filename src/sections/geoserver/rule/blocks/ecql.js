const isNumeric = (v) => v !== "" && !isNaN(v) && isFinite(Number(v));
const q = (v) =>
  isNumeric(v) ? String(v) : `'${String(v).replace(/'/g, "''")}'`;

export function buildECQL(filters = [], logic = "AND") {
  const parts = [];
  filters.forEach(({ field, operator, value }) => {
    if (!field || !operator) return;

    if (operator === "isnull") {
      parts.push(`${field} IS NULL`);
      return;
    }
    if (operator === "isnotnull") {
      parts.push(`${field} IS NOT NULL`);
      return;
    }

    if (value == null || value === "") return; // value-тэй операторуудад

    switch (operator) {
      case "eq":
        parts.push(`${field} = ${q(value)}`);
        break;
      case "neq":
        parts.push(`${field} <> ${q(value)}`);
        break;
      case "lt":
        parts.push(`${field} < ${q(value)}`);
        break;
      case "lte":
        parts.push(`${field} <= ${q(value)}`);
        break;
      case "gt":
        parts.push(`${field} > ${q(value)}`);
        break;
      case "gte":
        parts.push(`${field} >= ${q(value)}`);
        break;
      case "contains":
        parts.push(`${field} LIKE '%${String(value).replace(/'/g, "''")}%'`);
        break;
      case "startsWith":
        parts.push(`${field} LIKE '${String(value).replace(/'/g, "''")}%'`);
        break;
      case "endsWith":
        parts.push(`${field} LIKE '%${String(value).replace(/'/g, "''")}'`);
        break;
      case "between": {
        const [a, b] = String(value).split("..");
        if (a !== undefined && b !== undefined)
          parts.push(`${field} BETWEEN ${q(a)} AND ${q(b)}`);
        break;
      }
      case "in": {
        const list = String(value)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (list.length) parts.push(`${field} IN (${list.map(q).join(",")})`);
        break;
      }
      default:
        break;
    }
  });
  if (!parts.length) return "";
  const joiner = logic === "OR" ? " OR " : " AND ";
  return parts.length > 1 ? `(${parts.join(joiner)})` : parts[0];
}

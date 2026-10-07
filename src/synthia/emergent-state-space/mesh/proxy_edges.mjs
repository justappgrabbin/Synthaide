function tokenSet(text = '') {
  return new Set(
    String(text).toLowerCase().match(/[a-z0-9]+/g)?.filter((t) => t.length > 2) || []
  );
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const x of a) if (b.has(x)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

// Candidate relationships only. These are NEVER promoted to canonical truth here.
export function proxyCandidates(node, existingNodes, { minLexical = 0.45, max = 8 } = {}) {
  const out = [];
  const aTokens = tokenSet(node.text);

  for (const other of existingNodes) {
    if (other.id === node.id) continue;
    const reasons = [];
    let score = 0;

    if (node.gate && other.gate === node.gate) {
      score += 0.55;
      reasons.push('same-gate');
    }
    if (node.dimension && other.dimension === node.dimension) {
      score += 0.15;
      reasons.push('same-dimension');
    }
    if (node.source?.bookId && node.source.bookId === other.source?.bookId) {
      score += 0.10;
      reasons.push('same-book');
    }

    const lexical = jaccard(aTokens, tokenSet(other.text));
    if (lexical >= minLexical) {
      score += Math.min(0.40, lexical * 0.40);
      reasons.push(`lexical:${lexical.toFixed(3)}`);
    }

    if (score > 0.5) {
      out.push({
        from: node.id,
        to: other.id,
        type: 'proxy',
        status: 'candidate',
        score: Math.min(1, score),
        reasons,
      });
    }
  }

  return out.sort((a, b) => b.score - a.score).slice(0, max);
}

// Lightweight local-natural kernel for the symbolic mesh.
// It does not train weights. It guarantees that local summaries depend on
// structural labels/features, not arbitrary node ids or insertion order.

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, stable(value[k])]));
  }
  return value;
}

export function neighborhoodSignature(mesh, nodeId) {
  const node = mesh.node(nodeId);
  if (!node) throw new Error(`Unknown node: ${nodeId}`);

  const incident = mesh.edgesFor(nodeId).map((edge) => {
    const otherId = edge.from === nodeId ? edge.to : edge.from;
    const other = mesh.node(otherId);
    return {
      direction: edge.from === nodeId ? 'out' : 'in',
      edgeType: edge.type,
      edgeStatus: edge.status,
      neighbor: other ? {
        kind: other.kind,
        dimension: other.dimension || null,
        gate: other.gate || null,
        scale: other.scale || null,
      } : null,
    };
  });

  incident.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return stable({
    self: {
      kind: node.kind,
      dimension: node.dimension || null,
      gate: node.gate || null,
      scale: node.scale || null,
    },
    incident,
  });
}

export function localMessages(mesh, nodeId) {
  const signature = neighborhoodSignature(mesh, nodeId);
  return mesh.edgesFor(nodeId).map((edge) => {
    const fromSelf = edge.from === nodeId;
    const otherId = fromSelf ? edge.to : edge.from;
    return {
      to: nodeId,
      from: otherId,
      relation: edge.type,
      status: edge.status,
      weight: edge.weight ?? edge.score ?? 1,
      neighborhood: signature,
    };
  });
}

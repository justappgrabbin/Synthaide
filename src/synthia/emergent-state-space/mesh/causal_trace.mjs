export class CausalTrace {
  constructor() {
    this.events = [];
    this.seq = 0;
  }

  record({ type, output = null, parents = [], rule = null, evidence = [], meta = {} }) {
    const event = {
      id: `evt:${++this.seq}`,
      type,
      output,
      parents: [...parents],
      rule,
      evidence: [...evidence],
      meta: { ...meta },
      at: new Date().toISOString(),
    };
    this.events.push(event);
    return event;
  }

  trace(eventId) {
    const byId = new Map(this.events.map((e) => [e.id, e]));
    const out = [];
    const visit = (id) => {
      const event = byId.get(id);
      if (!event || out.some((e) => e.id === id)) return;
      for (const parent of event.parents) visit(parent);
      out.push(event);
    };
    visit(eventId);
    return out;
  }
}

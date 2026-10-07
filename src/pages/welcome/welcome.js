import EditorFile from "lib/editorFile";
import synthia from "synthia/synthiaRuntime.mjs";
import autonomy from "synthia/autonomy";
import stateSpace, { DIMENSIONS } from "synthia/stateSpace";
import tools from "synthia/toolFactory";
import synthesis, { TOOL_LEVELS, VALID_DIMENSIONS } from "synthia/synthesisRuntime.mjs";
import morphChat from "synthia/morph-chat/runtime.mjs";
import visualMorph from "synthia/morph-engine/runtime.mjs";
import morphSubstrate from "synthia/morph-engine/substrateRuntime.mjs";
import grammarSystems from "synthia/grammarSystemsRuntime.mjs";
import bindAcodeHosts from "synthia/embodiment/acodeHostBindings.mjs";
import browser from "plugins/browser";
import hero from "./synthia-hero.png?inline";

bindAcodeHosts({ autonomy, browser });

morphChat.attachToolMesh(grammarSystems.mesh);

export default function openWelcomeTab() {
	const current = editorManager.files.find((file) => file.id === "welcome-tab");
	if (current) return current.makeActive();
	const file = new EditorFile("Synthia", {
		id: "welcome-tab",
		render: true,
		type: "page",
		content: Shell(),
		tabIcon: "icon acode",
		hideQuickTools: true,
	});
	file.setCustomTitle(() => "System residence");
}

function Shell() {
	const $content = <div className="synthia-content" />;
	const $status = <button className="status" />;
	const panels = new Map();
	const navItems = [
		["home", "Residence"],
		["morph", "Morph"],
		["morph-chat", "Morph Chat"],
		["settings", "Settings"],
	];
	let show;

	const factories = {
		home: () => Home(show),
		morph: () => Morph(),
		"morph-chat": () => MorphChat(),
		settings: () => Settings(show),
		grammar: () => GrammarSystems(),
		state: () => State(),
		tools: () => Machinery(),
		autonomy: () => Autonomy(show),
	};

	const $shell = <div id="welcome-tab" className="synthia-shell scroll">
		<header>
			<button className="mark">S</button>
			<div>
				<h1>SYNTHIA<span>OS</span></h1>
				<p>sovereign development system</p>
			</div>
			{$status}
		</header>
		{$content}
		<nav>{navItems.map(([id, label]) => <button data-panel={id}>{label}</button>)}</nav>
	</div>;

	show = (panel = "home", refresh = false) => {
		const factory = factories[panel] || factories.home;
		const activePanel = factories[panel] ? panel : "home";
		$status.textContent = autonomy.state.enabled ? "● AUTONOMY ON" : "○ PAUSED";
		$status.onclick = () => show("settings");
		$shell.getAll("nav button").forEach((button) => {
			button.classList.toggle("active", button.dataset.panel === activePanel);
		});
		if (refresh || !panels.has(activePanel)) {
			panels.set(activePanel, factory());
		}
		$content.replaceChildren(panels.get(activePanel));
	};

	$shell.getAll("nav button").forEach((button) => {
		button.onclick = () => show(button.dataset.panel);
	});
	$shell.get(".mark").onclick = () => show("home");
	show();
	return $shell;
}

function Title(kicker, title, aside) {
	return <div className="title">
		<div><span>{kicker}</span><h2>{title}</h2></div>
		{aside && <small>{aside}</small>}
	</div>;
}

function Home(show) {
	const $activity = <div className="activity">
		<p className="empty">No activity yet. Give Synthia something real to resolve.</p>
	</div>;
	const $input = <input placeholder="Ask Synthia to analyze, address, or build…" />;
	const submit = async () => {
		const text = $input.value.trim();
		if (!text) return;
		try {
			$input.disabled = true;
			const result = await synthia.process(text);
			$activity.get(".empty")?.remove();
			$activity.prepend(<article>
				<b>{result.summary}</b>
				<code>{result.addressText}</code>
				<small>{result.path.join(" → ")}</small>
			</article>);
			$input.value = "";
		} catch (error) {
			window.toast?.(error.message);
		} finally {
			$input.disabled = false;
			$input.focus();
		}
	};
	const apps = [
		["Files", "folder", () => acode.exec("open-folder")],
		["Editor", "edit", () => acode.exec("new-file")],
		["Terminal", "terminal", () => acode.exec("new-terminal")],
		["Preview", "play_arrow", () => acode.exec("run")],
		["Builder", "build", () => show("tools")],
		["Morph", "animation", () => show("morph")],
		["Morph Chat", "forum", () => show("morph-chat")],
		["Plugins", "extension", () => acode.exec("open", "plugins")],
		["Settings", "settings", () => show("settings")],
	];

	$input.onkeydown = (event) => event.key === "Enter" && submit();
	return <main className="home">
		<section
			className="hero"
			style={{
				backgroundImage: `linear-gradient(180deg,rgba(2,5,19,.02),#030716 98%),url(${hero})`,
			}}
		>
			<div className="axes">
				WHO: SPACE · WHAT: MOVEMENT<br/>
				WHERE: BEING · WHEN: EVOLUTION · WHY: DESIGN
			</div>
			<div className="vitality">
				<b>{autonomy.state.enabled ? 87 : 0}<sup>%</sup></b>
				<span>vitality</span>
			</div>
		</section>
		<section className="ask">
			{$input}
			<button onclick={submit}>Resolve</button>
		</section>
		<section>
			{Title("APP TRAY", "Executable surfaces", "Morph and Morph Chat are independent")}
			<div className="apps">
				{apps.map(([label, icon, run]) => <button onclick={run}>
					<i className={`icon ${icon}`} />
					<span>{label}</span>
				</button>)}
			</div>
		</section>
		<section className="card">
			{Title("SYNTHIA CORE", "Internal system machinery")}
			<div className="stats">
				<div><b>320</b><span>states</span></div>
				<div><b>{synthia.orchestrator.broker.workers().length + 1}</b><span>automata</span></div>
				<div><b>{tools.list().length + synthesis.list().length}</b><span>tools</span></div>
				<div><b>13</b><span>fields</span></div>
			</div>
			<button className="link" onclick={() => show("settings")}>
				Open system settings →
			</button>
		</section>
		<section className="card">
			{Title("RECENT ACTIVITY", "Synthia conversation / resolution trace")}
			{$activity}
		</section>
	</main>;
}

function Morph() {
	const $status = <p className="morph-status">
		{visualMorph.available
			? "Browser Morph Engine ready. Geometry remains the source of truth."
			: "Morph Engine needs the browser canvas runtime."}
	</p>;
	const $frames = <div className="morph-frames" />;
	const $report = <pre className="morph-report">No transition generated yet.</pre>;
	const $run = <button className="synth-action">Generate idle → reach</button>;
	const $learn = <button className="morph-secondary">Learn transition again</button>;
	const $files = <input type="file" multiple />;
	const $intake = <button className="synth-action">Preserve + diagnose</button>;
	const $intakeReport = <pre className="morph-report">No artifacts received yet.</pre>;
	const $vault = <div className="rows"><p className="empty">Vault is ready for originals.</p></div>;

	const render = (learn) => {
		$run.disabled = true;
		$learn.disabled = true;
		try {
			const result = visualMorph.run({ frames: 8, learn });
			$frames.replaceChildren(...result.frames.map((frame, index) => {
				const $frame = <figure><figcaption>{index + 1}</figcaption></figure>;
				$frame.append(frame.canvas);
				return $frame;
			}));
			$report.textContent = JSON.stringify({
				qualityScore: result.report.score,
				observations: result.edge.observations,
				easing: result.edge.easing,
				frames: result.frames.length,
				transition: `${result.edge.from} → ${result.edge.to}`,
			}, null, 2);
			$status.textContent = "Transition generated from the standalone Morph Engine and its persistent transition edge.";
		} catch (error) {
			$status.textContent = error.message;
			window.toast?.(error.message);
		} finally {
			$run.disabled = false;
			$learn.disabled = false;
		}
	};

	$run.onclick = () => render(true);
	$learn.onclick = () => render(true);
	$intake.onclick = async () => {
		const files = [...($files.files || [])];
		if (!files.length) {
			window.toast?.("Choose one or more files first.");
			return;
		}
		$intake.disabled = true;
		try {
			const result = await morphSubstrate.intake(files, { source: "Synthia Morph UI" });
			const artifacts = await morphSubstrate.vault.list();
			$intakeReport.textContent = JSON.stringify({
				preserved: result.preserved.map((item) => ({ status: item.status, id: item.original.id, name: item.original.name })),
				assetGraph: result.diagnosis.assetGraph.summary,
				gaps: result.diagnosis.gaps.summary,
			}, null, 2);
			$vault.replaceChildren(...artifacts.map((artifact) => <article>
				<div><b>{artifact.name}</b><span>{artifact.organization.category} · {artifact.size} bytes</span></div>
				<strong>{artifact.policy.tier}</strong>
			</article>));
		} catch (error) {
			$intakeReport.textContent = error.message;
			window.toast?.(error.message);
		} finally {
			$intake.disabled = false;
		}
	};
	return <main className="detail morph-visual">
		<header>
			<span>MORPH ENGINE</span>
			<h2>State-node interpolation</h2>
			<p>
				This is the independent browser port of your Morph Engine:
				pose matching → registration → mesh → motion → interpolation →
				warping → refinement → completion → validation.
			</p>
		</header>
		<section className="card morph-controls">
			<div>{$run}{$learn}</div>
			{$status}
		</section>
		<section className="card">
			<h3>TRANSITION FRAMES</h3>
			{$frames}
			{$report}
		</section>
		<section className="card">
			<h3>ARTIFACT INTAKE + ORIGINAL VAULT</h3>
			<p>Original bytes are preserved first. Morph, bridge building, and MCP work happen only on governed copies.</p>
			<div className="morph-controls"><div>{$files}{$intake}</div></div>
			{$intakeReport}
			{$vault}
		</section>
	</main>;
}

function MorphChat() {
	const $messages = <div className="morph-messages" />;
	const $perspectives = <div className="perspective-bars" />;
	const $trace = <code className="morph-trace">No trace fired yet.</code>;
	const $input = <textarea rows="3" placeholder="Talk normally, ask for code, or follow a changing idea…" />;
	const $send = <button className="synth-action">Send</button>;
	const $clear = <button className="morph-secondary">Clear</button>;
	const $phase = <span className="morph-phase">IDLE</span>;

	const renderMessages = () => {
		const snapshot = morphChat.snapshot();
		if (!snapshot.messages.length) {
			$messages.replaceChildren(<p className="empty">
				Morph Chat has its own session. It can converse, code, remember this session,
				and expose how perspective proportions change.
			</p>);
			return;
		}
		$messages.replaceChildren(...snapshot.messages.map((message) => <article className={message.role}>
			<b>{message.role === "assistant" ? "Morph" : "You"}</b>
			<pre>{message.text}</pre>
		</article>));
		$messages.scrollTop = $messages.scrollHeight;
	};

	const renderPerspective = (result) => {
		if (!result?.perspective) return;
		const dimensions = result.perspective.dimensions || [];
		$perspectives.replaceChildren(...dimensions.map((item) => <div className="perspective-row">
			<span>{item.label}</span>
			<i><b style={{ width: `${Math.round(item.weight * 100)}%` }} /></i>
			<strong>{Math.round(item.weight * 100)}%</strong>
		</div>));
		$trace.textContent = `VQ trace ${result.trace.id} → ${result.trace.bound} → activated ${result.trace.activated ? "yes" : "no"}`;
	};

	const submit = async () => {
		const text = $input.value.trim();
		if (!text || $send.disabled) return;
		$send.disabled = true;
		$send.textContent = "Morphing…";
		$input.value = "";
		try {
			await morphChat.send(text);
			renderMessages();
			renderPerspective(morphChat.snapshot().last);
		} catch (error) {
			$input.value = text;
			window.toast?.(error.message);
		} finally {
			$send.disabled = false;
			$send.textContent = "Send";
			$phase.textContent = morphChat.snapshot().phase;
		}
	};

	$send.onclick = submit;
	$clear.onclick = () => {
		morphChat.clear();
		$perspectives.replaceChildren();
		$trace.textContent = "No trace fired yet.";
		renderMessages();
	};
	$input.onkeydown = (event) => {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			submit();
		}
	};
	morphChat.addEventListener("phase", (event) => {
		$phase.textContent = event.detail;
	});

	renderMessages();
	renderPerspective(morphChat.snapshot().last);
	return <main className="detail morph-chat">
		<header>
			<span>MORPH CHAT · {$phase}</span>
			<h2>Generative conversation through changing state</h2>
			<p>
				Normal conversation and coding share the mesh, memory, trace firing, and Klein tools,
				while Morph Chat remains its own automaton.
			</p>
		</header>
		<section className="card morph-runtime">
			<div>
				<b>{morphChat.snapshot().kleinTools.length} Klein tools</b>
				<span> · VQ trace firing · local provider</span>
			</div>
			{$trace}
		</section>
		<section className="card">
			<h3>PROPORTION OF PERSPECTIVE</h3>
			{$perspectives}
		</section>
		<section className="card morph-conversation">
			{$messages}
			<div className="morph-compose">
				{$input}
				<div>{$send}{$clear}</div>
			</div>
		</section>
	</main>;
}

function Settings(show) {
	const snapshot = morphChat.snapshot();
	return <main className="detail settings-page">
		<header>
			<span>SETTINGS</span>
			<h2>System configuration & diagnostics</h2>
			<p>
				State-space inspection, ATO/Klein machinery, autonomy, extensions,
				permissions, storage, and appearance belong here rather than in primary navigation.
			</p>
		</header>
		<section className="card settings-overview">
			<h3>SYSTEM OVERVIEW</h3>
			<div className="stats">
				<div><b>{synthia.orchestrator.broker.workers().length + 1}</b><span>active ATO</span></div>
				<div><b>{snapshot.kleinTools.length}</b><span>Klein tools</span></div>
				<div><b>{snapshot.messages.length}</b><span>Morph msgs</span></div>
				<div><b>{autonomy.state.enabled ? "ON" : "OFF"}</b><span>autonomy</span></div>
			</div>
		</section>
		<div className="settings-links">
			<button onclick={() => show("state")}>
				<b>State Space</b><span>Inspect address/state machinery</span>
			</button>
			<button onclick={() => show("tools")}>
				<b>ATO / Klein Mesh & Builder</b><span>Synthesize and run local tools</span>
			</button>
			<button onclick={() => show("autonomy")}>
				<b>Runtime / Permissions</b><span>Autonomy, network, execution, writes</span>
			</button>
			<button onclick={() => show("grammar")}>
				<b>Learning / Grammar Geometry</b><span>DEG rules and Geo-DEG relational geometry</span>
			</button>
			<button onclick={() => acode.exec("open", "plugins")}>
				<b>Extensions</b><span>Open the Acode extension surface</span>
			</button>
			<button onclick={() => acode.exec("open", "settings")}>
				<b>Appearance & Acode Settings</b><span>Editor and host configuration</span>
			</button>
		</div>
	</main>;
}

function GrammarSystems() {
	const $examples = <textarea rows="6">alpha beta gamma
alpha beta delta
beta gamma epsilon</textarea>;
	const $status = <p className="synth-status">
		DEG and Geo-DEG are separate automatons connected only by their production-grammar contract.
	</p>;
	const $rules = <div className="rows grammar-rules"><p className="empty">No learned rules yet.</p></div>;
	const $geometry = <pre className="synth-output">No grammar geometry yet.</pre>;
	const $generated = <pre className="synth-output">No generated graph yet.</pre>;
	const $learn = <button className="synth-action">Learn rules + index geometry</button>;
	const $generate = <button className="morph-secondary">Generate from learned grammar</button>;

	const renderRules = (grammar) => {
		$rules.replaceChildren(...grammar.rules.slice(0, 16).map((rule) => <article>
			<div>
				<b>{rule.id}</b>
				<span>{rule.lhs.anchor} → {rule.rhs.nodes.slice(1).join(", ")} · support {rule.support}</span>
			</div>
			<strong>{Math.round(rule.score * 100)}%</strong>
		</article>));
	};

	$learn.onclick = async () => {
		const examples = $examples.value
			.split("\n")
			.map((value) => value.trim())
			.filter(Boolean);
		if (!examples.length) {
			$status.textContent = "Add at least one example.";
			return;
		}
		$learn.disabled = true;
		try {
			const result = await grammarSystems.learnAndIndex(examples, { minSupport: 1 });
			renderRules(result.grammar);
			$geometry.textContent = JSON.stringify({
				nodes: result.geometry.nodeCount,
				edges: result.geometry.edgeCount,
				visited: result.visited,
				sampleRelations: result.geometry.edges.slice(0, 8),
			}, null, 2);
			$status.textContent = `${result.grammar.ruleCount} production rules learned; ${result.geometry.edgeCount} geometry relations indexed.`;
		} catch (error) {
			$status.textContent = error.message;
			window.toast?.(error.message);
		} finally {
			$learn.disabled = false;
		}
	};

	$generate.onclick = async () => {
		try {
			const result = await grammarSystems.generate({ maxApplications: 5 });
			$generated.textContent = JSON.stringify(result, null, 2);
		} catch (error) {
			$generated.textContent = `Error: ${error.message}`;
		}
	};

	return <main className="detail grammar-systems">
		<header>
			<span>LEARNING / GRAMMAR GEOMETRY</span>
			<h2>DEG + Geo-DEG</h2>
			<p>
				DEG learns reusable production structure. Geo-DEG receives that grammar as data and
				builds a separate geometry for similarity, reachability, routing, composition, and diffusion.
			</p>
		</header>
		<section className="card grammar-input">
			<h3>TINY EXAMPLE SET</h3>
			{$examples}
			<div className="grammar-actions">{$learn}{$generate}</div>
			{$status}
		</section>
		<h3>DEG PRODUCTION RULES</h3>
		{$rules}
		<section className="card">
			<h3>GEO-DEG GEOMETRY</h3>
			{$geometry}
		</section>
		<section className="card">
			<h3>DEG GENERATION</h3>
			{$generated}
		</section>
	</main>;
}

function State() { const address = stateSpace.resolve("Synthia OS"); return <main className="detail"><header><span>FULL STATE SPACE</span><h2>64 gates × 5 dimensions</h2><p>Every intake, tool run, change, and conversation receives all thirteen canonical address fields.</p></header><div className="rows">{DIMENSIONS.map((dimension,index) => <article><i>{index+1}</i><div><b>{dimension}</b><span>Gates 1—64 · fully addressable</span></div><strong>64</strong></article>)}</div><section className="address"><span>13-FIELD ADDRESS</span><code>{stateSpace.format(address)}</code></section></main>; }

function Machinery() {
	const $purpose = <textarea rows="3" placeholder="Describe the tool you want Synthia to synthesize…" />;
	const $dimension = <select>{VALID_DIMENSIONS.map((dimension) => <option value={dimension}>{dimension}</option>)}</select>;
	const $level = <select><option value="">Auto structure</option>{TOOL_LEVELS.map((level) => <option value={level.level}>{level.level} · {level.name}</option>)}</select>;
	const $status = <p className="synth-status">Ready to generate and mount a local tool.</p>;
	const $generated = <div className="rows machines synthesized" />;
	$dimension.value = "Design";

	const renderGenerated = () => {
		const records = synthesis.list();
		if (!records.length) {
			$generated.replaceChildren(<p className="empty">No synthesized tools yet.</p>);
			return;
		}
		$generated.replaceChildren(...records.map((tool) => SynthesisTool(tool)));
	};

	const create = () => {
		try {
			const rawLevel = $level.value;
			const result = synthesis.synthesize({
				purpose: $purpose.value,
				input: $purpose.value,
				dimension: $dimension.value,
				level: rawLevel === "" ? undefined : Number(rawLevel),
			});
			if (!result.tool) {
				$status.textContent = `Not generated: ${result.reason || result.status}.`;
				return;
			}
			$status.textContent = `${result.generationStatus}: ${result.tool.name} · ${result.tool.addressKey}`;
			$purpose.value = "";
			renderGenerated();
		} catch (error) {
			$status.textContent = error.message;
			window.toast?.(error.message);
		}
	};

	renderGenerated();
	return <main className="detail"><header><span>ATO + TOOL FACTORY</span><h2>Synthesize a runnable tool</h2><p>Describe a purpose, choose a state dimension, then generate. The tool is materialized as a native ATO Automaton and mounted into the local mesh before you run it.</p></header><section className="card synth-builder"><h3>MINIMUM VIABLE SYNTHESIS</h3>{$purpose}<div className="synth-options">{$dimension}{$level}</div><button className="synth-action" onclick={create}>Synthesize + mount</button>{$status}</section><h3>SYNTHESIZED TOOLS</h3>{$generated}<h3>ATO ENGINE</h3><div className="rows machines">{[synthia.automaton.manifest()].map((item) => <article><div><b>{item.id}</b><span>{item.functionalLevel} · {item.addressKey}</span></div><strong>canonical</strong></article>)}</div><h3>FOUNDATION TOOL REGISTRY</h3><div className="rows machines">{tools.list().map((item) => <article><div><b>{item.name}</b><span>{item.dimension} · v{item.version}</span></div><strong>registered</strong></article>)}</div></main>;
}

function SynthesisTool(tool) {
	const $input = <input placeholder="Input for this tool" value="sense classify build test mount" />;
	const $output = <pre className="synth-output">Not run yet.</pre>;
	const $run = <button className="synth-run">Run</button>;
	$run.onclick = async () => {
		$run.disabled = true;
		$run.textContent = "Running…";
		try {
			const result = await synthesis.run(tool.id, $input.value);
			$output.textContent = JSON.stringify(result.output, null, 2);
		} catch (error) {
			$output.textContent = `Error: ${error.message}`;
		} finally {
			$run.disabled = false;
			$run.textContent = "Run";
		}
	};
	return <article className="synth-tool"><div className="synth-tool-main"><b>{tool.name}</b><span>{tool.dimension} · {tool.levelName} L{tool.level} · {tool.addressKey}</span><div className="synth-runner">{$input}{$run}</div>{$output}</div><strong>mounted</strong></article>;
}

function Autonomy(show) {
	const permissions = [["enabled","Autonomous pulses","Master pause for self-directed work"],["allowFileReads","Read workspace","Inspect selected files"],["allowFileWrites","Write workspace","Create or modify files"],["allowExecution","Execute builds","Run local tasks and previews"],["allowNetwork","Network access","Permit outgoing requests"],["requireApprovalForWrites","Approve every write","Gate mutations before they happen"]];
	return <main className="detail"><header><span>AUTONOMY CONTROL</span><h2>Authority stays visible</h2><p>Conservative defaults, instant pause, explicit capabilities, bounded pulses, and a local audit trail.</p></header><section className="master"><div><b>{autonomy.state.enabled ? "ACTIVE" : "PAUSED"}</b><span>{autonomy.state.maxActionsPerPulse} actions / {autonomy.state.pulseIntervalMs/1000}s pulse</span></div><button onclick={() => { autonomy.update({enabled: !autonomy.state.enabled}); show("autonomy"); }}>{autonomy.state.enabled ? "Pause all" : "Resume"}</button></section><section className="toggles">{permissions.map(([key,label,help]) => <label><div><b>{label}</b><span>{help}</span></div><input type="checkbox" checked={autonomy.state[key]} onchange={(event) => autonomy.update({[key]: event.target.checked})}/><i/></label>)}</section><section className="card audit"><h3>LOCAL AUDIT</h3>{autonomy.audit.length ? autonomy.audit.slice(0,8).map((entry) => <p><b>{entry.action}</b><span>{new Date(entry.at).toLocaleTimeString()}</span></p>) : <p className="empty">No autonomous action has run.</p>}</section></main>;
}

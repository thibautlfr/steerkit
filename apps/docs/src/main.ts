import type { Demo, Param, Values } from "./demo.ts";
import {
	collisionAvoidanceDemo,
	obstacleAvoidanceDemo,
} from "./demos/avoid.ts";
import { arriveDemo, fleeDemo, keepAwayDemo, seekDemo } from "./demos/basic.ts";
import { combineDemo } from "./demos/combine.ts";
import {
	containmentDemo,
	flowFieldDemo,
	pathFollowingDemo,
} from "./demos/environment.ts";
import { leaderFollowingDemo, offsetPursuitDemo } from "./demos/leader.ts";
import {
	alignmentDemo,
	cohesionDemo,
	flockingDemo,
	separationDemo,
} from "./demos/neighbors.ts";
import { evadeDemo, pursueDemo } from "./demos/prediction.ts";
import { speedLimitDemo } from "./demos/speed-limit.ts";
import { wanderDemo } from "./demos/wander.ts";
import { highlight } from "./highlight.ts";
import { home, SITE } from "./pages.ts";
import { Stage } from "./stage.ts";

const demos: Demo[] = [
	seekDemo,
	fleeDemo,
	arriveDemo,
	keepAwayDemo,
	pursueDemo,
	evadeDemo,
	wanderDemo,
	separationDemo,
	cohesionDemo,
	alignmentDemo,
	flockingDemo,
	leaderFollowingDemo,
	offsetPursuitDemo,
	obstacleAvoidanceDemo,
	collisionAvoidanceDemo,
	containmentDemo,
	pathFollowingDemo,
	flowFieldDemo,
	combineDemo,
	speedLimitDemo,
];

const element = <T extends HTMLElement>(id: string): T => {
	const found = document.getElementById(id);
	if (!found) throw new Error(`Missing #${id}`);
	return found as T;
};

const list = element<HTMLOListElement>("demo-list");
const title = element("title");
const summary = element("summary");
const hint = element("hint");
const form = element<HTMLFormElement>("params");
const code = element("code");
const stage = new Stage(element<HTMLCanvasElement>("canvas"));

// The demo in the address (/arrive/), or the first one on the home page
const current = (): { demo: Demo; isHome: boolean } => {
	const id = location.pathname.split("/").filter(Boolean)[0];
	const demo = demos.find((d) => d.id === id);
	return demo ? { demo, isHome: false } : { demo: seekDemo, isHome: true };
};

// Links from before the site had one page per demo (/#arrive)
const legacy = demos.find((d) => `#${d.id}` === location.hash);
if (legacy) history.replaceState(null, "", `/${legacy.id}/`);

// The head of the page, prerendered at build time, kept in step when
// navigating between demos without reloading
const setMeta = (selector: string, attribute: string, value: string) => {
	document.querySelector(selector)?.setAttribute(attribute, value);
};
const updateHead = (demo: Demo, isHome: boolean) => {
	const pageTitle = isHome
		? home.title
		: `${demo.title}, interactive demo · steerkit`;
	const description = isHome ? home.description : demo.description;
	const url = isHome ? `${SITE}/` : `${SITE}/${demo.id}/`;
	document.title = pageTitle;
	setMeta('meta[name="description"]', "content", description);
	setMeta('link[rel="canonical"]', "href", url);
	setMeta('meta[property="og:title"]', "content", pageTitle);
	setMeta('meta[property="og:description"]', "content", description);
	setMeta('meta[property="og:url"]', "content", url);
};

// A slider, or a select for a choice, writing into `values`
const control = (param: Param, values: Values, onChange: () => void) => {
	const label = document.createElement("label");
	label.className = "param";
	const name = document.createElement("span");
	name.textContent = param.label;
	label.append(name);

	if (param.options) {
		const select = document.createElement("select");
		param.options.forEach((option, i) => {
			select.add(new Option(option, String(i), false, i === param.value));
		});
		select.addEventListener("change", () => {
			values[param.key] = Number(select.value);
			onChange();
		});
		label.append(document.createElement("span"), select);
		return label;
	}

	const output = document.createElement("output");
	const input = document.createElement("input");
	input.type = "range";
	input.min = String(param.min ?? 0);
	input.max = String(param.max ?? 1);
	input.step = String(param.step ?? 0.01);
	input.value = String(param.value);
	output.textContent = input.value;
	input.addEventListener("input", () => {
		values[param.key] = Number(input.value);
		output.textContent = input.value;
		onChange();
	});
	label.append(output, input);
	return label;
};

let values: Values = {};
let shown: Demo = seekDemo;

const show = () => {
	const { demo, isHome } = current();
	shown = demo;

	for (const link of list.querySelectorAll("a")) {
		if (link.pathname === `/${demo.id}/`) {
			link.setAttribute("aria-current", "page");
		} else link.removeAttribute("aria-current");
	}
	title.textContent = demo.title;
	summary.textContent = demo.summary;
	hint.textContent = demo.hint;
	updateHead(demo, isHome);

	values = Object.fromEntries(demo.params.map((p) => [p.key, p.value]));
	const render = () => {
		code.innerHTML = highlight(demo.code(values));
	};
	form.replaceChildren(...demo.params.map((p) => control(p, values, render)));
	render();
	stage.play(demo.create(stage.world), values);
};

// Moving between demos without reloading the page
document.addEventListener("click", (event) => {
	const link = (event.target as Element).closest?.("a");
	const internal =
		link?.origin === location.origin &&
		(link.pathname === "/" || demos.some((d) => link.pathname === `/${d.id}/`));
	if (
		!link ||
		!internal ||
		event.metaKey ||
		event.ctrlKey ||
		event.shiftKey ||
		event.button !== 0
	) {
		return;
	}
	event.preventDefault();
	if (link.pathname !== location.pathname) {
		history.pushState(null, "", link.pathname);
		show();
		window.scrollTo({ top: 0 });
	}
});
window.addEventListener("popstate", show);
show();

// Copying the snippet, or a prompt that asks a coding agent to bring the
// demo's behavior into the reader's own project
const copied = element("copied");
let copiedTimer = 0;
const copy = async (text: string, what: string) => {
	try {
		await navigator.clipboard.writeText(text);
		copied.textContent = `${what} copied`;
	} catch {
		copied.textContent = "Copy failed: select the code instead";
	}
	clearTimeout(copiedTimer);
	copiedTimer = window.setTimeout(() => {
		copied.textContent = "";
	}, 2000);
};

const prompt = (
	demo: Demo,
): string => `I want to use steerkit (the npm package "steerkit") in this project: Craig Reynolds' steering behaviors as small, typed functions that work on the project's own { x, y, z } vectors, THREE.Vector3 included.

Goal: ${demo.goal}.

1. Read the steerkit documentation for coding agents first: ${SITE}/llms.txt
2. Look at how this project moves its characters: the update loop, the entities, their vector type, the scale of the world and the frame delta. If it's unclear which entities this is for, ask me before changing code.
3. Add steerkit with the project's package manager and wire it in following the documentation: output vectors created once and reused, dt in seconds and clamped, step called once per agent per frame.
4. Scale maxSpeed, maxForce and distances to the project's units, keep the change small and readable, and tell me what you changed.

Starting point, from the ${demo.title} demo (${SITE}/${demo.id}/), with the values I picked there (the demo's world is about 10 units tall):

\`\`\`ts
${demo.code(values)}
\`\`\`
`;

element("copy-code").addEventListener("click", () =>
	copy(shown.code(values), "Code"),
);
element("copy-prompt").addEventListener("click", () =>
	copy(prompt(shown), "Prompt"),
);

// Hiding the vectors, to watch the motion alone; remembered across visits
const toggle = element<HTMLButtonElement>("vectors");
const legend = document.querySelector<HTMLElement>(".legend");
const showVectors = (on: boolean) => {
	stage.vectors = on;
	toggle.setAttribute("aria-pressed", String(on));
	toggle.textContent = on ? "Hide forces" : "Show forces";
	if (legend) legend.hidden = !on;
	try {
		localStorage.setItem("steerkit:vectors", on ? "on" : "off");
	} catch {}
};
let stored: string | null = null;
try {
	stored = localStorage.getItem("steerkit:vectors");
} catch {}
showVectors(stored !== "off");
toggle.addEventListener("click", () =>
	showVectors(toggle.getAttribute("aria-pressed") !== "true"),
);
window.addEventListener("keydown", (event) => {
	const typing = event.target instanceof HTMLInputElement;
	if (
		event.key.toLowerCase() === "v" &&
		!typing &&
		!event.metaKey &&
		!event.ctrlKey
	) {
		showVectors(toggle.getAttribute("aria-pressed") !== "true");
	}
});

// The star count on the GitHub button, when the API answers (it allows 60
// unauthenticated requests an hour per visitor). Hidden below a threshold: a
// small number reads as a lack of traction rather than as social proof.
const MIN_STARS_SHOWN = 50;
const stars = element("stars");
fetch("https://api.github.com/repos/thibautlfr/steerkit")
	.then((response) => (response.ok ? response.json() : undefined))
	.then((repo?: { stargazers_count?: number }) => {
		const count = repo?.stargazers_count;
		if (count === undefined || count < MIN_STARS_SHOWN) return;
		stars.textContent =
			count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count);
		stars.hidden = false;
	})
	.catch(() => {});

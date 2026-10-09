import type { Demo, Param, Values } from "./demo.ts";
import { arriveDemo, fleeDemo, keepAwayDemo, seekDemo } from "./demos/basic.ts";
import { combineDemo } from "./demos/combine.ts";
import { evadeDemo, pursueDemo } from "./demos/prediction.ts";
import { speedLimitDemo } from "./demos/speed-limit.ts";
import { wanderDemo } from "./demos/wander.ts";
import { highlight } from "./highlight.ts";
import { Stage } from "./stage.ts";

const demos: Demo[] = [
	seekDemo,
	fleeDemo,
	arriveDemo,
	keepAwayDemo,
	pursueDemo,
	evadeDemo,
	wanderDemo,
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

for (const demo of demos) {
	const item = document.createElement("li");
	const link = document.createElement("a");
	link.href = `#${demo.id}`;
	link.textContent = demo.title;
	item.append(link);
	list.append(item);
}

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

const show = () => {
	const id = location.hash.slice(1);
	const demo = demos.find((d) => d.id === id) ?? seekDemo;

	for (const link of list.querySelectorAll("a")) {
		if (link.hash === `#${demo.id}`) link.setAttribute("aria-current", "page");
		else link.removeAttribute("aria-current");
	}
	title.textContent = demo.title;
	summary.textContent = demo.summary;
	hint.textContent = demo.hint;
	document.title = `${demo.title} · steerkit`;

	const values: Values = Object.fromEntries(
		demo.params.map((p) => [p.key, p.value]),
	);
	const render = () => {
		code.innerHTML = highlight(demo.code(values));
	};
	form.replaceChildren(...demo.params.map((p) => control(p, values, render)));
	render();
	stage.play(demo.create(stage.world), values);
};

window.addEventListener("hashchange", show);
show();

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
// unauthenticated requests an hour per visitor)
const stars = element("stars");
fetch("https://api.github.com/repos/thibautlfr/steerkit")
	.then((response) => (response.ok ? response.json() : undefined))
	.then((repo?: { stargazers_count?: number }) => {
		const count = repo?.stargazers_count;
		if (count === undefined) return;
		stars.textContent =
			count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count);
		stars.hidden = false;
	})
	.catch(() => {});

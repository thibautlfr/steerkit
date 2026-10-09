import { describe, expect, it } from "vitest";
import { add, addWithin, blend, prioritize, zero } from "../src/index.ts";
import { length, vec } from "./helpers.ts";

describe("blend", () => {
	it("sums the weighted forces", () => {
		expect(blend(vec(), [vec(1, 0, 0), 2], [vec(0, 1, 0), 3])).toEqual(
			vec(2, 3, 0),
		);
	});

	it("ignores a term weighted 0", () => {
		expect(blend(vec(), [vec(1, 0, 0), 1], [vec(9, 9, 9), 0])).toEqual(
			vec(1, 0, 0),
		);
	});

	it("can write into one of its terms", () => {
		const force = vec(1, 0, 0);
		expect(blend(force, [force, 2], [vec(0, 1, 0), 1])).toEqual(vec(2, 1, 0));
	});
});

describe("zero and add", () => {
	it("give the same sum as blend", () => {
		const a = vec(1, 2, 3);
		const b = vec(-4, 0, 5);
		const out = zero(vec(7, 7, 7));
		add(out, a, 2);
		add(out, b, 0.5);
		expect(out).toEqual(blend(vec(), [a, 2], [b, 0.5]));
	});

	it("weighs 1 by default", () => {
		expect(add(vec(1, 0, 0), vec(0, 1, 0))).toEqual(vec(1, 1, 0));
	});
});

describe("prioritize", () => {
	it("sums the forces that fit in the budget", () => {
		expect(prioritize(vec(), 10, vec(3, 0, 0), vec(0, 4, 0))).toEqual(
			vec(3, 4, 0),
		);
	});

	it("cuts the force that overflows the budget", () => {
		const out = prioritize(vec(), 5, vec(3, 0, 0), vec(0, 10, 0));
		expect(out.x).toBe(3);
		expect(length(out)).toBeLessThanOrEqual(5 + 1e-9);
	});

	it("ignores the forces after a saturating one", () => {
		expect(prioritize(vec(), 2, vec(5, 0, 0), vec(0, 9, 0))).toEqual(
			vec(2, 0, 0),
		);
	});

	it("can write into one of its forces", () => {
		const force = vec(1, 0, 0);
		expect(prioritize(force, 10, vec(0, 1, 0), force)).toEqual(vec(1, 1, 0));
	});
});

describe("addWithin", () => {
	it("gives the same sum as prioritize", () => {
		const forces = [vec(3, 0, 0), vec(0, 10, 0), vec(0, 0, 9)];
		const out = zero(vec());
		for (const force of forces) addWithin(out, 5, force);
		expect(out).toEqual(prioritize(vec(), 5, ...forces));
	});

	it("weighs the force before fitting it", () => {
		expect(addWithin(vec(), 10, vec(1, 0, 0), 3)).toEqual(vec(3, 0, 0));
		expect(addWithin(vec(), 2, vec(1, 0, 0), 3)).toEqual(vec(2, 0, 0));
	});

	it("adds nothing once the budget is spent", () => {
		expect(addWithin(vec(5, 0, 0), 5, vec(0, 1, 0))).toEqual(vec(5, 0, 0));
	});
});

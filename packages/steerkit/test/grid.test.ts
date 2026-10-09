import { describe, expect, it } from "vitest";
import {
	createGrid,
	createNeighbors,
	type Neighbors,
	queryGrid,
	updateGrid,
	type Vec3,
} from "../src/index.ts";
import { seeded, vec } from "./helpers.ts";

type Item = { id: number; position: Vec3 };

const items = (positions: Vec3[]): Item[] =>
	positions.map((position, id) => ({ id, position }));

// The ids found, sorted, to compare with what a scan of every item finds
const ids = (list: Neighbors<Item>): number[] =>
	Array.from({ length: list.length }, (_, i) => (list[i] as Item).id).sort(
		(a, b) => a - b,
	);

const bruteForce = (all: Item[], p: Vec3, radius: number): number[] =>
	all
		.filter(
			(item) =>
				Math.sqrt(
					(item.position.x - p.x) ** 2 +
						(item.position.y - p.y) ** 2 +
						(item.position.z - p.z) ** 2,
				) <= radius,
		)
		.map((item) => item.id);

const cloud = (count: number, size: number, seed = 1, flat = false): Item[] => {
	const random = seeded(seed);
	return items(
		Array.from({ length: count }, () =>
			vec(
				(random() - 0.5) * size,
				(random() - 0.5) * size,
				flat ? 0 : (random() - 0.5) * size,
			),
		),
	);
};

describe("queryGrid", () => {
	it("finds what a scan of every item finds", () => {
		const all = cloud(500, 20);
		const grid = updateGrid(createGrid<Item>({ cellSize: 2 }), all);
		const out = createNeighbors<Item>();
		for (const { position } of all.slice(0, 50)) {
			for (const radius of [0, 0.5, 2, 3.7]) {
				expect(ids(queryGrid(grid, position, radius, out))).toEqual(
					bruteForce(all, position, radius),
				);
			}
		}
	});

	it("includes the item queried around, and one exactly at the radius", () => {
		const all = items([vec(), vec(2, 0, 0), vec(2.01, 0, 0)]);
		const grid = updateGrid(createGrid<Item>({ cellSize: 1 }), all);
		expect(ids(queryGrid(grid, vec(), 2, createNeighbors()))).toEqual([0, 1]);
	});

	it("works across cell edges and negative coordinates", () => {
		const all = items([vec(-0.01, -0.01, -0.01), vec(0.01, 0.01, 0.01)]);
		const grid = updateGrid(createGrid<Item>({ cellSize: 1 }), all);
		expect(ids(queryGrid(grid, vec(), 0.1, createNeighbors()))).toEqual([0, 1]);
	});

	it("finds an item whose distance underflows to 0", () => {
		// √(5e−324²) is 0, though the item lies outside the exact box of cells
		const all = items([vec()]);
		const grid = updateGrid(createGrid<Item>({ cellSize: 0.001 }), all);
		expect(
			ids(queryGrid(grid, vec(-5e-324, 0, 0), 0, createNeighbors())),
		).toEqual([0]);
	});

	it("keeps to a plane", () => {
		const all = cloud(300, 20, 2, true);
		const grid = updateGrid(
			createGrid<Item>({ cellSize: 2, plane: "xy" }),
			all,
		);
		const out = createNeighbors<Item>();
		for (const { position } of all.slice(0, 30)) {
			expect(ids(queryGrid(grid, position, 2, out))).toEqual(
				bruteForce(all, position, 2),
			);
		}
	});

	it("stays right for any radius, and with a degenerate cell size", () => {
		const all = cloud(100, 10, 3);
		const out = createNeighbors<Item>();
		for (const cellSize of [0, -1, Number.NaN, 0.01, 1e9]) {
			const grid = updateGrid(createGrid<Item>({ cellSize }), all);
			for (const radius of [0.5, 3, 1e9]) {
				expect(ids(queryGrid(grid, vec(1, 1, 1), radius, out))).toEqual(
					bruteForce(all, vec(1, 1, 1), radius),
				);
			}
		}
	});

	it("finds no one within a negative or NaN radius", () => {
		const grid = updateGrid(createGrid<Item>({ cellSize: 1 }), cloud(10, 1));
		const out = createNeighbors<Item>();
		expect(queryGrid(grid, vec(), -1, out).length).toBe(0);
		expect(queryGrid(grid, vec(), Number.NaN, out).length).toBe(0);
	});

	it("follows the crowd as it moves, shrinks and grows", () => {
		const grid = createGrid<Item>({ cellSize: 2 });
		const out = createNeighbors<Item>();
		const all = cloud(200, 10, 4);
		updateGrid(grid, all);
		for (const item of all) item.position.x += 3;
		const few = all.slice(0, 20);
		updateGrid(grid, few);
		expect(ids(queryGrid(grid, vec(3, 0, 0), 4, out))).toEqual(
			bruteForce(few, vec(3, 0, 0), 4),
		);
		expect(grid.entries.slice(20, 200).every((e) => e === undefined)).toBe(
			true,
		);
		const more = cloud(1000, 30, 5);
		updateGrid(grid, more);
		expect(ids(queryGrid(grid, vec(), 4, out))).toEqual(
			bruteForce(more, vec(), 4),
		);
	});

	it("is empty before the first update", () => {
		const grid = createGrid<Item>({ cellSize: 1 });
		expect(queryGrid(grid, vec(), 10, createNeighbors()).length).toBe(0);
	});
});

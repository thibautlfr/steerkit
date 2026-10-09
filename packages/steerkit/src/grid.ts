// A spatial grid, to find an agent's neighbors without looking at the whole
// crowd: space is cut into cubic cells, each cell hashed into a fixed table,
// and the agents sorted by cell once per frame (a counting sort, as in
// Matthias Müller's "Ten Minute Physics"). Nothing is allocated per frame:
// the arrays only grow with the crowd.

import type { Plane, Vec3 } from "./types.ts";
import { norm } from "./vec.ts";

/**
 * What {@link queryGrid} writes into: a list of `length` items, like an
 * array. Create it once with {@link createNeighbors} and reuse it.
 */
export type Neighbors<T> = { length: number; [index: number]: T };

/**
 * The spatial grid, from {@link createGrid}, filled by {@link updateGrid}.
 * Treat it as opaque.
 */
export type Grid<T extends { position: Vec3 }> = {
	cellSize: number;
	plane: Plane | undefined;
	/** How many items the last update sorted. */
	count: number;
	/** Table size − 1, a power of 2 minus 1, to hash with a mask. */
	mask: number;
	/** Where each hashed cell starts in `entries`, and ends at the next. */
	starts: Int32Array;
	/** The items, sorted by hashed cell. */
	entries: (T | undefined)[];
	/** The cell of each entry, x y z in turn, to skip hash collisions. */
	cells: Int32Array;
};

export type GridOptions = {
	/**
	 * The side of a cell. About the largest radius you query: much smaller
	 * visits many cells, much larger tests many far agents.
	 */
	cellSize: number;
	/**
	 * For a crowd kept in a plane (`"xy"` for a 2D canvas, `"xz"` on the
	 * ground): the cells then ignore the third axis, and a query visits a
	 * single layer of them.
	 */
	plane?: Plane;
};

/** Creates an empty spatial grid. Fill it every frame with {@link updateGrid}. */
export function createGrid<T extends { position: Vec3 }>({
	cellSize,
	plane,
}: GridOptions): Grid<T> {
	return {
		cellSize,
		plane,
		count: 0,
		mask: 0,
		starts: new Int32Array(2),
		entries: [],
		cells: new Int32Array(0),
	};
}

/** Creates the reusable list {@link queryGrid} writes into. */
export function createNeighbors<T>(): Neighbors<T> {
	return { length: 0 };
}

// The cell of a coordinate, as a 32-bit integer (NaN and infinities fall in
// cell 0, where every query still finds them by distance)
const cell = (coordinate: number, cellSize: number): number =>
	Math.floor(coordinate / cellSize) | 0;

// Large primes (Teschner et al.), mixed and masked into the table
const hash = (cx: number, cy: number, cz: number, mask: number): number =>
	(Math.imul(cx, 92837111) ^
		Math.imul(cy, 689287499) ^
		Math.imul(cz, 283923481)) &
	mask;

/**
 * Sorts `items` into the grid by position: once per frame, after the agents
 * have moved. Allocates only when the crowd outgrows every previous one.
 */
export function updateGrid<T extends { position: Vec3 }>(
	grid: Grid<T>,
	items: ArrayLike<T>,
): Grid<T> {
	const { cellSize: s, plane } = grid;
	const n = items.length;
	if (n > grid.cells.length / 3) {
		const capacity = Math.max(n, (grid.cells.length / 3) * 2);
		let table = 16;
		while (table < capacity * 2) table *= 2;
		grid.mask = table - 1;
		grid.starts = new Int32Array(table + 1);
		grid.cells = new Int32Array(capacity * 3);
	}
	const { starts, cells, entries, mask } = grid;
	const keepX = plane !== "yz";
	const keepY = plane !== "xz";
	const keepZ = plane !== "xy";

	// Count the items per hashed cell, then turn the counts into the end of
	// each cell's range
	starts.fill(0);
	for (let i = 0; i < n; i++) {
		const p = (items[i] as T).position;
		const h = hash(
			keepX ? cell(p.x, s) : 0,
			keepY ? cell(p.y, s) : 0,
			keepZ ? cell(p.z, s) : 0,
			mask,
		);
		starts[h] = (starts[h] as number) + 1;
	}
	let end = 0;
	for (let h = 0; h <= mask; h++) {
		end += starts[h] as number;
		starts[h] = end;
	}
	starts[mask + 1] = n;

	// Each item takes the last free slot of its cell, which leaves `starts`
	// on the first one
	for (let i = 0; i < n; i++) {
		const item = items[i] as T;
		const p = item.position;
		const cx = keepX ? cell(p.x, s) : 0;
		const cy = keepY ? cell(p.y, s) : 0;
		const cz = keepZ ? cell(p.z, s) : 0;
		const h = hash(cx, cy, cz, mask);
		const j = (starts[h] as number) - 1;
		starts[h] = j;
		entries[j] = item;
		cells[j * 3] = cx;
		cells[j * 3 + 1] = cy;
		cells[j * 3 + 2] = cz;
	}
	// Let go of the items a smaller crowd no longer holds
	for (let j = n; j < grid.count; j++) entries[j] = undefined;
	grid.count = n;
	return grid;
}

/**
 * Writes into `out` the items of the grid within `radius` of `position`
 * (the agent itself included, which the group behaviors ignore), and
 * returns it. `out` is valid until the next query into it.
 */
export function queryGrid<T extends { position: Vec3 }>(
	grid: Grid<T>,
	position: Vec3,
	radius: number,
	out: Neighbors<T>,
): Neighbors<T> {
	const { cellSize: s, plane, starts, cells, entries, mask, count } = grid;
	const { x, y, z } = position;
	let found = 0;
	if (!(radius >= 0)) {
		out.length = 0;
		return out;
	}
	const keepX = plane !== "yz";
	const keepY = plane !== "xz";
	const keepZ = plane !== "xy";
	// The box of cells around the sphere, a hair wider: a distance computed
	// from squares can round below the radius, or underflow to 0, for an
	// item just outside the exact box
	const r =
		radius +
		(Math.abs(x) + Math.abs(y) + Math.abs(z) + radius) * 1e-12 +
		1e-150;
	const x0 = keepX ? cell(x - r, s) : 0;
	const x1 = keepX ? cell(x + r, s) : 0;
	const y0 = keepY ? cell(y - r, s) : 0;
	const y1 = keepY ? cell(y + r, s) : 0;
	const z0 = keepZ ? cell(z - r, s) : 0;
	const z1 = keepZ ? cell(z + r, s) : 0;
	const visits = (x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1);

	if (!(visits > 0 && visits <= count)) {
		// More cells than items (a radius far larger than the cells), or a
		// range lost to 32-bit overflow: testing every item is cheaper, and
		// always right
		for (let j = 0; j < count; j++) {
			const item = entries[j] as T;
			const q = item.position;
			if (norm(q.x - x, q.y - y, q.z - z) <= radius) out[found++] = item;
		}
		out.length = found;
		return out;
	}

	for (let cx = x0; cx <= x1; cx++) {
		for (let cy = y0; cy <= y1; cy++) {
			for (let cz = z0; cz <= z1; cz++) {
				const h = hash(cx, cy, cz, mask);
				const last = starts[h + 1] as number;
				for (let j = starts[h] as number; j < last; j++) {
					// Another cell hashed to the same slot: visited on its own
					if (
						cells[j * 3] !== cx ||
						cells[j * 3 + 1] !== cy ||
						cells[j * 3 + 2] !== cz
					)
						continue;
					const item = entries[j] as T;
					const q = item.position;
					if (norm(q.x - x, q.y - y, q.z - z) <= radius) out[found++] = item;
				}
			}
		}
	}
	out.length = found;
	return out;
}

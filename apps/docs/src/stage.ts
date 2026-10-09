import type { Scene, Values, World } from "./demo.ts";
import { Draw } from "./draw.ts";

// World units across the shorter side of the canvas
const UNITS = 10;
// A long frame (a tab in the background) counts as this much at most
const MAX_DT = 1 / 20;

/**
 * The canvas, its frame loop and the pointer. Without a pointer over the
 * canvas, the target goes round on its own so every demo stays alive, on
 * touch screens too.
 */
export class Stage {
	readonly world: World = {
		width: UNITS,
		height: UNITS,
		pointer: { x: 0, y: 0, z: 0 },
		pointerVelocity: { x: 0, y: 0, z: 0 },
		pointing: false,
		time: 0,
	};
	private readonly canvas: HTMLCanvasElement;
	private readonly draw: Draw;
	private scene: Scene | undefined;
	private values: Values = {};
	private frame = 0;
	private last = 0;

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("No 2D canvas context");
		this.draw = new Draw(ctx);

		new ResizeObserver(() => this.resize()).observe(canvas);
		this.resize();

		const point = (event: PointerEvent) => {
			const rect = canvas.getBoundingClientRect();
			this.world.pointer.x = (event.clientX - rect.left) / this.draw.scale;
			this.world.pointer.y = (event.clientY - rect.top) / this.draw.scale;
			this.world.pointing = true;
		};
		canvas.addEventListener("pointermove", point);
		canvas.addEventListener("pointerdown", point);
		canvas.addEventListener("pointerleave", () => {
			this.world.pointing = false;
		});
	}

	/** Shows or hides the velocity and force vectors. */
	set vectors(show: boolean) {
		this.draw.showVectors = show;
	}

	/** Stops the frame loop, while a 3D demo plays. */
	stop() {
		cancelAnimationFrame(this.frame);
		this.frame = 0;
		this.scene = undefined;
	}

	/** Plays `scene`, whose sliders write into `values`. */
	play(scene: Scene, values: Values) {
		this.scene = scene;
		this.values = values;
		if (!this.frame) {
			this.last = performance.now();
			this.frame = requestAnimationFrame(this.tick);
		}
	}

	/**
	 * Fits the world to the canvas. Called on its own when the canvas
	 * resizes; call it before creating a scene on a canvas just shown, as
	 * the observer only reports after the first frame.
	 */
	resize() {
		const { canvas, draw, world } = this;
		const rect = canvas.getBoundingClientRect();
		const dpr = window.devicePixelRatio || 1;
		canvas.width = Math.round(rect.width * dpr);
		canvas.height = Math.round(rect.height * dpr);
		draw.scale = Math.min(rect.width, rect.height) / UNITS;
		world.width = rect.width / draw.scale;
		world.height = rect.height / draw.scale;
		draw.ctx.setTransform(dpr * draw.scale, 0, 0, dpr * draw.scale, 0, 0);
	}

	private readonly tick = (now: number) => {
		this.frame = requestAnimationFrame(this.tick);
		const dt = Math.min((now - this.last) / 1000, MAX_DT);
		this.last = now;
		const { world, scene, values, draw } = this;
		if (!scene) return;

		world.time += dt;
		const { pointer, pointerVelocity: velocity } = world;
		const x = pointer.x;
		const y = pointer.y;
		if (!world.pointing) {
			// A slow figure eight around the center
			const t = world.time * 0.35;
			pointer.x = world.width / 2 + Math.sin(t) * world.width * 0.32;
			pointer.y = world.height / 2 + Math.sin(t * 2) * world.height * 0.25;
		}
		if (dt > 0) {
			// Smoothed over about a tenth of a second
			const k = 1 - Math.exp(-dt / 0.1);
			velocity.x += ((pointer.x - x) / dt - velocity.x) * k;
			velocity.y += ((pointer.y - y) / dt - velocity.y) * k;
		}

		scene.update(dt, values, world);
		draw.ctx.clearRect(0, 0, world.width, world.height);
		scene.draw(draw, values, world);
	};
}

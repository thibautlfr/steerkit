// The 3D canvas, loaded with three on the pages that need it: one renderer
// for the whole visit, as browsers cap the number of WebGL contexts, a
// camera turning slowly around the scene until dragged, and a frame loop.

import { PerspectiveCamera, type Scene, WebGLRenderer } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// A long frame (a tab in the background) counts as this much at most
const MAX_DT = 1 / 20;

export class Stage3D {
	readonly camera = new PerspectiveCamera(40, 16 / 9, 0.1, 100);
	private readonly canvas: HTMLCanvasElement;
	private readonly renderer: WebGLRenderer;
	private readonly controls: OrbitControls;
	private scene: Scene | undefined;
	private update: ((dt: number) => void) | undefined;
	private frame = 0;
	private last = 0;

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		this.renderer = new WebGLRenderer({ canvas, antialias: true });
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
		this.controls = new OrbitControls(this.camera, canvas);
		const { controls } = this;
		controls.enableDamping = true;
		// The page scrolls over the canvas: no zooming with the wheel
		controls.enableZoom = false;
		controls.enablePan = false;
		controls.minPolarAngle = Math.PI * 0.2;
		controls.maxPolarAngle = Math.PI * 0.62;
		controls.autoRotateSpeed = 0.5;
		controls.addEventListener("start", () => {
			controls.autoRotate = false;
		});
		new ResizeObserver(() => this.resize()).observe(canvas);
	}

	/** Plays `scene`, `update` moving it every frame. */
	play(scene: Scene, update: (dt: number) => void) {
		this.scene = scene;
		this.update = update;
		this.camera.position.set(0, 4, 21);
		this.controls.target.set(0, -0.5, 0);
		this.controls.autoRotate = true;
		this.resize();
		if (!this.frame) {
			this.last = performance.now();
			this.frame = requestAnimationFrame(this.tick);
		}
	}

	stop() {
		cancelAnimationFrame(this.frame);
		this.frame = 0;
		this.scene = undefined;
		this.update = undefined;
	}

	/** One frame of `dt` seconds: the loop's, or a manual one in development. */
	advance(dt: number) {
		const { scene, update } = this;
		if (!scene || !update) return;
		update(dt);
		this.controls.update(dt);
		this.renderer.render(scene, this.camera);
	}

	private resize() {
		const { width, height } = this.canvas.getBoundingClientRect();
		if (width === 0 || height === 0) return;
		this.renderer.setSize(width, height, false);
		this.camera.aspect = width / height;
		// Framed for 16:9: narrower canvases (4:3 on phones) zoom out
		this.camera.zoom = Math.min(1, this.camera.aspect / (16 / 9));
		this.camera.updateProjectionMatrix();
	}

	private readonly tick = (now: number) => {
		this.frame = requestAnimationFrame(this.tick);
		const dt = Math.min((now - this.last) / 1000, MAX_DT);
		this.last = now;
		this.advance(dt);
	};
}

let stage: Stage3D | undefined;

/** The stage of `canvas`, created on the first 3D demo of the visit. */
export const stageOf = (canvas: HTMLCanvasElement): Stage3D => {
	stage ??= new Stage3D(canvas);
	// The pane of the desktop app pauses requestAnimationFrame when hidden:
	// frames can then be advanced by hand
	if (import.meta.env.DEV) Object.assign(window, { stage3d: stage });
	return stage;
};

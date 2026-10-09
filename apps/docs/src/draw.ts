import type { Agent, Vec3 } from "steerkit";

type Colors = Record<
	| "agent"
	| "velocity"
	| "desired"
	| "steering"
	| "target"
	| "zone"
	| "trail"
	| "muted",
	string
>;

const readColors = (): Colors => {
	const style = getComputedStyle(document.documentElement);
	const get = (name: string) => style.getPropertyValue(`--${name}`).trim();
	return {
		agent: get("agent"),
		velocity: get("velocity"),
		desired: get("desired"),
		steering: get("steering"),
		target: get("target"),
		zone: get("zone"),
		trail: get("trail"),
		muted: get("muted"),
	};
};

// How long the vectors are drawn: where the agent would be in this many
// seconds at that velocity
const VECTOR_SECONDS = 0.6;

/** Canvas drawing in world units, with the steering diagram of Reynolds. */
export class Draw {
	colors: Colors = readColors();
	readonly ctx: CanvasRenderingContext2D;
	/** Pixels per world unit. */
	scale = 1;
	/** Whether {@link vectors} draws anything, to watch the motion alone. */
	showVectors = true;

	constructor(ctx: CanvasRenderingContext2D) {
		this.ctx = ctx;
		matchMedia("(prefers-color-scheme: dark)").addEventListener(
			"change",
			() => {
				this.colors = readColors();
			},
		);
	}

	// A line width or size in CSS pixels, in world units
	px(pixels: number): number {
		return pixels / this.scale;
	}

	line(from: Vec3, to: Vec3, color: string, width = 2, dash: number[] = []) {
		const { ctx } = this;
		ctx.strokeStyle = color;
		ctx.lineWidth = this.px(width);
		ctx.setLineDash(dash.map((d) => this.px(d)));
		ctx.beginPath();
		ctx.moveTo(from.x, from.y);
		ctx.lineTo(to.x, to.y);
		ctx.stroke();
		ctx.setLineDash([]);
	}

	arrow(from: Vec3, to: Vec3, color: string, width = 2, dash: number[] = []) {
		const dx = to.x - from.x;
		const dy = to.y - from.y;
		const length = Math.hypot(dx, dy);
		if (length < this.px(2)) return;
		this.line(from, to, color, width, dash);
		const head = Math.min(this.px(8), length / 2);
		const angle = Math.atan2(dy, dx);
		const { ctx } = this;
		ctx.fillStyle = color;
		ctx.beginPath();
		ctx.moveTo(to.x, to.y);
		ctx.lineTo(
			to.x - head * Math.cos(angle - 0.45),
			to.y - head * Math.sin(angle - 0.45),
		);
		ctx.lineTo(
			to.x - head * Math.cos(angle + 0.45),
			to.y - head * Math.sin(angle + 0.45),
		);
		ctx.closePath();
		ctx.fill();
	}

	circle(
		center: Vec3,
		radius: number,
		stroke?: string,
		fill?: string,
		dash: number[] = [],
	) {
		const { ctx } = this;
		ctx.beginPath();
		ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
		if (fill) {
			ctx.fillStyle = fill;
			ctx.fill();
		}
		if (stroke) {
			ctx.strokeStyle = stroke;
			ctx.lineWidth = this.px(1.5);
			ctx.setLineDash(dash.map((d) => this.px(d)));
			ctx.stroke();
			ctx.setLineDash([]);
		}
	}

	/**
	 * What an agent sees: a disc of `radius`, or the slice of it within
	 * `fieldOfView` (radians) around `heading` (radians).
	 */
	sector(
		center: Vec3,
		radius: number,
		heading: number,
		fieldOfView: number,
		stroke: string,
		fill: string,
	) {
		if (fieldOfView >= Math.PI * 2) {
			this.circle(center, radius, stroke, fill, [4, 4]);
			return;
		}
		const { ctx } = this;
		ctx.beginPath();
		ctx.moveTo(center.x, center.y);
		ctx.arc(
			center.x,
			center.y,
			radius,
			heading - fieldOfView / 2,
			heading + fieldOfView / 2,
		);
		ctx.closePath();
		ctx.fillStyle = fill;
		ctx.fill();
		ctx.strokeStyle = stroke;
		ctx.lineWidth = this.px(1.5);
		ctx.setLineDash([this.px(4), this.px(4)]);
		ctx.stroke();
		ctx.setLineDash([]);
	}

	/** A filled polygon, for zones that aren't round. */
	polygon(points: readonly Vec3[], fill: string) {
		const { ctx } = this;
		ctx.beginPath();
		points.forEach((point, i) => {
			if (i === 0) ctx.moveTo(point.x, point.y);
			else ctx.lineTo(point.x, point.y);
		});
		ctx.closePath();
		ctx.fillStyle = fill;
		ctx.fill();
	}

	/** A line of text, its size in CSS pixels. */
	text(at: Vec3, text: string, color: string, size = 13) {
		const { ctx } = this;
		ctx.font = `${this.px(size)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
		ctx.fillStyle = color;
		ctx.textBaseline = "top";
		ctx.fillText(text, at.x, at.y);
	}

	dot(center: Vec3, color: string, radius = 5) {
		this.circle(center, this.px(radius), undefined, color);
	}

	/** A target marker: a ring with a dot. */
	target(center: Vec3, color = this.colors.target) {
		this.circle(center, this.px(9), color);
		this.dot(center, color, 3);
	}

	/** The agent as a triangle pointing along its velocity. */
	agent(agent: Agent, color = this.colors.agent, size = 11) {
		const { position: p, velocity: v } = agent;
		const angle = Math.hypot(v.x, v.y) > 1e-6 ? Math.atan2(v.y, v.x) : 0;
		const s = this.px(size);
		const { ctx } = this;
		ctx.save();
		ctx.translate(p.x, p.y);
		ctx.rotate(angle);
		ctx.fillStyle = color;
		ctx.beginPath();
		ctx.moveTo(s, 0);
		ctx.lineTo(-s * 0.7, s * 0.6);
		ctx.lineTo(-s * 0.4, 0);
		ctx.lineTo(-s * 0.7, -s * 0.6);
		ctx.closePath();
		ctx.fill();
		ctx.restore();
	}

	/**
	 * Reynolds' diagram: the velocity, the desired velocity (velocity +
	 * force), and the steering force between their tips.
	 */
	vectors(agent: Agent, force: Vec3) {
		if (!this.showVectors) return;
		const { position: p, velocity: v } = agent;
		const k = VECTOR_SECONDS;
		const velocityTip = { x: p.x + v.x * k, y: p.y + v.y * k, z: 0 };
		const desiredTip = {
			x: p.x + (v.x + force.x) * k,
			y: p.y + (v.y + force.y) * k,
			z: 0,
		};
		this.arrow(p, desiredTip, this.colors.desired, 2, [5, 4]);
		this.arrow(p, velocityTip, this.colors.velocity, 2.5);
		this.arrow(velocityTip, desiredTip, this.colors.steering, 2.5);
	}

	/** A fading polyline of past positions. */
	trail(points: readonly Vec3[]) {
		const { ctx } = this;
		ctx.strokeStyle = this.colors.trail;
		ctx.lineWidth = this.px(2);
		ctx.beginPath();
		let previous: Vec3 | undefined;
		for (const point of points) {
			// A jump means the agent wrapped around an edge
			const jump =
				previous && Math.hypot(point.x - previous.x, point.y - previous.y) > 1;
			if (!previous || jump) ctx.moveTo(point.x, point.y);
			else ctx.lineTo(point.x, point.y);
			previous = point;
		}
		ctx.stroke();
	}
}

/** The last positions of an agent, for {@link Draw.trail}. */
export class Trail {
	readonly points: Vec3[] = [];
	private elapsed = 0;
	private readonly length: number;
	private readonly every: number;

	constructor(length = 90, every = 1 / 30) {
		this.length = length;
		this.every = every;
	}

	push(position: Vec3, dt: number) {
		this.elapsed += dt;
		if (this.elapsed < this.every) return;
		this.elapsed = 0;
		this.points.push({ x: position.x, y: position.y, z: 0 });
		if (this.points.length > this.length) this.points.shift();
	}
}

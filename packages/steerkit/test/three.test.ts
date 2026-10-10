import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { faceVelocity, SteeringHelper, setInstances } from "../src/three.ts";
import { vec } from "./helpers.ts";

// Where lookAt turns an object at the origin to face `direction`
const lookingAt = (
	direction: THREE.Vector3,
	up = new THREE.Vector3(0, 1, 0),
): THREE.Quaternion => {
	const object = new THREE.Object3D();
	object.up.copy(up);
	object.lookAt(direction);
	return object.quaternion;
};

const forward = (q: THREE.Quaternion): THREE.Vector3 =>
	new THREE.Vector3(0, 0, 1).applyQuaternion(q);

const directions = [
	new THREE.Vector3(1, 0, 0),
	new THREE.Vector3(0, 0, -1),
	new THREE.Vector3(-1, 0, 0.001),
	new THREE.Vector3(1, 2, 3),
	new THREE.Vector3(-0.3, 0.1, -2),
	new THREE.Vector3(0.2, -5, 0.1),
];

describe("faceVelocity", () => {
	it("faces the velocity as lookAt does, at once with an infinite turn rate", () => {
		for (const direction of directions) {
			const object = new THREE.Object3D();
			faceVelocity(object, direction, 1 / 60, { turnRate: Infinity });
			expect(object.quaternion.angleTo(lookingAt(direction))).toBeLessThan(
				1e-6,
			);
		}
	});

	it("keeps upright along the object's own up", () => {
		const up = new THREE.Vector3(0, 0, 1);
		// Off the up axis, where lookAt nudges its target
		for (const direction of directions.filter((d) => d.x !== 0 || d.y !== 0)) {
			const object = new THREE.Object3D();
			object.up.copy(up);
			faceVelocity(object, direction, 1 / 60, { turnRate: Infinity });
			expect(object.quaternion.angleTo(lookingAt(direction, up))).toBeLessThan(
				1e-6,
			);
		}
	});

	it("leaves e^(−turnRate × dt) of the angle at each call", () => {
		const object = new THREE.Object3D();
		const velocity = new THREE.Vector3(1, 0, 0);
		const target = lookingAt(velocity);
		const before = object.quaternion.angleTo(target);
		faceVelocity(object, velocity, 0.1, { turnRate: 5 });
		expect(object.quaternion.angleTo(target)).toBeCloseTo(
			before * Math.exp(-0.5),
			9,
		);
	});

	it("turns the same at any framerate", () => {
		const velocity = new THREE.Vector3(-1, 0.5, -0.2);
		const target = lookingAt(velocity);
		const turn = (fps: number) => {
			const object = new THREE.Object3D();
			for (let i = 0; i < fps; i++) faceVelocity(object, velocity, 1 / fps);
			return object.quaternion.angleTo(target);
		};
		expect(turn(30)).toBeCloseTo(turn(144), 9);
		expect(turn(30)).toBeGreaterThan(0);
	});

	it("turns 8 per second when not told", () => {
		const object = new THREE.Object3D();
		const velocity = new THREE.Vector3(0, 0, -1);
		const target = lookingAt(velocity);
		faceVelocity(object, new THREE.Vector3(1, 0, 0), 1, {
			turnRate: Infinity,
		});
		const before = object.quaternion.angleTo(target);
		faceVelocity(object, velocity, 0.05);
		expect(object.quaternion.angleTo(target)).toBeCloseTo(
			before * Math.exp(-0.4),
			9,
		);
	});

	it("keeps its orientation below minSpeed, or when no time passes", () => {
		const object = new THREE.Object3D();
		object.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 1);
		const before = object.quaternion.clone();
		faceVelocity(object, vec(1e-4, 0, 0), 1 / 60);
		faceVelocity(object, vec(0, 0, 0), 1 / 60);
		faceVelocity(object, vec(1, 0, 0), 0);
		faceVelocity(object, vec(1, 0, 0), 1 / 60, { turnRate: 0 });
		faceVelocity(object, vec(2, 0, 0), 1 / 60, { minSpeed: 3 });
		expect(object.quaternion.equals(before)).toBe(true);
	});

	it("looks straight up or down as lookAt does", () => {
		for (const y of [2, -2]) {
			const object = new THREE.Object3D();
			const velocity = new THREE.Vector3(0, y, 0);
			faceVelocity(object, velocity, 1 / 60, { turnRate: Infinity });
			const q = object.quaternion;
			expect(Math.hypot(q.x, q.y, q.z, q.w)).toBeCloseTo(1, 12);
			expect(forward(q).distanceTo(velocity.clone().normalize())).toBeLessThan(
				1e-9,
			);
			// lookAt nudges its target off the up axis, by 1e-4
			expect(q.angleTo(lookingAt(velocity))).toBeLessThan(1e-3);
		}
	});

	it("stays a rotation within a hair of up", () => {
		const object = new THREE.Object3D();
		faceVelocity(object, vec(1e-7, 1, 0), 1 / 60, { turnRate: Infinity });
		const { x, y, z, w } = object.quaternion;
		expect(Math.hypot(x, y, z, w)).toBeCloseTo(1, 12);
		expect(forward(object.quaternion).y).toBeCloseTo(1, 9);
	});

	it("steers the mesh of an agent", () => {
		const mesh = new THREE.Mesh();
		const velocity = new THREE.Vector3(0, 0, -3);
		faceVelocity(mesh, velocity, 1 / 60, { turnRate: Infinity });
		expect(forward(mesh.quaternion).z).toBeCloseTo(-1, 9);
		// The Euler angles follow, as three keeps them in sync
		const euler = new THREE.Quaternion().setFromEuler(mesh.rotation);
		expect(euler.angleTo(mesh.quaternion)).toBeLessThan(1e-6);
	});
});

const instanced = (capacity: number) =>
	new THREE.InstancedMesh(
		new THREE.BufferGeometry(),
		new THREE.MeshBasicMaterial(),
		capacity,
	);

const mover = (position: THREE.Vector3, velocity: THREE.Vector3) => ({
	position,
	velocity,
});

const decompose = (mesh: THREE.InstancedMesh, i: number) => {
	const matrix = new THREE.Matrix4();
	const position = new THREE.Vector3();
	const quaternion = new THREE.Quaternion();
	const scale = new THREE.Vector3();
	mesh.getMatrixAt(i, matrix);
	matrix.decompose(position, quaternion, scale);
	return { position, quaternion, scale };
};

describe("setInstances", () => {
	it("places each instance on its agent, facing its velocity", () => {
		const mesh = instanced(10);
		const agents = directions.map((direction, i) =>
			mover(new THREE.Vector3(i, -i, 2 * i), direction),
		);
		setInstances(mesh, agents);
		expect(mesh.count).toBe(agents.length);
		agents.forEach((agent, i) => {
			const { position, quaternion, scale } = decompose(mesh, i);
			expect(position.distanceTo(agent.position)).toBeLessThan(1e-5);
			expect(quaternion.angleTo(lookingAt(agent.velocity))).toBeLessThan(1e-3);
			expect(scale.distanceTo(new THREE.Vector3(1, 1, 1))).toBeLessThan(1e-5);
		});
	});

	it("keeps upright along `up`", () => {
		const mesh = instanced(1);
		const up = new THREE.Vector3(1, 0, 0);
		const velocity = new THREE.Vector3(0, 1, 1);
		setInstances(mesh, [mover(new THREE.Vector3(), velocity)], { up });
		const { quaternion } = decompose(mesh, 0);
		expect(quaternion.angleTo(lookingAt(velocity, up))).toBeLessThan(1e-3);
	});

	it("leaves out the agents beyond the capacity, and asks for an upload", () => {
		const mesh = instanced(10);
		const agents = Array.from({ length: 12 }, (_, i) =>
			mover(new THREE.Vector3(i, 0, 0), new THREE.Vector3(1, 0, 0)),
		);
		const version = mesh.instanceMatrix.version;
		setInstances(mesh, agents);
		expect(mesh.count).toBe(10);
		expect(mesh.instanceMatrix.version).toBe(version + 1);
		setInstances(mesh, agents.slice(0, 3));
		expect(mesh.count).toBe(3);
	});

	it("keeps the heading of an agent that stops", () => {
		const mesh = instanced(1);
		const agent = mover(new THREE.Vector3(), new THREE.Vector3(1, 0, 1));
		setInstances(mesh, [agent]);
		const before = decompose(mesh, 0).quaternion;
		agent.position.set(4, 5, 6);
		agent.velocity.set(0, 0, 0);
		setInstances(mesh, [agent]);
		const { position, quaternion } = decompose(mesh, 0);
		expect(position.distanceTo(agent.position)).toBeLessThan(1e-5);
		expect(quaternion.angleTo(before)).toBeLessThan(1e-6);
	});

	it("faces +z when an agent starts at a stop", () => {
		const mesh = instanced(1);
		const agent = mover(new THREE.Vector3(1, 2, 3), new THREE.Vector3());
		setInstances(mesh, [agent]);
		const { position, quaternion } = decompose(mesh, 0);
		expect(position.equals(agent.position)).toBe(true);
		expect(quaternion.angleTo(new THREE.Quaternion())).toBeLessThan(1e-6);
	});
});

const vertex = (helper: SteeringHelper, i: number) =>
	new THREE.Vector3().fromBufferAttribute(
		helper.geometry.getAttribute("position") as THREE.BufferAttribute,
		i,
	);

const tint = (helper: SteeringHelper, i: number) =>
	new THREE.Color().fromBufferAttribute(
		helper.geometry.getAttribute("color") as THREE.BufferAttribute,
		i,
	);

const drawn = (helper: SteeringHelper) => helper.geometry.drawRange.count;

describe("SteeringHelper", () => {
	const agent = mover(new THREE.Vector3(1, 2, 3), new THREE.Vector3(1, 0, 0));
	const force = new THREE.Vector3(0, 1, 0);

	it("draws Reynolds' diagram: 19 segments", () => {
		const helper = new SteeringHelper();
		helper.vectors(agent, force);
		expect(drawn(helper)).toBe(38);
		// The desired velocity first, 9 segments, then the velocity's shaft
		expect(vertex(helper, 0).distanceTo(agent.position)).toBeLessThan(1e-6);
		expect(
			vertex(helper, 9).distanceTo(new THREE.Vector3(1.6, 2.6, 3)),
		).toBeLessThan(1e-6);
		expect(vertex(helper, 18).distanceTo(agent.position)).toBeLessThan(1e-6);
		expect(
			vertex(helper, 19).distanceTo(new THREE.Vector3(1.6, 2, 3)),
		).toBeLessThan(1e-6);
		// The steering force, from the velocity's tip to the desired one's
		expect(
			vertex(helper, 28).distanceTo(new THREE.Vector3(1.6, 2, 3)),
		).toBeLessThan(1e-6);
		expect(
			vertex(helper, 29).distanceTo(new THREE.Vector3(1.6, 2.6, 3)),
		).toBeLessThan(1e-6);
		expect(tint(helper, 0).getHex()).toBe(new THREE.Color(0x1f9d6b).getHex());
		expect(tint(helper, 18).getHex()).toBe(new THREE.Color(0x2f6fde).getHex());
		expect(tint(helper, 37).getHex()).toBe(new THREE.Color(0xe0582b).getHex());
	});

	it("puts the arrowheads on the tips, no longer than headLength", () => {
		const helper = new SteeringHelper({ headLength: 0.05 });
		helper.vectors(agent, force);
		const tip = new THREE.Vector3(1.6, 2, 3);
		for (let i = 20; i < 28; i += 2) {
			expect(vertex(helper, i).distanceTo(tip)).toBeLessThan(1e-6);
			const wing = vertex(helper, i + 1).distanceTo(tip);
			expect(wing).toBeGreaterThan(0.05);
			expect(wing).toBeLessThan(0.06);
		}
	});

	it("takes its colors and length from the options", () => {
		const helper = new SteeringHelper({
			seconds: 1,
			colors: { velocity: "#ff0000" },
		});
		helper.vectors(agent, force);
		expect(
			vertex(helper, 19).distanceTo(new THREE.Vector3(2, 2, 3)),
		).toBeLessThan(1e-6);
		expect(tint(helper, 18).getHex()).toBe(0xff0000);
		helper.colors.velocity.set(0x00ff00);
		helper.reset();
		helper.vectors(agent, force);
		expect(tint(helper, 18).getHex()).toBe(0x00ff00);
	});

	it("draws nothing for a still agent under no force", () => {
		const helper = new SteeringHelper();
		helper.vectors(
			mover(new THREE.Vector3(), new THREE.Vector3()),
			force.clone().set(0, 0, 0),
		);
		expect(drawn(helper)).toBe(0);
	});

	it("draws boxes, paths, circles and spheres, and erases them", () => {
		const helper = new SteeringHelper();
		const box = new THREE.Box3(
			new THREE.Vector3(-1, -2, -3),
			new THREE.Vector3(1, 2, 3),
		);
		helper.box(box);
		expect(drawn(helper)).toBe(24);
		for (let i = 0; i < 24; i++) {
			const v = vertex(helper, i);
			expect(Math.abs(v.x)).toBe(1);
			expect(Math.abs(v.y)).toBe(2);
			expect(Math.abs(v.z)).toBe(3);
		}
		// Each edge runs along one axis
		for (let i = 0; i < 24; i += 2) {
			const d = vertex(helper, i).sub(vertex(helper, i + 1));
			expect([d.x, d.y, d.z].filter((c) => c !== 0)).toHaveLength(1);
		}

		helper.reset();
		expect(drawn(helper)).toBe(0);
		const road = [vec(0, 0, 0), vec(1, 0, 0), vec(1, 1, 0), vec(0, 1, 0)];
		helper.path(road);
		expect(drawn(helper)).toBe(6);
		helper.path(road, true);
		expect(drawn(helper)).toBe(14);
		expect(vertex(helper, 13).equals(new THREE.Vector3(0, 0, 0))).toBe(true);

		helper.reset();
		const center = new THREE.Vector3(1, 2, 3);
		helper.circle(center, 2, "xy");
		expect(drawn(helper)).toBe(64);
		for (let i = 0; i < 64; i++) {
			const v = vertex(helper, i);
			expect(v.z).toBe(3);
			expect(v.distanceTo(center)).toBeCloseTo(2, 5);
		}
		helper.reset();
		helper.circle(center, 2);
		expect(vertex(helper, 5).y).toBe(2);
		helper.sphere(center, 0.5);
		expect(drawn(helper)).toBe(64 + 192);
	});

	it("leaves out a whole shape that doesn't fit", () => {
		const helper = new SteeringHelper({ capacity: 20 });
		helper.sphere(new THREE.Vector3(), 1);
		expect(drawn(helper)).toBe(0);
		helper.box(new THREE.Box3(new THREE.Vector3(), new THREE.Vector3(1, 1, 1)));
		expect(drawn(helper)).toBe(24);
		// 8 segments left: the velocity's 5 fit, not the desired one's 9, nor
		// then the force's 5
		helper.vectors(agent, force);
		expect(drawn(helper)).toBe(24 + 10);
	});

	it("asks for an upload after drawing", () => {
		const helper = new SteeringHelper();
		const positions = helper.geometry.getAttribute("position");
		const version = (positions as THREE.BufferAttribute).version;
		helper.vectors(agent, force);
		expect((positions as THREE.BufferAttribute).version).toBeGreaterThan(
			version,
		);
	});

	it("is a scene object, freed by dispose", () => {
		const helper = new SteeringHelper();
		expect(helper.type).toBe("SteeringHelper");
		expect(helper.frustumCulled).toBe(false);
		const scene = new THREE.Scene();
		scene.add(helper);
		expect(scene.children).toContain(helper);
		let freed = 0;
		helper.geometry.addEventListener("dispose", () => freed++);
		helper.material.addEventListener("dispose", () => freed++);
		helper.dispose();
		expect(freed).toBe(2);
	});
});

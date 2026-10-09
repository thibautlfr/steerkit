// The aquarium, loaded with three on its own page: a school of fish
// flocking in a tank, around rocks, away from a shark. The fish are one
// instanced mesh (setInstances), the shark turns to face its way
// (faceVelocity), and the forces are drawn by a SteeringHelper.

import {
	type Agent,
	addWithin,
	alignment,
	avoidObstacles,
	cohesion,
	createGrid,
	createNeighbors,
	createWanderState,
	keepAway,
	pursue,
	queryGrid,
	separation,
	stayWithin,
	step,
	updateGrid,
	type WanderState,
	wander,
	zero,
} from "steerkit";
import { faceVelocity, SteeringHelper, setInstances } from "steerkit/three";
import {
	Box3,
	type BufferGeometry,
	Color,
	ConeGeometry,
	DirectionalLight,
	Fog,
	Group,
	HemisphereLight,
	IcosahedronGeometry,
	InstancedMesh,
	type Material,
	Mesh,
	MeshStandardMaterial,
	PlaneGeometry,
	Scene,
	SphereGeometry,
	Vector3,
} from "three";
import type { Player, Values } from "../demo.ts";
import { stageOf } from "./stage.ts";

export const MAX_FISH = 1000;

// The fish are agents whose vectors are THREE.Vector3, as they are
type Fish = Agent & { position: Vector3; velocity: Vector3 };

// 16 × 9 × 10 units, about the 2D demos' scale
const tank = new Box3(new Vector3(-8, -4.5, -5), new Vector3(8, 4.5, 5));
const rocks = [
	{ position: new Vector3(-4.5, -3.4, -1.5), radius: 1.5 },
	{ position: new Vector3(-4.5, -1.4, -1.5), radius: 0.9 },
	{ position: new Vector3(3.5, -3.6, 1.5), radius: 1.2 },
	{ position: new Vector3(1, -3.9, -3), radius: 0.8 },
	{ position: new Vector3(5.5, -3.7, -2.5), radius: 1 },
];

// Options, created once
const walls = { margin: 1, lookAhead: 1 };
const ahead = { radius: 0.3, lookAhead: 1 };
const scared = { radius: 4 };
const close = { radius: 0.5 };
// Fish see around them but not right behind
const around = { radius: 1, fieldOfView: (270 * Math.PI) / 180 };
// Near the shark, a fish is up to this many times faster and more agile,
// and the extra speed fades out over 0.6 s once it's safe
const PANIC_SPEED = 2;
const PANIC_FORCE = 3;
const FEAR = 12;
const fading = { overspeedDamping: 0.6 };
const sharkWalls = { margin: 1.5, lookAhead: 1.5 };
const sharkAhead = { radius: 0.6, lookAhead: 1.5 };
const cruising = {
	radius: 1.5,
	distance: 3,
	jitter: 1.5,
	plane: "xz",
} as const;
const swimming = { radius: 0.5, distance: 2, jitter: 2 };
const sharkTurn = { turnRate: 4 };
// The shark picks a fish to chase every few seconds
const HUNT_SECONDS = 6;
const chasing = {};

const css = (name: string): string =>
	getComputedStyle(document.documentElement)
		.getPropertyValue(`--${name}`)
		.trim();

const random = (min: number, max: number): number =>
	min + Math.random() * (max - min);

// A fish facing +z: a cone, tip forward, as setInstances expects
const fishGeometry = (): BufferGeometry =>
	new ConeGeometry(0.11, 0.42, 5).rotateX(Math.PI / 2);

// A shark facing +z: a long body, a dorsal fin and a tail
const sharkModel = (material: Material): Group => {
	const shark = new Group();
	const body = new Mesh(new SphereGeometry(1, 16, 12), material);
	body.scale.set(0.3, 0.34, 1);
	const fin = new Mesh(new ConeGeometry(0.16, 0.45, 4), material);
	fin.position.set(0, 0.38, 0.05);
	fin.rotation.x = -0.4;
	const tail = new Mesh(new ConeGeometry(0.22, 0.5, 4), material);
	tail.position.set(0, 0.05, -1.05);
	tail.rotation.x = -Math.PI / 2;
	tail.scale.set(0.3, 1, 1.4);
	shark.add(body, fin, tail);
	return shark;
};

export const play = (canvas: HTMLCanvasElement, values: Values): Player => {
	const stage = stageOf(canvas);
	const scene = new Scene();
	const water = new Color(css("water"));
	scene.background = water;
	scene.fog = new Fog(water, 18, 42);
	scene.add(new HemisphereLight(0xffffff, 0xc2a878, 2.2));
	const sun = new DirectionalLight(0xffffff, 1.6);
	sun.position.set(4, 10, 6);
	scene.add(sun);

	const sand = new MeshStandardMaterial({ roughness: 1 });
	const floor = new Mesh(new PlaneGeometry(16, 10), sand);
	floor.rotation.x = -Math.PI / 2;
	floor.position.y = tank.min.y;
	scene.add(floor);
	const stone = new MeshStandardMaterial({
		color: 0x8a8f99,
		roughness: 0.9,
		flatShading: true,
	});
	for (const rock of rocks) {
		const mesh = new Mesh(new IcosahedronGeometry(rock.radius, 1), stone);
		mesh.position.copy(rock.position);
		scene.add(mesh);
	}

	// The school, THREE.Vector3 as they are, drawn in one call
	const school: Fish[] = [];
	const forces: Vector3[] = [];
	const states: WanderState[] = [];
	const spawn = () => {
		const direction = new Vector3(
			random(-1, 1),
			random(-0.3, 0.3),
			random(-1, 1),
		);
		school.push({
			position: new Vector3(random(-6, 6), random(-1, 3.5), random(-3.5, 3.5)),
			velocity: direction.setLength(2),
			maxSpeed: 2,
			maxForce: 4,
		});
		forces.push(new Vector3());
		states.push(createWanderState());
	};
	const fish = new InstancedMesh(
		fishGeometry(),
		new MeshStandardMaterial({ roughness: 0.5, flatShading: true }),
		MAX_FISH,
	);
	// three computes the bounds of instances once, where they started
	fish.frustumCulled = false;
	const tint = new Color();
	for (let i = 0; i < MAX_FISH; i++) {
		fish.setColorAt(
			i,
			tint.setHSL(random(0.04, 0.12), 0.85, random(0.5, 0.62)),
		);
	}
	scene.add(fish);

	const sharkMaterial = new MeshStandardMaterial({ roughness: 0.7 });
	const sharkObject = sharkModel(sharkMaterial);
	sharkObject.position.set(-5, 0.5, 2);
	sharkObject.scale.setScalar(1.4);
	scene.add(sharkObject);
	// The shark lends its model's position: step moves the model
	const shark: Agent = {
		position: sharkObject.position,
		velocity: new Vector3(1.5, 0, -0.5),
		maxSpeed: 2.2,
		maxForce: 2,
	};
	const sharkState = createWanderState();
	let prey: Fish | undefined;
	let hunting = 0;
	const sharkForce = new Vector3();

	const helper = new SteeringHelper({ capacity: 20_000 });
	// Over the fish and the rocks, as debug lines are
	helper.material.depthTest = false;
	helper.renderOrder = 1;
	scene.add(helper);

	// The page's colors, light or dark
	const theme = () => {
		water.set(css("water"));
		(scene.fog as Fog).color.copy(water);
		sand.color.set(css("sand"));
		sharkMaterial.color.set(css("shark"));
		helper.colors.velocity.set(css("velocity"));
		helper.colors.desired.set(css("desired"));
		helper.colors.steering.set(css("steering"));
		helper.colors.shape.set(css("muted"));
		fish.setColorAt(0, tint.set(css("target")));
		if (fish.instanceColor) fish.instanceColor.needsUpdate = true;
	};
	theme();
	const scheme = matchMedia("(prefers-color-scheme: dark)");
	scheme.addEventListener("change", theme);

	let cellSize = 0;
	let grid = createGrid<Agent>({ cellSize: 1 });
	const near = createNeighbors<Agent>();
	const tmp = new Vector3();

	const player: Player = {
		vectors: true,
		stop: () => {
			stage.stop();
			scheme.removeEventListener("change", theme);
			scene.traverse((object) => {
				if (object instanceof Mesh) {
					object.geometry.dispose();
					(object.material as Material).dispose();
				}
			});
			helper.dispose();
		},
	};

	const update = (dt: number) => {
		const count = values.count ?? 300;
		while (school.length < count) spawn();
		school.length = Math.min(school.length, count);
		around.radius = values.radius ?? 1;
		close.radius = around.radius / 2;
		if (cellSize !== around.radius) {
			cellSize = around.radius;
			grid = createGrid<Agent>({ cellSize });
		}
		const predator = values.predator !== 1;
		sharkObject.visible = predator;

		updateGrid(grid, school);
		for (let i = 0; i < school.length; i++) {
			const one = school[i] as Fish;
			const force = forces[i] as Vector3;
			// Fear, 0 to 1 as the shark comes within reach
			const fear = predator
				? Math.max(
						0,
						1 - one.position.distanceTo(sharkObject.position) / scared.radius,
					)
				: 0;
			one.maxSpeed = (values.maxSpeed ?? 2) * (1 + PANIC_SPEED * fear);
			one.maxForce = (values.maxForce ?? 4) * (1 + PANIC_FORCE * fear);
			const budget = one.maxForce;
			const neighbors = queryGrid(grid, one.position, around.radius, near);
			zero(force);
			// Weighted, so the walls take most of the budget when they act: a
			// later force can still pull against an earlier one with what's
			// left, and fear did, sending fish through the glass
			addWithin(force, budget, stayWithin(one, tank, walls, tmp), 2);
			addWithin(force, budget, avoidObstacles(one, rocks, ahead, tmp), 3);
			if (predator) {
				addWithin(
					force,
					budget,
					keepAway(one, shark.position, scared, tmp),
					FEAR,
				);
			}
			addWithin(
				force,
				budget,
				separation(one, neighbors, close, tmp),
				values.separation ?? 2,
			);
			addWithin(
				force,
				budget,
				alignment(one, neighbors, around, tmp),
				values.alignment ?? 0.8,
			);
			addWithin(
				force,
				budget,
				cohesion(one, neighbors, around, tmp),
				// Scared fish scatter, and regroup once safe
				(values.cohesion ?? 0.4) * (1 - fear),
			);
			// What's left keeps them swimming: alignment alone matches the
			// neighbors' speed, and the school would slow down to a crawl
			addWithin(
				force,
				budget,
				wander(one, states[i] as WanderState, swimming, dt, tmp),
			);
			step(one, force, dt, fading);
		}
		setInstances(fish, school);

		if (predator) {
			zero(sharkForce);
			addWithin(
				sharkForce,
				shark.maxForce,
				stayWithin(shark, tank, sharkWalls, tmp),
				2,
			);
			addWithin(
				sharkForce,
				shark.maxForce,
				avoidObstacles(shark, rocks, sharkAhead, tmp),
				3,
			);
			hunting -= dt;
			if (hunting <= 0 || !prey || !school.includes(prey)) {
				prey = school[Math.floor(Math.random() * school.length)];
				hunting = HUNT_SECONDS;
			}
			if (prey) {
				addWithin(
					sharkForce,
					shark.maxForce,
					pursue(shark, prey, chasing, tmp),
				);
			}
			addWithin(
				sharkForce,
				shark.maxForce,
				wander(shark, sharkState, cruising, dt, tmp),
			);
			step(shark, sharkForce, dt);
			faceVelocity(sharkObject, shark.velocity, dt, sharkTurn);
		}

		// The walls always; the forces, the obstacles as the fish see them
		// and the shark's reach when shown
		helper.reset();
		helper.box(tank);
		if (!player.vectors) return;
		for (const rock of rocks) helper.sphere(rock.position, rock.radius);
		const shown = values.forces === 1 ? school.length : 1;
		for (let i = 0; i < shown && i < school.length; i++) {
			helper.vectors(school[i] as Agent, forces[i] as Vector3);
		}
		if (predator) {
			helper.vectors(shark, sharkForce);
			helper.sphere(shark.position, scared.radius);
		}
	};

	stage.play(scene, update);
	return player;
};

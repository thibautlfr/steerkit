// The aquarium's page: its sliders and code. The scene itself, and three
// with it, load only when the page is shown (../three/aquarium.ts).

import { agentParams, type Demo3D, n } from "../demo.ts";
import { page } from "../pages.ts";

export const aquariumDemo: Demo3D = {
	...page("aquarium"),
	hint: "Drag to turn the tank",
	params: [
		{ key: "count", label: "fish", value: 300, min: 50, max: 1000, step: 50 },
		{
			key: "separation",
			label: "separation weight",
			value: 1.5,
			min: 0,
			max: 4,
			step: 0.05,
		},
		{
			key: "alignment",
			label: "alignment weight",
			value: 1,
			min: 0,
			max: 4,
			step: 0.05,
		},
		{
			key: "cohesion",
			label: "cohesion weight",
			value: 1,
			min: 0,
			max: 4,
			step: 0.05,
		},
		{ key: "radius", label: "radius", value: 1.2, min: 0.4, max: 3, step: 0.1 },
		{ key: "predator", label: "shark", value: 0, options: ["on", "off"] },
		{
			key: "forces",
			label: "forces drawn",
			value: 0,
			options: ["one fish", "every fish"],
		},
		...agentParams(2.5, 4),
	],
	code: (v) => {
		const radius = n(v.radius ?? 0);
		const shark =
			v.predator === 1
				? ""
				: "\n\taddWithin(force, f.maxForce, keepAway(f, shark.position, { radius: 3 }, tmp), 4);";
		const drawn =
			v.forces === 1
				? "school.forEach((f, i) => helper.vectors(f, forces[i]));"
				: "helper.vectors(school[0], forces[0]);";
		return `import { faceVelocity, setInstances, SteeringHelper } from "steerkit/three";

// Each fish: { position, velocity } as THREE.Vector3, maxSpeed ${n(v.maxSpeed ?? 0)}, maxForce ${n(v.maxForce ?? 0)}
const fish = new THREE.InstancedMesh(cone, material, 1000); // facing +z
fish.frustumCulled = false; // three doesn't follow moving instances
const tank = new THREE.Box3(min, max); // as is
const rocks = [{ position, radius }, …];
const grid = createGrid({ cellSize: ${radius} });
const near = createNeighbors();
const helper = new SteeringHelper();
scene.add(fish, helper);

// Every frame: walls and rocks first, the flock with what's left
updateGrid(grid, school);
school.forEach((f, i) => {
	const neighbors = queryGrid(grid, f.position, ${radius}, near);
	const force = zero(forces[i]);
	addWithin(force, f.maxForce, stayWithin(f, tank, { margin: 1, lookAhead: 1 }, tmp));
	addWithin(force, f.maxForce, avoidObstacles(f, rocks, { radius: 0.3, lookAhead: 1 }, tmp), 3);${shark}
	addWithin(force, f.maxForce, separation(f, neighbors, { radius: ${n((v.radius ?? 0) / 2)} }, tmp), ${n(v.separation ?? 0)});
	addWithin(force, f.maxForce, alignment(f, neighbors, { radius: ${radius} }, tmp), ${n(v.alignment ?? 0)});
	addWithin(force, f.maxForce, cohesion(f, neighbors, { radius: ${radius} }, tmp), ${n(v.cohesion ?? 0)});
	step(f, force, dt);
});
setInstances(fish, school); // positions and headings, one draw call${
			v.predator === 1
				? ""
				: "\nfaceVelocity(sharkMesh, shark.velocity, dt, { turnRate: 4 }); // its position is the mesh's"
		}

// The forces, for debugging
helper.reset();
helper.box(tank);
${drawn}`;
	},
	load: () => import("../three/aquarium.ts"),
};

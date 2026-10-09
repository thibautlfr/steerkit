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
			value: 2,
			min: 0,
			max: 4,
			step: 0.05,
		},
		{
			key: "alignment",
			label: "alignment weight",
			value: 0.8,
			min: 0,
			max: 4,
			step: 0.05,
		},
		{
			key: "cohesion",
			label: "cohesion weight",
			value: 0.4,
			min: 0,
			max: 4,
			step: 0.05,
		},
		{ key: "radius", label: "radius", value: 1, min: 0.4, max: 3, step: 0.1 },
		{ key: "predator", label: "shark", value: 0, options: ["on", "off"] },
		{
			key: "forces",
			label: "forces drawn",
			value: 0,
			options: ["one fish", "every fish"],
		},
		...agentParams(2, 4),
	],
	code: (v) => {
		const radius = n(v.radius ?? 0);
		const shark =
			v.predator === 1
				? ""
				: "\n\taddWithin(force, f.maxForce, keepAway(f, shark.position, { radius: 4 }, tmp), 12);";
		// Panic: faster and more agile near the shark, the extra speed fading
		// out once safe (step's overspeedDamping)
		const fear =
			v.predator === 1
				? ""
				: `\n\tconst fear = Math.max(0, 1 - f.position.distanceTo(shark.position) / 4);\n\tf.maxSpeed = ${n(v.maxSpeed ?? 0)} * (1 + 2 * fear);\n\tf.maxForce = ${n(v.maxForce ?? 0)} * (1 + 3 * fear);`;
		const drawn =
			v.forces === 1
				? "school.forEach((f, i) => helper.vectors(f, forces[i]));"
				: "helper.vectors(school[0], forces[0]);";
		return `import { faceVelocity, setInstances, SteeringHelper } from "steerkit/three";

// Each fish: { position, velocity } as THREE.Vector3, maxSpeed and maxForce
const fish = new THREE.InstancedMesh(cone, material, 1000); // facing +z
fish.frustumCulled = false; // three doesn't follow moving instances
const tank = new THREE.Box3(min, max); // as is
const rocks = [{ position, radius }, …];
const grid = createGrid({ cellSize: ${radius} });
const sight = { radius: ${radius}, fieldOfView: (270 * Math.PI) / 180 }; // not right behind
const near = createNeighbors();
const helper = new SteeringHelper();
scene.add(fish, helper);

// Every frame: walls and rocks first, the flock with what's left
updateGrid(grid, school);
school.forEach((f, i) => {
	const neighbors = queryGrid(grid, f.position, ${radius}, near);${fear}
	const force = zero(forces[i]);
	addWithin(force, f.maxForce, stayWithin(f, tank, { margin: 1, lookAhead: 1 }, tmp));
	addWithin(force, f.maxForce, avoidObstacles(f, rocks, { radius: 0.3, lookAhead: 1 }, tmp), 3);${shark}
	addWithin(force, f.maxForce, separation(f, neighbors, { radius: ${n((v.radius ?? 0) / 2)} }, tmp), ${n(v.separation ?? 0)});
	addWithin(force, f.maxForce, alignment(f, neighbors, sight, tmp), ${n(v.alignment ?? 0)});
	addWithin(force, f.maxForce, cohesion(f, neighbors, sight, tmp), ${n(v.cohesion ?? 0)}${v.predator === 1 ? "" : " * (1 - fear)"});
	addWithin(force, f.maxForce, wander(f, states[i], { radius: 0.5, distance: 2, jitter: 2 }, dt, tmp)); // keeps them swimming
	step(f, force, dt, { overspeedDamping: 0.6 });
});
setInstances(fish, school); // positions and headings, one draw call${
			v.predator === 1
				? ""
				: "\n\n// The shark chases a fish picked every 6 s, and turns smoothly\naddWithin(sharkForce, shark.maxForce, pursue(shark, prey, {}, tmp));\nfaceVelocity(sharkMesh, shark.velocity, dt, { turnRate: 4 }); // its position is the mesh's"
		}

// The forces, for debugging
helper.reset();
helper.box(tank);
${drawn}`;
	},
	load: () => import("../three/aquarium.ts"),
};

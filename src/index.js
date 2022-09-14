import * as THREE from "three";

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { deinterleaveAttribute } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import Ammo from "ammojs-typed";
import { AmmoDebugDrawer, DefaultBufferSize } from "ammo-debug-drawer";

Ammo(Ammo).then(start);

let tempBtVec3_1;
let physicsWorld;
let debugGeometry, debugDrawer;
let collisionConfiguration, dispatcher, broadphase, solver;

// import cabinet from "../public/cabinet.glb";
// Canvas

const canvas = document.querySelector("canvas.webgl");

// Scene
const scene = new THREE.Scene();

/**
 * Lights
 */

const tick = () => {
  // Update controls
  controls.update();

  physicsWorld.stepSimulation(0.01, 10);
  if (debugDrawer) {
    if (debugDrawer.index !== 0) {
      debugGeometry.attributes.position.needsUpdate = true;
      debugGeometry.attributes.color.needsUpdate = true;
    }
    debugGeometry.setDrawRange(0, debugDrawer.index);
  }
  debugDrawer.update();

  // Render
  renderer.render(scene, camera);

  // Call tick again on the next frame
  window.requestAnimationFrame(tick);
};

const initDebug = () => {
  var debugVertices = new Float32Array(DefaultBufferSize);
  var debugColors = new Float32Array(DefaultBufferSize);
  debugGeometry = new THREE.BufferGeometry();

  var verts_ba = new THREE.BufferAttribute(debugVertices, 3).setUsage(
    THREE.DynamicDrawUsage
  );
  var colors_ba = new THREE.BufferAttribute(debugColors, 3).setUsage(
    THREE.DynamicDrawUsage
  );
  debugGeometry.setAttribute("position", verts_ba);
  debugGeometry.setAttribute("color", colors_ba);

  var debugMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
  var debugMesh = new THREE.LineSegments(debugGeometry, debugMaterial);

  // console.log(debugMesh);
  debugMesh.frustumCulled = false;
  scene.add(debugMesh);
  debugDrawer = new AmmoDebugDrawer(
    null,
    debugVertices,
    debugColors,
    physicsWorld
  );
  // console.log(debugDrawer);
  debugDrawer.enable();
  debugDrawer.setDebugMode(1);
  tick();
};

function start() {
  collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
  dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
  broadphase = new Ammo.btDbvtBroadphase();
  solver = new Ammo.btSequentialImpulseConstraintSolver();
  physicsWorld = new Ammo.btDiscreteDynamicsWorld(
    dispatcher,
    broadphase,
    solver,
    collisionConfiguration
  );
  physicsWorld.setGravity(new Ammo.btVector3(0, 0, 0));
  tempBtVec3_1 = new Ammo.btVector3(0, 0, 0);
  initDebug();
}

const ambientLight = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0xffffff, 1);
pointLight.position.set = 2;
pointLight.position.y = 3;
pointLight.position.z = 4;
scene.add(pointLight);

const sizes = {
  width: window.innerWidth,
  height: window.innerHeight
};

window.addEventListener("resize", () => {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

const camera = new THREE.PerspectiveCamera(
  75,
  sizes.width / sizes.height,
  0.1,
  100
);

camera.position.set(1, 1, 2);
scene.add(camera);

// Controls
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

/**
 * Renderer
 */

const renderer = new THREE.WebGLRenderer({
  canvas: canvas
});

renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const ktxLoader = new KTX2Loader();
ktxLoader.setTranscoderPath("/public/basis/");
ktxLoader.detectSupport(renderer);

const gltfLoader = new GLTFLoader();
gltfLoader.setKTX2Loader(ktxLoader);

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("./draco/gltf/");
dracoLoader.preload();
// gltfLoader.setDRACOLoader(dracoLoader);

/*
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath("./draco/gltf/");
  dracoLoader.preload();
  gltfLoader.setDRACOLoader(dracoLoader);
  gltfLoader.setKTX2Loader(ktx2Loader.detectSupport(renderer));
  gltfLoader.setKTX2Loader(ktx2Loader.detectSupport(renderer));

*/

let threeObj = null;

try {
  gltfLoader.load(
    "/public/Sofa.glb",
    (gltf) => {
      // console.log("success", gltf);
      scene.add(gltf.scene);
      threeObj = gltf;
      createBody(threeObj);
      console.info("gltf: ", gltf);
    },
    (progress) => {
      // console.log("progress", progress);
    },
    (error) => {
      console.log("error", error);
    }
  );
} catch (err) {
  console.info("err", err);
}

// const dfs = (obj, geometries) => {
//   if (!obj["children"] || obj["children"].length === 0) {
//     if (
//       obj.type === "Mesh" &&
//       obj.material.name.includes("imension") === false &&
//       obj.name !== "position_rug"
//     ) {
//       geometries.push(obj.geometry);
//     }
//     return;
//   }
//   for (let child of obj["children"].values()) {
//     dfs(child, geometries);
//   }
// };
function getVertexPositions(root) {
  const positions = [];
  root.updateMatrixWorld(true);

  root.traverse((obj) => {
    if (
      obj.type !== "Mesh" ||
      obj.material.name.includes("imension") === true ||
      obj.name === "position_rug"
    )
      return;

    let position = obj.geometry.attributes.position;

    if (position.isInterleavedBufferAttribute) {
      // de-interleave the array
      position = deinterleaveAttribute(position);
      // cast from Int16 to Float32
      position = new THREE.BufferAttribute(
        new Float32Array(position.array),
        position.itemSize,
        false
      );

      // apply mesh scaling to the positions array.
      position.applyMatrix4(obj.matrixWorld);
    }
    positions.push(position);
  });

  return positions;
}

const createConvexHullPhysicsShape = (coords) => {
  const shape = new Ammo.btConvexHullShape();
  for (let i = 0, il = coords.length; i < il; i += 3) {
    tempBtVec3_1.setValue(coords[i], coords[i + 1], coords[i + 2]);
    const lastOne = i >= il - 3;
    shape.addPoint(tempBtVec3_1, lastOne);
  }
  return shape;
};

const createBody = () => {
  // console.log("threeeeObj", threeObj);
  // const geometries = [];
  // dfs(threeObj.scene, geometries);
  // console.log("geoooo", geometries);

  const shape = new Ammo.btCompoundShape();

  // for (let geometry of geometries) {
  //   points += geometry.attributes.position.array.length;

  //   let arr = [];
  //   if (geometry.attributes.position.isInterleavedBufferAttribute) {
  //     console.log(
  //       "is: ",
  //       geometry.attributes.position,
  //       geometry.attributes.position.normalized
  //     );
  //     const newArray = deinterleaveAttribute(geometry.attributes.position);
  //     // console.log("deinterleaved", newArray);
  //     // console.log("ajay", newArray.array);
  //     arr = newArray.array;
  //     // let maxval = 0;
  //     // for (let i = 0; i < newArray.array.length; i++) {
  //     //   arr.push(Math.max(Number(newArray.array[i]) / 32767.0, -1.0));
  //     //   maxval = Math.max(maxval, newArray.array[i]);
  //     // }
  //     // console.log("maxval", maxval);
  //     // debugger;
  //   } else {
  //     arr = geometry.attributes.position.array;
  //   }
  //   // console.log("arr", arr);

  const arr = getVertexPositions(threeObj.scene);

  console.info("arr", arr, typeof arr);

  for (let obj of arr) {
    const x = obj.array ? obj.array : obj;
    const pShape = createConvexHullPhysicsShape(x);
    const transform = new Ammo.btTransform();
    transform.setIdentity();
    pShape.setMargin(0);
    shape.addChildShape(transform, pShape);
    console.info("shape", shape);
  }
  // }
  // console.log("points", points);
  const transform_1 = new Ammo.btTransform();
  transform_1.setIdentity();
  const pos = threeObj.scene.position;
  const quat = threeObj.scene.quaternion;
  // console.log("possss", pos);
  transform_1.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
  transform_1.setRotation(
    new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w)
  );
  const motionState = new Ammo.btDefaultMotionState(transform_1);

  const localInertia = new Ammo.btVector3(0, 0, 0);

  const mass = 0;
  shape.calculateLocalInertia(mass, localInertia);

  const rbInfo = new Ammo.btRigidBodyConstructionInfo(
    mass,
    motionState,
    shape,
    localInertia
  );
  const body = new Ammo.btRigidBody(rbInfo);

  body.setCollisionFlags(2);
  body.setActivationState(4);
  physicsWorld.addRigidBody(body);
};

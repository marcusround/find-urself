/*
 *
 * This uses code from a THREE.js Multiplayer boilerplate made by Or Fleisher:
 * https://github.com/juniorxsound/THREE.Multiplayer
 * Aidan Nelson, April 2020
 *
 */


class Scene {
  constructor() {
    //THREE scene
    this.scene = new THREE.Scene();
    //this.scene = new Physijs.Scene();
    this.world = new CANNON.World();
    this.world.gravity.set(0, -9.82, 0);

    this.clock = new THREE.Clock();
    this.delta;
    this.head;
    this.spherebody;

    //Utility
    this.width = window.innerWidth;
    this.height = window.innerHeight * 0.9;

    // lerp value to be used when interpolating positions and rotations
    this.lerpValue = 0;

    //THREE Camera
    this.camera = new THREE.PerspectiveCamera(
      50,
      this.width / this.height,
      0.1,
      5000
    );
    this.camera.position.set(0, 3, 6);
    this.scene.add(this.camera);

    // create an AudioListener and add it to the camera
    this.listener = new THREE.AudioListener();
    this.camera.add(this.listener);

    //THREE WebGL renderer
    this.renderer = new THREE.WebGLRenderer({
      antialiasing: true,
    });
    this.renderer.setClearColor(new THREE.Color("lightblue"));
    this.renderer.setSize(this.width, this.height);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputEncoding = THREE.sRGBEncoding;

    const pmremGenerator = new THREE.PMREMGenerator( this.renderer );
    pmremGenerator.compileEquirectangularShader();

    // add controls:
    this.controls = new FirstPersonControls(this.scene, this.camera, this.renderer);

    //Push the canvas to the DOM
    let domElement = document.getElementById("canvas-container");
    domElement.append(this.renderer.domElement);

    //Setup event listeners for events and handle the states
    window.addEventListener("resize", (e) => this.onWindowResize(e), false);

    //gltf loader
    // const loader = new THREE.GLTFLoader();
    var sceneref = this.scene;
    var renderref = this.renderer;
    var cameraref = this.camera;
    var worldref = this.world;
    var modelref;

    // const loader = new THREE.GLTFLoader()

				new THREE.RGBELoader()
					.load('assets/kloppenheim_02_puresky_4k.hdr', function ( texture ) {

						texture.mapping = THREE.EquirectangularReflectionMapping;

						sceneref.background = texture;
						sceneref.environment = texture;

						renderref.render(sceneref, cameraref);

						// model

						const loader = new THREE.GLTFLoader()
						loader.load('assets/ballpit.glb', async function ( gltf ) {

							const model = gltf.scene;

							// wait until the model can be added to the scene without blocking due to shader compilation

              // console.log(model);
              // var modelmesh;
              // var modelbody;
              // model.traverse(function (child) {
              //   if ((child instanceof THREE.Mesh)) {
              //       modelmesh = child;
              //       modelmesh.receiveShadow = true;
              //       modelmesh.castShadow = true;
              //       let modelshape = CreateTrimesh(modelmesh.geometry);
              //       modelbody = new CANNON.Body({
              //         mass: 1
              //       });
              //       modelbody.addShape(modelshape);
              //       modelbody.position.x = modelmesh.position.x;
              //       modelbody.position.y = modelmesh.position.y;
              //       modelbody.position.z = modelmesh.position.z;
              //       worldref.addBody(modelbody);
              //   }
              // }) 
							//await renderref.compileAsync( model, cameraref, sceneref );

              modelref = model;
							sceneref.add( model );

              renderref.render(sceneref, cameraref);
			
						} );

					} );

    //console.log(ballpit);
    //this.scene.add(ballpit);

    // Helpers
    this.scene.add(new THREE.GridHelper(500, 500));
    this.scene.add(new THREE.AxesHelper(10));

    this.addLights();
    createEnvironment(this.scene);

    // Start the loop
    this.frameCount = 0;
    this.update();
  }

  //////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////
  // Lighting 💡

  addLights() {
    this.scene.add(new THREE.AmbientLight(0xffffe6, 0.7));
  }

  //////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////
  // Clients 👫

  // add a client meshes, a video element and  canvas for three.js video texture
  addClient(id) {
    let videoMaterial = makeVideoMaterial(id);
    let otherMat = new THREE.MeshNormalMaterial();

    let rand = Math.random();
    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.65, 48, 21), videoMaterial);
    // let sphereshape = new CANNON.Sphere(1)
    // this.spherebody = new CANNON.Body({
    //   mass: 1
    // })
    this.head.position.set(0, 0, 0);
    // this.spherebody.addShape(sphereshape);
    // this.spherebody.position.x = this.head.position.x;
    // this.spherebody.position.y = this.head.position.y;
    // this.spherebody.position.z = this.head.position.z;
    // this.world.addBody(this.spherebody)
    // set position of head before adding to parent object

    // https://threejs.org/docs/index.html#api/en/objects/Group
    var group = new THREE.Group();
    group.add(this.head);

    // add group to scene
    this.scene.add(group);

    peers[id].group = group;
    
    peers[id].previousPosition = new THREE.Vector3();
    peers[id].previousRotation = new THREE.Quaternion();
    peers[id].desiredPosition = new THREE.Vector3();
    peers[id].desiredRotation = new THREE.Quaternion();
  }

  removeClient(id) {
    this.scene.remove(peers[id].group);
  }

  // overloaded function can deal with new info or not
  updateClientPositions(clientProperties) {
    this.lerpValue = 0;
    for (let id in clientProperties) {
      if (id != mySocket.id) {
        peers[id].previousPosition.copy(peers[id].group.position);
        peers[id].previousRotation.copy(peers[id].group.quaternion);
        peers[id].desiredPosition = new THREE.Vector3().fromArray(
          clientProperties[id].position
        );
        peers[id].desiredRotation = new THREE.Quaternion().fromArray(
          clientProperties[id].rotation
        );
      }
    }
  }

  interpolatePositions() {
    this.lerpValue += 0.1; // updates are sent roughly every 1/5 second == 10 frames
    for (let id in peers) {
      if (peers[id].group) {
        peers[id].group.position.lerpVectors(peers[id].previousPosition,peers[id].desiredPosition, this.lerpValue);
        peers[id].group.quaternion.slerpQuaternions(peers[id].previousRotation,peers[id].desiredRotation, this.lerpValue);
      }
    }
  }

  updateClientVolumes() {
    for (let id in peers) {
      let audioEl = document.getElementById(id + "_audio");
      if (audioEl && peers[id].group) {
        let distSquared = this.camera.position.distanceToSquared(
          peers[id].group.position
        );

        if (distSquared > 500) {
          audioEl.volume = 0;
        } else {
          // from lucasio here: https://discourse.threejs.org/t/positionalaudio-setmediastreamsource-with-webrtc-question-not-hearing-any-sound/14301/29
          let volume = Math.min(1, 10 / distSquared);
          audioEl.volume = volume;
        }
      }
    }
  }

  //////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////
  // Interaction 🤾‍♀️

  getPlayerPosition() {
    // TODO: use quaternion or are euler angles fine here?
    return [
      [
        this.camera.position.x,
        this.camera.position.y,
        this.camera.position.z,
      ],
      [
        this.camera.quaternion._x,
        this.camera.quaternion._y,
        this.camera.quaternion._z,
        this.camera.quaternion._w,
      ],
    ];
  }

  //////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////
  // Rendering 🎥

  update() {
    requestAnimationFrame(() => this.update());
    this.frameCount++;

    updateEnvironment();

    this.delta = Math.min(this.clock.getDelta(), 0.1);
    this.world.step(this.delta);

    // if(this.head !== undefined){
    //   this.head.position.set(this.spherebody.position.x, this.spherebody.position.y, this.spherebody.position.z)
    //   this.head.quaternion.set(
    //     this.spherebody.quaternion.x,
    //     this.spherebody.quaternion.y,
    //     this.spherebody.quaternion.z,
    //     this.spherebody.quaternion.w
    //   )
    // }

    //   modelref.traverse(function (child) {
    //     if ((child instanceof THREE.Mesh)) {
    //         modelmesh = child;
    //         modelmesh.receiveShadow = true;
    //         modelmesh.castShadow = true;
    //         let modelshape = CreateTrimesh(modelmesh.geometry);
    //         modelbody = new CANNON.Body({
    //           mass: 1
    //         });
    //         modelmodelbody.addShape(modelshape);
    //         modelbody.position.x = modelmesh.position.x;
    //         modelbody.position.y = modelmesh.position.y;
    //         modelbody.position.z = modelmesh.position.z;
    //         worldref.addBody(modelbody);
    //     }
    //   }) 
    //   modelmesh.position.set(
    //     modelbody.position.x,
    //     monkeyBody.position.y,
    //     monkeyBody.position.z
    //   )
    //   monkeyMesh.quaternion.set(
    //     monkeyBody.quaternion.x,
    //     monkeyBody.quaternion.y,
    //     monkeyBody.quaternion.z,
    //     monkeyBody.quaternion.w
    //   )

    if (this.frameCount % 25 === 0) {
      this.updateClientVolumes();
    }

    this.interpolatePositions();
    this.controls.update();
    this.render();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  //////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////
  // Event Handlers 🍽

  onWindowResize(e) {
    this.width = window.innerWidth;
    this.height = Math.floor(window.innerHeight * 0.9);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
  }
}

//////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////
// Utilities

function makeVideoMaterial(id) {
  let videoElement = document.getElementById(id + "_video");
  let videoTexture = new THREE.VideoTexture(videoElement);

  let videoMaterial = new THREE.MeshBasicMaterial({
    map: videoTexture,
    needsUpdate: true,
    overdraw: true,
    side: THREE.DoubleSide,
  });

  return videoMaterial;
}

function CreateTrimesh(geometry) {
  let vertices
  if (geometry.index === null) {
      vertices = geometry.attributes.position.array
  } else {
      vertices = geometry.clone().toNonIndexed().attributes.position.array
  }
  const indices = Object.keys(vertices).map(Number)
  return new CANNON.Trimesh(vertices, indices)
}

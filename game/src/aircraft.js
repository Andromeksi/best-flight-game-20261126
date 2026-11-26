/* Archipelago Run — aircraft.js
   The player's island-hopper, built from primitives so it reads as a
   real machine: fuselage, nose cone, glass canopy, swept main wings
   with tip tanks, tailplane, fin, orange livery stripes, spinning
   propeller, blinking nav lights and a boost glow at the tail.
   Nose points along -Z; the engine yaws it with rotation.y = heading. */

function buildAircraft() {
  var plane = new THREE.Group();
  var bodyMat = new THREE.MeshPhongMaterial({ color: 0xf2f0e6, shininess: 60, specular: 0x888888 });
  var orangeMat = new THREE.MeshPhongMaterial({ color: 0xff7a1a, shininess: 60 });
  var tealMat = new THREE.MeshPhongMaterial({ color: 0x0e6b7a, shininess: 60 });
  var darkMat = new THREE.MeshPhongMaterial({ color: 0x2a2f36, shininess: 40 });
  var glassMat = new THREE.MeshPhongMaterial({ color: 0x16324a, shininess: 140, specular: 0xcfe6ff });

  /* Fuselage: narrow end (cylinder top) toward the nose (-Z). */
  var fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 1.15, 7.2, 14), bodyMat);
  fuselage.rotation.x = -Math.PI / 2;
  plane.add(fuselage);

  /* Orange nose cone. */
  var nose = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.7, 14), orangeMat);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -4.4;
  plane.add(nose);

  /* Tail cone. */
  var tail = new THREE.Mesh(new THREE.ConeGeometry(1.15, 1.5, 14), bodyMat);
  tail.rotation.x = Math.PI / 2;
  tail.position.z = 4.2;
  plane.add(tail);

  /* Glass canopy. */
  var canopy = new THREE.Mesh(new THREE.SphereGeometry(0.85, 16, 12), glassMat);
  canopy.scale.set(0.9, 0.62, 1.6);
  canopy.position.set(0, 0.85, -1.2);
  plane.add(canopy);

  /* Main wings + orange stripe + tip tanks. */
  var wing = new THREE.Mesh(new THREE.BoxGeometry(11, 0.22, 2.4), bodyMat);
  wing.position.set(0, -0.1, 0.4);
  plane.add(wing);
  var wingStripe = new THREE.Mesh(new THREE.BoxGeometry(11.02, 0.06, 0.55), orangeMat);
  wingStripe.position.set(0, 0.04, 0.4);
  plane.add(wingStripe);
  var tankGeo = new THREE.CylinderGeometry(0.34, 0.34, 1.6, 10);
  var tankL = new THREE.Mesh(tankGeo, tealMat);
  tankL.rotation.x = Math.PI / 2;
  tankL.position.set(-5.5, -0.1, 0.4);
  plane.add(tankL);
  var tankR = new THREE.Mesh(tankGeo, tealMat);
  tankR.rotation.x = Math.PI / 2;
  tankR.position.set(5.5, -0.1, 0.4);
  plane.add(tankR);

  /* Tailplane and fin, with an orange fin stripe. */
  var tailplane = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.18, 1.4), bodyMat);
  tailplane.position.set(0, 0.25, 3.2);
  plane.add(tailplane);
  var fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.0, 1.6), orangeMat);
  fin.position.set(0, 1.0, 3.2);
  plane.add(fin);

  /* Livery stripes along the fuselage flanks. */
  var stripeGeo = new THREE.BoxGeometry(0.08, 0.28, 6.8);
  var stripeL = new THREE.Mesh(stripeGeo, orangeMat);
  stripeL.position.set(-1.02, 0.15, 0);
  plane.add(stripeL);
  var stripeR = new THREE.Mesh(stripeGeo, orangeMat);
  stripeR.position.set(1.02, 0.15, 0);
  plane.add(stripeR);

  /* Propeller: spinner + motion-blur disc, spins around the Z shaft.
     The disc reads as a spinning blur, never as a static X cross. */
  var propeller = new THREE.Group();
  var spinner = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 10), orangeMat);
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.z = -0.4;
  propeller.add(spinner);
  var discMat = new THREE.MeshBasicMaterial({
    color: 0xb8c0c8, transparent: true, opacity: 0.35, side: THREE.DoubleSide
  });
  var blurDisc = new THREE.Mesh(new THREE.CircleGeometry(1.5, 32), discMat);
  propeller.add(blurDisc);
  var hub = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), darkMat);
  hub.position.z = 0.05;
  propeller.add(hub);
  propeller.position.set(0, 0, -5.2);
  plane.add(propeller);

  /* Boost glow at the tail, brightens with throttle. */
  var boostGlow = new THREE.Mesh(
    new THREE.ConeGeometry(0.75, 2.4, 12),
    new THREE.MeshBasicMaterial({ color: 0x7fd4ff, transparent: true, opacity: 0 })
  );
  boostGlow.rotation.x = Math.PI / 2;
  boostGlow.position.set(0, 0, 4.9);
  plane.add(boostGlow);

  /* Muzzle flashes at the wing guns. */
  var flashMat = new THREE.MeshBasicMaterial({ color: 0xffe27a });
  var muzzleL = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), flashMat);
  muzzleL.position.set(-2.4, -0.05, -1.0);
  muzzleL.visible = false;
  plane.add(muzzleL);
  var muzzleR = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), flashMat);
  muzzleR.position.set(2.4, -0.05, -1.0);
  muzzleR.visible = false;
  plane.add(muzzleR);

  /* Wingtip nav lights: red left, green right. */
  var navLeft = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xff2a2a })
  );
  navLeft.position.set(-5.5, 0, 0.4);
  plane.add(navLeft);
  var navRight = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0x2aff5a })
  );
  navRight.position.set(5.5, 0, 0.4);
  plane.add(navRight);

  plane.rotation.order = 'YXZ';
  plane.userData.propeller = propeller;
  plane.userData.boostGlow = boostGlow;
  plane.userData.navLeft = navLeft;
  plane.userData.navRight = navRight;
  plane.userData.muzzles = [muzzleL, muzzleR];
  return plane;
}

function animateAircraft(plane, dt, throttle, time) {
  var ud = plane.userData;
  /* Propeller spins faster with throttle. */
  ud.propeller.rotation.z += dt * (6 + throttle * 42);
  /* Boost glow grows and brightens with throttle. */
  ud.boostGlow.material.opacity = 0.15 + throttle * 0.6;
  ud.boostGlow.scale.set(1, 1, 0.6 + throttle * 1.3);
  /* Nav lights blink slowly so the aircraft reads at distance. */
  var blink = (time % 1.2) < 0.85;
  ud.navLeft.visible = blink;
  ud.navRight.visible = blink;
}

function showMuzzleFlash(plane, on) {
  var muzzles = plane.userData.muzzles;
  muzzles[0].visible = on;
  muzzles[1].visible = on;
}

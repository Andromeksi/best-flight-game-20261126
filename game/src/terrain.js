/* Archipelago Run — terrain.js
   Builds the island chain: a procedural heightfield with coastline,
   beaches, green slopes, rocky peaks and snow caps; a teal sea; a
   flattened runway island with a striped runway, threshold lights and
   a windsock; drifting clouds; a warm sunset sky dome with sun; and
   the glowing target-ring course. Everything is generated from numbers
   at load time — no network, no fetch, no external assets. */

function archipelagoSeededRand(seed) {
  var s = seed >>> 0;
  return function seededRand() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function archipelagoSmoothstep(edge0, edge1, x) {
  var t = (x - edge0) / (edge1 - edge0);
  if (t < 0) t = 0;
  if (t > 1) t = 1;
  return t * t * (3 - 2 * t);
}

/* Seven islands: x, z, radius, peak height. Island 0 is the runway island:
   a low hill (peak 30), not a mountain — the natural first turn off the
   runway crosses its slopes while the plane is still climbing out, so a
   tall peak there killed fresh launches. The big peaks stay on the
   outer islands (88 / 70 / 95). */
var ARCHIPELAGO_ISLANDS = [
  { x: 0, z: 0, r: 230, peak: 30 },
  { x: 330, z: -190, r: 150, peak: 88 },
  { x: -320, z: -160, r: 140, peak: 70 },
  { x: 300, z: 260, r: 170, peak: 64 },
  { x: -300, z: 280, r: 150, peak: 95 },
  { x: 40, z: -430, r: 120, peak: 52 },
  { x: -430, z: 40, r: 110, peak: 44 }
];

function archipelagoHeightAt(x, z) {
  var h = -4;
  var i, dx, dz, d, fall;
  for (i = 0; i < ARCHIPELAGO_ISLANDS.length; i++) {
    dx = x - ARCHIPELAGO_ISLANDS[i].x;
    dz = z - ARCHIPELAGO_ISLANDS[i].z;
    d = Math.sqrt(dx * dx + dz * dz) / ARCHIPELAGO_ISLANDS[i].r;
    if (d < 1) {
      fall = 0.5 + 0.5 * Math.cos(d * Math.PI);
      h += ARCHIPELAGO_ISLANDS[i].peak * fall * fall;
    }
  }
  if (h > 0) {
    h += 2.0 * Math.sin(x * 0.045 + 1.7) * Math.cos(z * 0.05 + 0.6);
    h += 1.1 * Math.sin(x * 0.11) * Math.sin(z * 0.09 + 2.0);
    if (h < 0) h = 0;
  }
  /* Flatten a strip on the main island into the runway shelf (height 6). */
  var ax = Math.abs(x);
  var az = Math.abs(z);
  var feather = (1 - archipelagoSmoothstep(90, 130, ax)) *
                (1 - archipelagoSmoothstep(14, 40, az));
  if (feather > 0) h = h * (1 - feather) + 6 * feather;
  return h;
}

function archipelagoSkyTexture() {
  var canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 512;
  var ctx = canvas.getContext('2d');
  var grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#0d2a52');
  grad.addColorStop(0.42, '#3f6ea5');
  grad.addColorStop(0.60, '#ff9e57');
  grad.addColorStop(0.74, '#ffd9a0');
  grad.addColorStop(1.0, '#ffe9c4');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 512);
  return new THREE.CanvasTexture(canvas);
}

function archipelagoGlowTexture() {
  var canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  var ctx = canvas.getContext('2d');
  var grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,200,110,0.9)');
  grad.addColorStop(0.45, 'rgba(255,140,26,0.35)');
  grad.addColorStop(1, 'rgba(255,140,26,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

function archipelagoMakeCloud(rand) {
  var group = new THREE.Group();
  var mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
  var puffs = 3 + Math.floor(rand() * 3);
  var i, puff;
  for (i = 0; i < puffs; i++) {
    puff = new THREE.Mesh(new THREE.SphereGeometry(9 + rand() * 9, 10, 8), mat);
    puff.position.set((rand() - 0.5) * 36, (rand() - 0.5) * 4, (rand() - 0.5) * 16);
    puff.scale.y = 0.45;
    group.add(puff);
  }
  return group;
}

function archipelagoBuildRunway(scene) {
  var group = new THREE.Group();
  var asphalt = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 30),
    new THREE.MeshLambertMaterial({ color: 0x2b2f36 })
  );
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.y = 6.35;
  group.add(asphalt);
  var dashMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  var i, dash;
  for (i = 0; i < 9; i++) {
    dash = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.6), dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(-88 + i * 22, 6.45, 0);
    group.add(dash);
  }
  var edgeMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  var edge;
  [-13.5, 13.5].forEach(function (ez) {
    edge = new THREE.Mesh(new THREE.PlaneGeometry(200, 1.0), edgeMat);
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(0, 6.45, ez);
    group.add(edge);
  });
  /* Threshold bars at both ends. */
  var bar;
  [-96, 96].forEach(function (bx) {
    for (i = -2; i <= 2; i++) {
      bar = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.4), dashMat);
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(bx, 6.45, i * 5.2);
      group.add(bar);
    }
  });
  /* Threshold lights: warm amber dots along both edges. */
  var lightMat = new THREE.MeshBasicMaterial({ color: 0xffb02a });
  var light;
  for (i = 0; i <= 10; i++) {
    [-14.5, 14.5].forEach(function (lz) {
      light = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), lightMat);
      light.position.set(-100 + i * 20, 6.8, lz);
      group.add(light);
    });
  }
  /* Windsock beside the runway. */
  var pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 12, 8),
    new THREE.MeshLambertMaterial({ color: 0xd8d8d8 })
  );
  pole.position.set(96, 12, 24);
  group.add(pole);
  var sock = new THREE.Mesh(
    new THREE.ConeGeometry(1.6, 7, 10),
    new THREE.MeshLambertMaterial({ color: 0xff7a1a })
  );
  sock.rotation.z = Math.PI / 2;
  sock.position.set(99.5, 17.5, 24);
  group.add(sock);
  scene.add(group);
  return group;
}

function archipelagoBuildMountains(scene) {
  var rockMat = new THREE.MeshLambertMaterial({ color: 0x8a7a6a });
  var snowMat = new THREE.MeshLambertMaterial({ color: 0xf2f5f7 });
  var i, island, cone, cap;
  for (i = 0; i < ARCHIPELAGO_ISLANDS.length; i++) {
    island = ARCHIPELAGO_ISLANDS[i];
    if (island.peak < 70) continue;
    cone = new THREE.Mesh(new THREE.ConeGeometry(island.r * 0.30, island.peak * 0.9, 10), rockMat);
    cone.position.set(island.x, island.peak * 0.45, island.z);
    scene.add(cone);
    cap = new THREE.Mesh(new THREE.ConeGeometry(island.r * 0.11, island.peak * 0.32, 10), snowMat);
    cap.position.set(island.x, island.peak * 0.78, island.z);
    scene.add(cap);
  }
}

function buildArchipelago(scene) {
  var rand = archipelagoSeededRand(20261126);

  /* Sky dome: sunset gradient, warm haze at the horizon. */
  var sky = new THREE.Mesh(
    new THREE.SphereGeometry(1900, 32, 16),
    new THREE.MeshBasicMaterial({ map: archipelagoSkyTexture(), side: THREE.BackSide, fog: false })
  );
  scene.add(sky);
  scene.fog = new THREE.Fog(0xf7c98a, 320, 1650);

  /* Low sun disc + glow, west horizon. */
  var sun = new THREE.Mesh(
    new THREE.CircleGeometry(95, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd27a, fog: false })
  );
  sun.position.set(-1250, 150, -620);
  sun.lookAt(0, 0, 0);
  scene.add(sun);
  var glowTex = archipelagoGlowTexture();
  var sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, transparent: true, fog: false, depthWrite: false
  }));
  sunGlow.scale.set(620, 620, 1);
  sunGlow.position.copy(sun.position);
  scene.add(sunGlow);

  /* Island heightfield with vertex colours: sand, grass, rock, snow. */
  var geo = new THREE.PlaneGeometry(1400, 1400, 140, 140);
  geo.rotateX(-Math.PI / 2);
  var pos = geo.attributes.position;
  var colors = new Float32Array(pos.count * 3);
  var sand = [0.91, 0.82, 0.54], grass = [0.25, 0.56, 0.31], grass2 = [0.32, 0.62, 0.28];
  var rock = [0.54, 0.48, 0.42], snow = [0.95, 0.96, 0.97], seabed = [0.72, 0.63, 0.37];
  var i, px, pz, h, c, shade;
  for (i = 0; i < pos.count; i++) {
    px = pos.getX(i);
    pz = pos.getZ(i);
    h = archipelagoHeightAt(px, pz);
    pos.setY(i, h);
    if (h < 0) c = seabed;
    else if (h < 3) c = sand;
    else if (h < 26) c = (Math.floor(px * 0.7 + pz) % 2 === 0) ? grass : grass2;
    else if (h < 48) c = rock;
    else c = snow;
    shade = 0.92 + 0.08 * Math.sin(px * 0.35 + pz * 0.21);
    colors[i * 3] = c[0] * shade;
    colors[i * 3 + 1] = c[1] * shade;
    colors[i * 3 + 2] = c[2] * shade;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  var land = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  scene.add(land);

  /* Teal sea, just below the beaches. */
  var sea = new THREE.Mesh(
    new THREE.PlaneGeometry(2600, 2600),
    new THREE.MeshPhongMaterial({
      color: 0x1b7f8e, transparent: true, opacity: 0.82,
      shininess: 90, specular: 0x99ccff
    })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -0.6;
  scene.add(sea);

  archipelagoBuildMountains(scene);
  archipelagoBuildRunway(scene);

  /* Drifting clouds. */
  var clouds = [];
  var cloud;
  for (i = 0; i < 14; i++) {
    cloud = archipelagoMakeCloud(rand);
    cloud.position.set((rand() - 0.5) * 1600, 95 + rand() * 55, (rand() - 0.5) * 1600);
    cloud.userData.drift = 2 + rand() * 3;
    scene.add(cloud);
    clouds.push(cloud);
  }

  /* Target-ring course: six glowing rings, each above the terrain. */
  var ringSpots = [
    [-40, -260], [180, -140], [300, 60],
    [140, 300], [-140, 300], [-300, 60]
  ];
  var rings = [];
  var ring, ringGlow, rx, rz, ry;
  for (i = 0; i < ringSpots.length; i++) {
    rx = ringSpots[i][0];
    rz = ringSpots[i][1];
    ry = Math.max(48, archipelagoHeightAt(rx, rz) + 38);
    ring = new THREE.Group();
    var torus = new THREE.Mesh(
      new THREE.TorusGeometry(15, 1.4, 12, 40),
      new THREE.MeshBasicMaterial({ color: 0xff8c1a })
    );
    ring.add(torus);
    /* Thin white outer outline, set slightly behind the orange torus so
       the orange face stays proud while a white rim shows all round —
       the ring reads as a mission object, distinct from the sun glow. */
    var outline = new THREE.Mesh(
      new THREE.TorusGeometry(15, 1.75, 8, 40),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    outline.position.z = -0.5;
    ring.add(outline);
    var inner = new THREE.Mesh(
      new THREE.TorusGeometry(11, 0.5, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8 })
    );
    ring.add(inner);
    ringGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, transparent: true, opacity: 0.55, depthWrite: false
    }));
    ringGlow.scale.set(70, 70, 1);
    ring.add(ringGlow);
    ring.position.set(rx, ry, rz);
    if (i > 0) ring.lookAt(rings[i - 1].x, rings[i - 1].y, rings[i - 1].z);
    scene.add(ring);
    rings.push({ group: ring, torus: torus, x: rx, y: ry, z: rz, passed: false });
  }

  return {
    heightAt: archipelagoHeightAt,
    groundAt: function (x, z) { return Math.max(archipelagoHeightAt(x, z), 0.2); },
    rings: rings,
    runway: { x0: -100, x1: 100, zHalf: 13, y: 6 },
    clouds: clouds,
    update: function (dt) {
      var j, cl;
      for (j = 0; j < clouds.length; j++) {
        cl = clouds[j];
        cl.position.x += cl.userData.drift * dt;
        if (cl.position.x > 900) cl.position.x = -900;
      }
    }
  };
}

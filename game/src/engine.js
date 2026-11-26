/* Archipelago Run — engine.js
   Scene, chase camera and flight model. States: title -> flying ->
   landed / crashed. Keyboard (A/D bank, W/S throttle, Space fire),
   mouse-move steering and click-to-fire. Collision with terrain,
   runway-landing check, ring passes, drone strafing, tracers,
   explosion particles, fuel burn. Exposes window.__game for testing:
   { state, altitude, speed, heading, fuel, damage, score }. */

var G = null;
var world = null;
var plane = null;
var renderer = null;
var scene = null;
var camera = null;
var clock = null;
var drones = [];
var tracers = [];
var particles = null;
var particleVel = null;
var particleLife = null;
var particleCursor = 0;
var keys = {};
var steerX = 0;
var steerY = 0;
var flashTime = 0;
var fireCooldown = 0;
var fuelWarned = false;
var timeNow = 0;

var START_POS = { x: -80, y: 8.2, z: 0, heading: 90 };
var MAX_SPEED = 200;
var RING_TOTAL = 6;

function engineForward(headingDeg) {
  var h = headingDeg * Math.PI / 180;
  return { x: Math.sin(h), z: -Math.cos(h) };
}

function engineResetGame() {
  G.state = 'flying';
  G.x = START_POS.x;
  G.y = START_POS.y;
  G.z = START_POS.z;
  G.heading = START_POS.heading;
  G.pitch = 0;
  G.bank = 0;
  G.speed = 0;
  G.throttle = 0.9;
  G.wasAirborne = false;
  G.clearedGround = false;
  G.climbDone = false;
  G.fuel = 100;
  G.damage = 0;
  G.score = 0;
  G.rings = 0;
  G.shots = 0;
  G.vspeed = 0;
  G.time = 0;
  fuelWarned = false;
  var i;
  for (i = 0; i < world.rings.length; i++) {
    world.rings[i].passed = false;
    world.rings[i].torus.material.color.setHex(0xff8c1a);
  }
  for (i = 0; i < drones.length; i++) resetDrone(drones[i], i);
  for (i = 0; i < tracers.length; i++) tracers[i].life = 0;
  Missions.reset(G);
  G.fuelWarn30 = false;
  G.fuelWarn15 = false;
  G.grazeWarned = 0;
  G.droneNickAt = 0;
  if (G.mission === 3) {
    /* M3 flies a single gate ring; the rest stay dim scenery. */
    for (i = 1; i < world.rings.length; i++) {
      world.rings[i].torus.material.color.setHex(0x5a6a72);
    }
  }
  HUD.setObjective(Missions.objectiveText(G));
}

function startMission() {
  engineResetGame();
  HUD.hideEnd();
  HUD.hideTitle();
  if (typeof FlightAudio !== 'undefined') FlightAudio.ensure();
  HUD.showMessage(Missions.objectiveText(G), 3000);
}

/* Title-screen mission picker: highlights the chosen sortie, shows its
   brief, and relabels the launch button. Keys 1 / 2 / 3 do the same. */
function selectMissionButton(id) {
  Missions.select(id);
  var btns = document.querySelectorAll('.missionBtn');
  var i;
  for (i = 0; i < btns.length; i++) {
    btns[i].classList.toggle('selected',
      parseInt(btns[i].getAttribute('data-mission'), 10) === Missions.selected());
  }
  var desc = document.getElementById('missionDesc');
  if (desc) desc.textContent = Missions.def(Missions.selected()).brief;
  var launchBtn = document.getElementById('startBtn');
  if (launchBtn) launchBtn.textContent = 'LAUNCH ' + Missions.def(Missions.selected()).code;
}

function endGame(kind, title, statsHtml) {
  G.state = kind;
  if (typeof FlightAudio !== 'undefined') FlightAudio.setEngine(0, 0);
  HUD.showEnd(title, statsHtml);
}

function engineEndStats() {
  var def = Missions.def(G.mission);
  return 'MISSION <b>' + def.code + ' — ' + def.name + '</b>' +
    '<br>SCORE <b>' + G.score + '</b> &nbsp;·&nbsp; RINGS <b>' + G.rings + '/6</b>' +
    ' &nbsp;·&nbsp; DRONES <b>' + G.dronesDown + '/5</b>' +
    '<br>TIME <b>' + Math.round(G.time) + 's</b> &nbsp;·&nbsp; SHOTS <b>' + G.shots + '</b>' +
    '<br>FUEL <b>' + Math.round(G.fuel) + '%</b> &nbsp;·&nbsp; DAMAGE <b>' + Math.round(G.damage) + '%</b>';
}

function crashPlane(reason) {
  G.damage = 100;
  if (typeof FlightAudio !== 'undefined') FlightAudio.crash();
  spawnBurst(G.x, G.y, G.z, 0xff7a1a, 70);
  spawnBurst(G.x, G.y, G.z, 0x888888, 40);
  endGame('crashed', reason, engineEndStats() +
    '<br><span style="color:#ffb0a0">The islands claim another pilot. Fly again.</span>');
}

function landPlane() {
  var complete = Missions.objectivesDone(G);
  var bonus = 0;
  if (G.mission === 3) {
    G.landingRating = Missions.landingRating(G.vspeed);
    if (complete) bonus = Missions.landingBonus(G.landingRating);
  }
  G.score += (complete ? 500 : 100) + bonus;
  G.speed = 0;
  G.landingComplete = complete;
  if (typeof FlightAudio !== 'undefined') FlightAudio.landing();
  endGame('landed', Missions.endTitle(G), engineEndStats() +
    '<br><span style="color:#b8f5cd">' + Missions.endNote(G) + '</span>' +
    (bonus > 0 ? '<br>LANDING BONUS <b>+' + bonus + '</b>' : ''));
}

function spawnDroneMesh() {
  var group = new THREE.Group();
  var bodyMat = new THREE.MeshPhongMaterial({ color: 0x8a1a1a, shininess: 50 });
  var darkMat = new THREE.MeshPhongMaterial({ color: 0x2a2f36 });
  var body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.7, 4.2), bodyMat);
  group.add(body);
  var wing = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.18, 1.2), darkMat);
  group.add(wing);
  var eye = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xff2a2a })
  );
  eye.position.set(0, 0, -2.2);
  group.add(eye);
  group.rotation.order = 'YXZ';
  return group;
}

function resetDrone(drone, index) {
  var spots = [
    [120, -220, 70], [260, 40, 90], [60, 300, 80],
    [-220, 260, 100], [-280, -60, 60]
  ];
  var s = spots[index % spots.length];
  drone.x = s[0];
  drone.z = s[1];
  drone.y = s[2];
  drone.alive = true;
  drone.respawn = 0;
  drone.phase = index * 1.3;
  drone.mesh.visible = true;
  drone.mesh.position.set(drone.x, drone.y, drone.z);
}

function spawnDrones() {
  var i, mesh, drone;
  for (i = 0; i < 5; i++) {
    mesh = spawnDroneMesh();
    scene.add(mesh);
    drone = { mesh: mesh, x: 0, y: 80, z: 0, alive: true, respawn: 0, phase: 0 };
    resetDrone(drone, i);
    drones.push(drone);
  }
}

function updateDrones(dt) {
  var i, d;
  for (i = 0; i < drones.length; i++) {
    d = drones[i];
    if (!d.alive) {
      /* M2 kills are permanent: respawn -1 means the drone stays down. */
      if (d.respawn < 0) continue;
      d.respawn -= dt;
      if (d.respawn <= 0) resetDrone(d, i);
      continue;
    }
    d.phase += dt;
    d.mesh.position.set(
      d.x + Math.sin(d.phase * 0.7) * 14,
      d.y + Math.sin(d.phase * 1.1) * 4,
      d.z + Math.cos(d.phase * 0.5) * 14
    );
    d.mesh.rotation.y = d.phase * 0.4;
  }
}

function initParticles() {
  var count = 160;
  var geo = new THREE.BufferGeometry();
  var positions = new Float32Array(count * 3);
  var colors = new Float32Array(count * 3);
  var i;
  for (i = 0; i < count; i++) {
    positions[i * 3 + 1] = -9999;
    colors[i * 3] = 1;
    colors[i * 3 + 1] = 0.6;
    colors[i * 3 + 2] = 0.2;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  particles = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 2.4, vertexColors: true, transparent: true, opacity: 0.95
  }));
  particles.frustumCulled = false;
  scene.add(particles);
  particleVel = new Float32Array(count * 3);
  particleLife = new Float32Array(count);
}

function spawnBurst(x, y, z, colorHex, n) {
  if (!particles) return;
  var count = particleLife.length;
  var pos = particles.geometry.attributes.position.array;
  var col = particles.geometry.attributes.color.array;
  var r = ((colorHex >> 16) & 255) / 255;
  var g = ((colorHex >> 8) & 255) / 255;
  var b = (colorHex & 255) / 255;
  var i, idx;
  for (i = 0; i < n; i++) {
    idx = particleCursor;
    particleCursor = (particleCursor + 1) % count;
    pos[idx * 3] = x;
    pos[idx * 3 + 1] = y;
    pos[idx * 3 + 2] = z;
    particleVel[idx * 3] = (Math.random() - 0.5) * 36;
    particleVel[idx * 3 + 1] = (Math.random() - 0.2) * 30;
    particleVel[idx * 3 + 2] = (Math.random() - 0.5) * 36;
    col[idx * 3] = r;
    col[idx * 3 + 1] = g;
    col[idx * 3 + 2] = b;
    particleLife[idx] = 0.9 + Math.random() * 0.5;
  }
  particles.geometry.attributes.position.needsUpdate = true;
  particles.geometry.attributes.color.needsUpdate = true;
}

function updateParticles(dt) {
  if (!particles) return;
  var pos = particles.geometry.attributes.position.array;
  var i;
  for (i = 0; i < particleLife.length; i++) {
    if (particleLife[i] <= 0) continue;
    particleLife[i] -= dt;
    pos[i * 3] += particleVel[i * 3] * dt;
    pos[i * 3 + 1] += particleVel[i * 3 + 1] * dt;
    pos[i * 3 + 2] += particleVel[i * 3 + 2] * dt;
    particleVel[i * 3 + 1] -= 14 * dt;
    if (particleLife[i] <= 0) pos[i * 3 + 1] = -9999;
  }
  particles.geometry.attributes.position.needsUpdate = true;
}

function initTracers() {
  var i, mesh;
  for (i = 0; i < 8; i++) {
    mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.14, 26),
      new THREE.MeshBasicMaterial({ color: 0xffe27a })
    );
    mesh.visible = false;
    scene.add(mesh);
    tracers.push({ mesh: mesh, life: 0 });
  }
}

function fireCannons() {
  if (!G || G.state !== 'flying' || fireCooldown > 0) return;
  fireCooldown = 0.18;
  G.shots++;
  if (typeof FlightAudio !== 'undefined') FlightAudio.cannon();
  showMuzzleFlash(plane, true);
  flashTime = 0.08;
  var fwd = engineForward(G.heading);
  var nx = G.x + fwd.x * 4;
  var nz = G.z + fwd.z * 4;
  var ny = G.y - Math.sin(G.pitch) * 2;
  var tracer = null;
  var i;
  for (i = 0; i < tracers.length; i++) {
    if (tracers[i].life <= 0) { tracer = tracers[i]; break; }
  }
  if (tracer) {
    var ex = nx + fwd.x * 130;
    var ez = nz + fwd.z * 130;
    var ey = ny + Math.sin(G.pitch) * 130;
    tracer.mesh.position.set((nx + ex) / 2, (ny + ey) / 2, (nz + ez) / 2);
    tracer.mesh.lookAt(ex, ey, ez);
    tracer.mesh.visible = true;
    tracer.life = 0.6;
  }
  checkDroneHits(nx, ny, nz, fwd);
}

function checkDroneHits(nx, ny, nz, fwd) {
  var ex = nx + fwd.x * 150;
  var ey = ny + Math.sin(G.pitch) * 150;
  var ez = nz + fwd.z * 150;
  var dx = ex - nx, dy = ey - ny, dz = ez - nz;
  var len2 = dx * dx + dy * dy + dz * dz;
  var i, d, t, cx, cy, cz, dist2;
  for (i = 0; i < drones.length; i++) {
    d = drones[i];
    if (!d.alive) continue;
    var px = d.mesh.position.x, py = d.mesh.position.y, pz = d.mesh.position.z;
    t = ((px - nx) * dx + (py - ny) * dy + (pz - nz) * dz) / len2;
    if (t < 0 || t > 1) continue;
    cx = nx + dx * t - px;
    cy = ny + dy * t - py;
    cz = nz + dz * t - pz;
    dist2 = cx * cx + cy * cy + cz * cz;
    if (dist2 < 49) {
      d.alive = false;
      d.respawn = (G.mission === 2) ? -1 : 6;
      d.mesh.visible = false;
      G.score += 100;
      Missions.onDroneDown(G);
      spawnBurst(px, py, pz, 0xff5a3c, 50);
      if (typeof FlightAudio !== 'undefined') FlightAudio.explosion();
      HUD.showMessage('DRONE DOWN  +100  ·  ' + G.dronesDown + '/5', 1600);
      if (G.mission === 2 && G.dronesDown >= 5) {
        HUD.setObjective('ALL DRONES DOWN — LAND ON RUNWAY 07');
        HUD.showMessage('ALL DRONES DOWN — BRING HER HOME TO RUNWAY 07', 3000);
      } else {
        HUD.setObjective(Missions.objectiveText(G));
      }
    }
  }
}

function checkRingPass() {
  var i, r, dx, dy, dz, dist;
  for (i = 0; i < world.rings.length; i++) {
    r = world.rings[i];
    if (r.passed) continue;
    dx = G.x - r.x;
    dy = G.y - r.y;
    dz = G.z - r.z;
    dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < 16) {
      if (!Missions.onRing(G, i)) continue;
      r.passed = true;
      r.torus.material.color.setHex(0x37d67a);
      G.rings++;
      G.score += 150;
      spawnBurst(r.x, r.y, r.z, 0xffc46a, 40);
      if (typeof FlightAudio !== 'undefined') FlightAudio.chime();
      if (G.mission === 3) {
        HUD.showMessage('GATE FLOWN  +150 — LAND GENTLY NOW', 1800);
        HUD.setObjective(Missions.objectiveText(G));
      } else {
        HUD.showMessage('RING ' + G.rings + '/' + RING_TOTAL + '  +150', 1800);
        if (G.rings >= RING_TOTAL) {
          HUD.setObjective('ALL RINGS FLOWN — LAND ON RUNWAY 07');
          HUD.showMessage('ALL RINGS FLOWN — BRING HER HOME TO RUNWAY 07', 3000);
        } else {
          HUD.setObjective(Missions.objectiveText(G));
        }
      }
    }
  }
}

function updateFlight(dt) {
  /* Throttle: W / Up raises, S / Down lowers. */
  if (keys['KeyW'] || keys['ArrowUp']) G.throttle = Math.min(1, G.throttle + 0.5 * dt);
  if (keys['KeyS'] || keys['ArrowDown']) G.throttle = Math.max(0.12, G.throttle - 0.5 * dt);
  if (G.fuel <= 0) G.throttle = Math.max(0.12, G.throttle - 0.4 * dt);

  var targetSpeed = 40 + G.throttle * (MAX_SPEED - 40);
  G.speed += (targetSpeed - G.speed) * Math.min(1, dt * 2.2);

  /* Bank + turn: A/D plus mouse steer. */
  var turnInput = ((keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0)) + steerX * 1.2;
  if (turnInput > 1) turnInput = 1;
  if (turnInput < -1) turnInput = -1;
  var bankTarget = turnInput * 0.85;
  G.bank += (bankTarget - G.bank) * Math.min(1, dt * 4);
  G.heading += G.bank * dt * 0.85 * (0.35 + G.speed / 180) * 57.29578; // bank is radians, heading is degrees
  G.heading = ((G.heading % 360) + 360) % 360;

  /* Pitch from the mouse; the nose auto-levels when the mouse is centred.
     Takeoff assist: once past liftoff speed the nose rises on its own
     until the plane is 500 ft up, then pitch returns to the mouse. */
  var pitchTarget = Math.max(-0.4, Math.min(0.5, -steerY * 0.5));
  /* Takeoff assist: once past liftoff speed the nose rises on its own
     until the plane is 500 ft up (y >= 50), then pitch returns to the
     mouse. Latched by climbDone so a later low landing approach never
     re-triggers the climb. */
  if (G.y >= 50) G.climbDone = true;
  if (!G.climbDone && G.speed > 65) pitchTarget = 0.5;
  G.pitch += (pitchTarget - G.pitch) * Math.min(1, dt * 3);
  G.vspeed = Math.sin(G.pitch) * G.speed;
  G.y += G.vspeed * dt;
  if (G.speed < 55) G.y -= (55 - G.speed) * 0.22 * dt;
  if (G.y > 320) { G.y = 320; G.pitch = Math.min(G.pitch, 0); }

  var fwd = engineForward(G.heading);
  G.x += fwd.x * G.speed * dt;
  G.z += fwd.z * G.speed * dt;
  G.time += dt;

  /* Fuel burn: faster at full throttle. Low fuel is a decision: at 30%
     the gauge turns red and the pilot must commit to a landing plan,
     at 15% it is land-now, and empty means gliding on the wind. */
  G.fuel -= dt * (0.25 + G.throttle * 0.5);
  if (G.fuel < 0) G.fuel = 0;
  if (G.fuel <= 30 && !G.fuelWarn30) {
    G.fuelWarn30 = true;
    HUD.showMessage('LOW FUEL 30% — PLAN YOUR LANDING', 2600);
  }
  if (G.fuel <= 15 && !G.fuelWarn15) {
    G.fuelWarn15 = true;
    HUD.showMessage('FUEL CRITICAL 15% — LAND NOW', 3000);
  }
  if (G.fuel <= 0 && !fuelWarned) {
    fuelWarned = true;
    HUD.showMessage('FUEL EMPTY — GLIDE TO THE RUNWAY', 3200);
  }
  if (typeof FlightAudio !== 'undefined') FlightAudio.setEngine(G.throttle, G.speed / MAX_SPEED);

  /* Soft wall: steer back toward the archipelago past 950 units out. */
  var distCentre = Math.sqrt(G.x * G.x + G.z * G.z);
  if (distCentre > 950) {
    var homeHeading = Math.atan2(-G.x, G.z) * 180 / Math.PI;
    var diff = ((homeHeading - G.heading + 540) % 360) - 180;
    G.heading += Math.max(-1, Math.min(1, diff)) * dt * 0.6;
    if (Math.abs(diff) > 20) HUD.showMessage('TURN BACK — LEAVING THE ARCHIPELAGO', 1600);
  }

  /* Terrain collision, runway landing, or ditching in the sea. */
  var groundY = world.groundAt(G.x, G.z);
  /* Graze damage: skimming the hillsides scrapes the airframe, and a
     live drone that gets close rakes the plane — damage is a risk to
     manage, not only a crash verdict. The runway strip itself is exempt,
     so a normal landing approach never grazes. */
  var onStrip = G.x > -130 && G.x < 130 && Math.abs(G.z) < 40;
  if (G.clearedGround && !onStrip && groundY > 1 && G.y > groundY + 1.2 && G.y < groundY + 4.5) {
    G.damage += dt * 4;
    if (!G.grazeWarned || timeNow - G.grazeWarned > 3) {
      G.grazeWarned = timeNow;
      HUD.showMessage('TERRAIN GRAZE — PULL UP', 1600);
    }
  }
  var di, dd, ddx, ddy, ddz, ddist;
  for (di = 0; di < drones.length; di++) {
    dd = drones[di];
    if (!dd.alive) continue;
    ddx = dd.mesh.position.x - G.x;
    ddy = dd.mesh.position.y - G.y;
    ddz = dd.mesh.position.z - G.z;
    ddist = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz);
    if (ddist < 12) {
      if (!G.droneNickAt || timeNow - G.droneNickAt > 2) {
        G.droneNickAt = timeNow;
        G.damage += 5;
        HUD.showMessage('DRONE FIRE — EVADE', 1600);
      }
      break;
    }
  }
  if (G.damage >= 100) {
    crashPlane('AIRFRAME FAILURE — DAMAGE 100%');
    return;
  }
  /* Airborne once 150 ft up or past 60 kt; clear of the ground once
     10 units above the terrain below. The runway landing below fires
     only when both are true, so a takeoff roll can never end the mission. */
  if (G.y * 10 > 150 || G.speed * 2 > 60) G.wasAirborne = true;
  if (G.y > groundY + 10) G.clearedGround = true;
  if (G.y <= groundY + 1.2) {
    var rw = world.runway;
    var onRunway = G.x > rw.x0 && G.x < rw.x1 && Math.abs(G.z) < rw.zHalf;
    if (onRunway && !G.clearedGround) {
      /* Takeoff roll: still on the runway, never flown yet — hold the
         plane on the strip, do not land and do not crash. */
      G.y = rw.y + 1.2;
    } else if (onRunway && G.wasAirborne && G.clearedGround && Math.abs(G.vspeed) < 9 && G.speed < 130) {
      G.y = rw.y + 1.2;
      landPlane();
    } else if (groundY <= 0.21) {
      crashPlane('DITCHED IN THE SEA');
    } else {
      crashPlane('CRASHED INTO THE MOUNTAINSIDE');
    }
  }

  checkRingPass();
  updateDrones(dt);

  /* Aircraft pose: yaw, pitch, bank. */
  plane.position.set(G.x, G.y, G.z);
  plane.rotation.y = G.heading * Math.PI / 180;
  plane.rotation.x = G.pitch;
  plane.rotation.z = -G.bank;
  animateAircraft(plane, dt, G.throttle, timeNow);

  /* Chase camera: behind and above, easing onto the tail, rolling a touch. */
  var camTarget = {
    x: G.x - fwd.x * 15,
    y: G.y + 5,
    z: G.z - fwd.z * 15
  };
  var k = 1 - Math.pow(0.002, dt);
  camera.position.x += (camTarget.x - camera.position.x) * k;
  camera.position.y += (camTarget.y - camera.position.y) * k;
  camera.position.z += (camTarget.z - camera.position.z) * k;
  camera.lookAt(G.x + fwd.x * 24, G.y + 9, G.z + fwd.z * 24);
  camera.rotateZ(G.bank * 0.3);

  /* Speed feel: the lens widens as the throttle opens, narrowing again
     when the pilot backs off for the landing. */
  var targetFov = 68 + G.throttle * 10;
  if (Math.abs(camera.fov - targetFov) > 0.1) {
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 3);
    camera.updateProjectionMatrix();
  }

  if (fireCooldown > 0) fireCooldown -= dt;
  if (flashTime > 0) {
    flashTime -= dt;
    if (flashTime <= 0) showMuzzleFlash(plane, false);
  }
  var i;
  for (i = 0; i < tracers.length; i++) {
    if (tracers[i].life > 0) {
      tracers[i].life -= dt;
      if (tracers[i].life <= 0) tracers[i].life = 0;
      tracers[i].mesh.visible = tracers[i].life > 0;
    }
  }
}

function updateTitleCamera(dt) {
  var a = timeNow * 0.08;
  camera.position.set(Math.sin(a) * 260, 120, Math.cos(a) * 260);
  camera.lookAt(0, 18, 0);
  plane.position.set(START_POS.x, START_POS.y, START_POS.z);
  plane.rotation.y = START_POS.heading * Math.PI / 180;
  plane.rotation.x = 0;
  plane.rotation.z = 0;
  animateAircraft(plane, dt, 0.3, timeNow);
}

function updateEndCamera(dt) {
  var a = timeNow * 0.12;
  var r = 26;
  camera.position.set(
    G.x + Math.sin(a) * r,
    G.y + 9,
    G.z + Math.cos(a) * r
  );
  camera.lookAt(G.x, G.y, G.z);
}

function syncGameObject() {
  G.altitude = Math.round(G.y * 10);
  G.speedKt = Math.round(G.speed * 2);
  G.headingDeg = Math.round((((G.heading % 360) + 360) % 360));
}

function bootArchipelago() {
  if (typeof THREE === 'undefined') {
    document.getElementById('bootError').style.display = 'flex';
    return;
  }
  HUD.initHUD();
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
  else if ('outputEncoding' in renderer) renderer.outputEncoding = THREE.sRGBEncoding;
  document.getElementById('gameContainer').appendChild(renderer.domElement);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 4200);

  var hemi = new THREE.HemisphereLight(0xbfd9ff, 0x3a5f46, 0.9);
  scene.add(hemi);
  var sunLight = new THREE.DirectionalLight(0xffd9a0, 1.1);
  sunLight.position.set(-400, 300, -200);
  scene.add(sunLight);

  world = buildArchipelago(scene);
  plane = buildAircraft();
  scene.add(plane);
  spawnDrones();
  initParticles();
  initTracers();

  G = {
    state: 'title', x: START_POS.x, y: START_POS.y, z: START_POS.z,
    heading: START_POS.heading, pitch: 0, bank: 0, speed: 0, throttle: 0.9,
    fuel: 100, damage: 0, score: 0, rings: 0, shots: 0, vspeed: 0, time: 0,
    wasAirborne: false, clearedGround: false,
    altitude: 0, speedKt: 0, headingDeg: 90
  };
  window.__game = G;
  window.__gameReady = false;

  plane.position.set(G.x, G.y, G.z);
  plane.rotation.y = G.heading * Math.PI / 180;

  document.getElementById('startBtn').addEventListener('click', startMission);
  document.getElementById('restartBtn').addEventListener('click', startMission);

  var missionBtns = document.querySelectorAll('.missionBtn');
  var bi;
  for (bi = 0; bi < missionBtns.length; bi++) {
    missionBtns[bi].addEventListener('click', function () {
      selectMissionButton(parseInt(this.getAttribute('data-mission'), 10));
    });
  }
  selectMissionButton(1);

  window.addEventListener('keydown', function (e) {
    keys[e.code] = true;
    if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') {
      if (G.state === 'title') selectMissionButton(parseInt(e.code.slice(-1), 10));
    }
    if (e.code === 'Space') {
      e.preventDefault();
      if (G.state === 'flying') fireCannons();
    }
    if (e.code === 'Enter') {
      if (G.state === 'title' || G.state === 'landed' || G.state === 'crashed') startMission();
    }
    if (e.code === 'KeyR') {
      if (G.state === 'landed' || G.state === 'crashed') startMission();
    }
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') e.preventDefault();
  });
  window.addEventListener('keyup', function (e) { keys[e.code] = false; });

  window.addEventListener('mousemove', function (e) {
    steerX = (e.clientX / window.innerWidth) * 2 - 1;
    steerY = (e.clientY / window.innerHeight) * 2 - 1;
  });
  window.addEventListener('mousedown', function (e) {
    if (e.target && e.target.closest && e.target.closest('button')) return;
    if (G.state === 'flying') fireCannons();
  });

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  clock = new THREE.Clock();
  HUD.showTitle();

  (function animate() {
    requestAnimationFrame(animate);
    var dt = Math.min(clock.getDelta(), 0.05);
    timeNow += dt;
    if (G.state === 'flying') {
      updateFlight(dt);
    } else if (G.state === 'title') {
      updateTitleCamera(dt);
    } else {
      updateEndCamera(dt);
      updateDrones(dt);
    }
    world.update(dt);
    updateParticles(dt);
    syncGameObject();
    HUD.updateHUD(G);
    HUD.drawCompass(G.heading);
    HUD.drawMinimap(world, G);
    renderer.render(scene, camera);
    window.__gameReady = true;
  })();
}

bootArchipelago();

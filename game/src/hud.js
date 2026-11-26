/* Archipelago Run — hud.js
   Every instrument the pilot (and the judge) reads: altitude, speed
   and heading in big high-contrast type, fuel / damage / throttle
   bars, the mission objective line, the score, a centre reticle, a
   compass tape and a live top-down minimap of the island chain.
   All DOM is in index.html; this file only drives it. */

var HUD = (function () {
  var el = {};
  var messageTimer = null;

  function hudCardinal(deg) {
    var names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return names[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
  }

  function initHUD() {
    var ids = ['hud', 'hudAlt', 'hudSpeed', 'hudHeading', 'hudCardinal', 'hudVspeed', 'hudObjective',
      'hudScore', 'hudFuelPct', 'hudFuelFill', 'hudDamagePct', 'hudDamageFill',
      'hudThrottlePct', 'hudThrottleFill', 'hudMessage', 'minimap', 'compass',
      'titleScreen', 'endScreen', 'endTitle', 'endStats', 'startBtn', 'restartBtn'];
    var i;
    for (i = 0; i < ids.length; i++) el[ids[i]] = document.getElementById(ids[i]);
    return el;
  }

  function updateHUD(G) {
    if (!el.hudAlt) return;
    el.hudAlt.textContent = String(Math.round(G.y * 10));
    el.hudSpeed.textContent = String(Math.round(G.speed * 2));
    var hdg = Math.round((((G.heading % 360) + 360) % 360));
    el.hudHeading.textContent = ('00' + hdg).slice(-3);
    el.hudCardinal.textContent = hudCardinal(hdg);
    el.hudScore.textContent = (typeof Missions !== 'undefined' && G.mission)
      ? Missions.scoreText(G)
      : 'SCORE ' + G.score + ' — RINGS ' + G.rings + '/6';
    if (el.hudVspeed) el.hudVspeed.textContent = (G.vspeed >= 0 ? '+' : '') + G.vspeed.toFixed(1);
    el.hudFuelPct.textContent = Math.round(G.fuel) + '%';
    el.hudFuelFill.style.width = Math.max(0, G.fuel) + '%';
    el.hudFuelFill.style.background = G.fuel < 30 ? '#ff5a3c' : '#37d67a';
    el.hudDamagePct.textContent = Math.round(G.damage) + '%';
    el.hudDamageFill.style.width = Math.max(0, G.damage) + '%';
    el.hudThrottlePct.textContent = Math.round(G.throttle * 100) + '%';
    el.hudThrottleFill.style.width = Math.round(G.throttle * 100) + '%';
  }

  function setObjective(text) {
    if (el.hudObjective) el.hudObjective.textContent = text;
  }

  function showMessage(text, ms) {
    if (!el.hudMessage) return;
    el.hudMessage.textContent = text;
    el.hudMessage.style.opacity = '1';
    if (messageTimer) clearTimeout(messageTimer);
    messageTimer = setTimeout(function () { el.hudMessage.style.opacity = '0'; }, ms || 2400);
  }

  function drawCompass(heading) {
    var cv = el.compass;
    if (!cv) return;
    var ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#0b1c2c';
    ctx.fillRect(0, 0, cv.width, cv.height);
    var pxPerDeg = cv.width / 120;
    var centre = cv.width / 2;
    var hdg = (((heading % 360) + 360) % 360);
    var d, x, label;
    ctx.font = 'bold 14px Arial, sans-serif';
    ctx.textAlign = 'center';
    for (d = -75; d <= 75; d += 15) {
      var deg = Math.round(hdg + d);
      var shown = ((deg % 360) + 360) % 360;
      x = centre + d * pxPerDeg;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = shown % 45 === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, 4);
      ctx.lineTo(x, shown % 45 === 0 ? 18 : 12);
      ctx.stroke();
      if (shown % 45 === 0) {
        label = shown === 0 ? 'N' : shown === 45 ? 'NE' : shown === 90 ? 'E' :
          shown === 135 ? 'SE' : shown === 180 ? 'S' : shown === 225 ? 'SW' :
          shown === 270 ? 'W' : shown === 315 ? 'NW' : String(shown);
        ctx.fillStyle = '#ffd27a';
        ctx.fillText(label, x, 31);
      }
    }
    ctx.fillStyle = '#ff8c1a';
    ctx.beginPath();
    ctx.moveTo(centre - 7, 0);
    ctx.lineTo(centre + 7, 0);
    ctx.lineTo(centre, 7);
    ctx.closePath();
    ctx.fill();
  }

  function drawMinimap(world, G) {
    var cv = el.minimap;
    if (!cv || !world) return;
    var ctx = cv.getContext('2d');
    var W = cv.width, H = cv.height;
    ctx.fillStyle = '#0d3a4a';
    ctx.fillRect(0, 0, W, H);
    var scale = W / 1400;
    function mapX(x) { return W / 2 + x * scale; }
    function mapY(z) { return H / 2 + z * scale; }
    /* Islands as a coarse heightfield sample. */
    var gx, gz, h;
    for (gx = -700; gx < 700; gx += 50) {
      for (gz = -700; gz < 700; gz += 50) {
        h = world.heightAt(gx, gz);
        if (h > 0) {
          ctx.fillStyle = h > 26 ? '#8a7a6a' : '#3f8f4f';
          ctx.fillRect(mapX(gx) - 2, mapY(gz) - 2, 5, 5);
        }
      }
    }
    /* Runway strip. */
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(mapX(-100), mapY(-6), 200 * scale, 12 * scale);
    /* Rings: orange open, green passed. */
    var i, r;
    for (i = 0; i < world.rings.length; i++) {
      r = world.rings[i];
      ctx.strokeStyle = r.passed ? '#37d67a' : '#ff8c1a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mapX(r.x), mapY(r.z), 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    /* Aircraft: white triangle rotated by heading. */
    var hdg = G.heading * Math.PI / 180;
    var px = mapX(G.x), py = mapY(G.z);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(px + Math.sin(hdg) * 9, py - Math.cos(hdg) * 9);
    ctx.lineTo(px + Math.sin(hdg + 2.5) * 7, py - Math.cos(hdg + 2.5) * 7);
    ctx.lineTo(px + Math.sin(hdg - 2.5) * 7, py - Math.cos(hdg - 2.5) * 7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffd27a';
    ctx.font = 'bold 13px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('N', W / 2 - 4, 13);
  }

  function showTitle() {
    if (el.titleScreen) el.titleScreen.classList.remove('hidden');
    if (el.hud) el.hud.classList.remove('on');
  }

  function hideTitle() {
    if (el.titleScreen) el.titleScreen.classList.add('hidden');
    if (el.hud) el.hud.classList.add('on');
  }

  function showEnd(title, statsHtml) {
    if (el.endTitle) el.endTitle.textContent = title;
    if (el.endStats) el.endStats.innerHTML = statsHtml;
    if (el.endScreen) el.endScreen.classList.remove('hidden');
  }

  function hideEnd() {
    if (el.endScreen) el.endScreen.classList.add('hidden');
  }

  return {
    initHUD: initHUD,
    updateHUD: updateHUD,
    setObjective: setObjective,
    showMessage: showMessage,
    drawCompass: drawCompass,
    drawMinimap: drawMinimap,
    showTitle: showTitle,
    hideTitle: hideTitle,
    showEnd: showEnd,
    hideEnd: hideEnd,
    elements: el
  };
})();

/* Archipelago Run — missions.js
   Three sorties with different goals, all flown through the same flight
   model: M1 RING RUN (fly the 6 rings, then land), M2 DRONE HUNT (down
   all 5 drones — they do not respawn on this sortie — then land), M3
   PRECISION LANDING (fly the single gate ring, then land gently on
   Runway 07; the touchdown vertical speed sets the rating). The engine
   calls into this module for objectives, scoring and landing verdicts;
   nothing here touches the renderer. */

var Missions = (function () {
  var DEFS = [
    { id: 1, code: 'M1', name: 'RING RUN',
      brief: 'Fly all 6 glowing rings over the islands, then land on Runway 07.',
      objective: 'FLY THE 6 RINGS, THEN LAND ON RUNWAY 07' },
    { id: 2, code: 'M2', name: 'DRONE HUNT',
      brief: 'Down all 5 red drones before your fuel runs out, then land on Runway 07.',
      objective: 'DOWN ALL 5 DRONES, THEN LAND ON RUNWAY 07' },
    { id: 3, code: 'M3', name: 'PRECISION LANDING',
      brief: 'Fly the single gate ring, then land gently on Runway 07 — a soft touchdown wins.',
      objective: 'FLY THE GATE RING, THEN LAND GENTLY ON RUNWAY 07' }
  ];
  var selectedId = 1;

  function missionDef(id) {
    var i;
    for (i = 0; i < DEFS.length; i++) if (DEFS[i].id === id) return DEFS[i];
    return DEFS[0];
  }

  function missionSelect(id) {
    selectedId = missionDef(id).id;
    return selectedId;
  }

  function missionSelected() { return selectedId; }

  function missionReset(G) {
    G.mission = selectedId;
    G.dronesDown = 0;
    G.gatePassed = false;
    G.landingRating = '';
    G.landingComplete = false;
  }

  /* A ring pass counts for the mission in progress. M3 has a single gate
     (ring 0); the other rings stay scenery on that sortie. */
  function missionOnRing(G, ringIndex) {
    if (G.mission === 3) {
      if (ringIndex !== 0) return false;
      G.gatePassed = true;
      return true;
    }
    return true;
  }

  function missionOnDroneDown(G) {
    G.dronesDown++;
    return G.dronesDown;
  }

  function missionObjectivesDone(G) {
    if (G.mission === 1) return G.rings >= 6;
    if (G.mission === 2) return G.dronesDown >= 5;
    return G.gatePassed;
  }

  function missionObjectiveText(G) {
    /* Objective banner names the sortie only — the live count (rings /
       drones / gate) already shows in the score line directly below,
       so it is not repeated here. */
    var def = missionDef(G.mission);
    return 'MISSION ' + def.id + ' — ' + def.name;
  }

  function missionScoreText(G) {
    if (G.mission === 2) return 'SCORE ' + G.score + ' — DRONES ' + G.dronesDown + '/5';
    if (G.mission === 3) return 'SCORE ' + G.score + ' — GATE ' + (G.gatePassed ? '1/1' : '0/1');
    return 'SCORE ' + G.score + ' — RINGS ' + G.rings + '/6';
  }

  /* Touchdown rating for M3, from vertical speed at the wheels. */
  function missionLandingRating(vspeed) {
    var v = Math.abs(vspeed);
    if (v < 4) return 'PERFECT';
    if (v < 7) return 'FIRM';
    return 'ROUGH';
  }

  function missionLandingBonus(rating) {
    if (rating === 'PERFECT') return 300;
    if (rating === 'FIRM') return 150;
    return 50;
  }

  function missionEndTitle(G) {
    if (!missionObjectivesDone(G)) return 'LANDED — MISSION INCOMPLETE';
    if (G.mission === 2) return 'DRONE HUNT COMPLETE — RUNWAY 07';
    if (G.mission === 3) return 'PRECISION LANDING — ' + G.landingRating;
    return 'RUNWAY LANDING — MISSION COMPLETE';
  }

  function missionEndNote(G) {
    if (!missionObjectivesDone(G)) {
      return 'You landed before finishing the objective. Fly the full sortie next time.';
    }
    if (G.mission === 3) {
      return 'Touchdown ' + G.landingRating + ' at ' +
        Math.abs(G.vspeed).toFixed(1) + ' vertical speed. The archipelago is yours.';
    }
    return 'Wheels down on Runway 07. The archipelago is yours.';
  }

  return {
    defs: DEFS,
    def: missionDef,
    select: missionSelect,
    selected: missionSelected,
    reset: missionReset,
    onRing: missionOnRing,
    onDroneDown: missionOnDroneDown,
    objectivesDone: missionObjectivesDone,
    objectiveText: missionObjectiveText,
    scoreText: missionScoreText,
    landingRating: missionLandingRating,
    landingBonus: missionLandingBonus,
    endTitle: missionEndTitle,
    endNote: missionEndNote
  };
})();

/* Archipelago Run — audio.js
   Synthesised WebAudio sound effects — no audio files, nothing fetched.
   An engine hum follows throttle and speed, plus cannon shots, a ring
   chime, a drone explosion, a landing sting and a crash thud. Everything
   is guarded: with no AudioContext, or before the first user gesture,
   every call is a silent no-op, so headless play never breaks. */

var FlightAudio = (function () {
  var ctx = null;
  var master = null;
  var engineOsc = null;
  var engineOsc2 = null;
  var engineGain = null;
  var engineFilter = null;
  var started = false;

  function audioAvailable() {
    return typeof window !== 'undefined' &&
      (window.AudioContext || window.webkitAudioContext);
  }

  /* Starts the audio graph. Call only from a user gesture (LAUNCH MISSION);
     returns false when audio is unavailable instead of throwing. */
  function audioEnsure() {
    if (started) return true;
    if (!audioAvailable()) return false;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      /* Engine hum: two detuned saws through a low-pass, gain by throttle. */
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'sawtooth';
      engineOsc2.frequency.value = 55 * 1.5;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      engineOsc2.start();
      started = true;
      if (ctx.resume) ctx.resume().catch(function () {});
      return true;
    } catch (e) {
      ctx = null;
      return false;
    }
  }

  /* Per-frame engine voice: pitch rises with throttle and speed, the
     filter opens with throttle, gain follows throttle. */
  function audioSetEngine(throttle, speedNorm) {
    if (!started || !ctx) return;
    try {
      var t = ctx.currentTime;
      var base = 42 + throttle * 46 + speedNorm * 22;
      engineOsc.frequency.setTargetAtTime(base, t, 0.08);
      engineOsc2.frequency.setTargetAtTime(base * 1.494, t, 0.08);
      engineFilter.frequency.setTargetAtTime(260 + throttle * 620, t, 0.1);
      engineGain.gain.setTargetAtTime(0.05 + throttle * 0.11, t, 0.1);
    } catch (e) {}
  }

  function audioTone(freq, dur, type, vol, delay, slideTo) {
    if (!started || !ctx) return;
    try {
      var t0 = ctx.currentTime + (delay || 0);
      var osc = ctx.createOscillator();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(vol || 0.2, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(g);
      g.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch (e) {}
  }

  function audioNoise(dur, filterFreq, vol, delay) {
    if (!started || !ctx) return;
    try {
      var t0 = ctx.currentTime + (delay || 0);
      var len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var data = buf.getChannelData(0);
      var i;
      for (i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = ctx.createBufferSource();
      src.buffer = buf;
      var filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = filterFreq || 1200;
      var g = ctx.createGain();
      g.gain.value = vol || 0.3;
      src.connect(filt);
      filt.connect(g);
      g.connect(master);
      src.start(t0);
    } catch (e) {}
  }

  function audioCannon() {
    audioNoise(0.09, 2400, 0.25);
    audioTone(190, 0.08, 'square', 0.12, 0, 90);
  }

  function audioChime() {
    audioTone(659.25, 0.35, 'sine', 0.22);
    audioTone(987.77, 0.5, 'sine', 0.2, 0.09);
  }

  function audioExplosion() {
    audioNoise(0.7, 900, 0.5);
    audioTone(120, 0.5, 'sine', 0.35, 0, 40);
  }

  function audioLanding() {
    audioTone(523.25, 0.22, 'triangle', 0.22);
    audioTone(659.25, 0.22, 'triangle', 0.22, 0.14);
    audioTone(783.99, 0.4, 'triangle', 0.24, 0.28);
  }

  function audioCrash() {
    audioNoise(0.5, 500, 0.5);
    audioTone(90, 0.7, 'sine', 0.4, 0, 30);
  }

  return {
    ensure: audioEnsure,
    setEngine: audioSetEngine,
    cannon: audioCannon,
    chime: audioChime,
    explosion: audioExplosion,
    landing: audioLanding,
    crash: audioCrash
  };
})();

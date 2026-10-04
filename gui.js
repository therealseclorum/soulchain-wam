const stages = ["SEED", "HARMONY", "GHOST", "SHADOW", "SPACE", "MEMORY"];

export async function createElement(plugin) {
  const root = document.createElement("div");
  root.className = "soulchain";
  root.innerHTML = `
    <style>
      .soulchain {
        width: 620px;
        min-height: 420px;
        box-sizing: border-box;
        padding: 24px;
        color: #e9e7ff;
        background:
          radial-gradient(circle at 20% 10%, rgba(125,92,255,.24), transparent 34%),
          radial-gradient(circle at 90% 85%, rgba(0,220,255,.12), transparent 36%),
          #080811;
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 18px;
        box-shadow: 0 20px 60px rgba(0,0,0,.5), inset 0 0 50px rgba(90,70,160,.06);
      }
      .top { display:flex; justify-content:space-between; align-items:flex-start; }
      .brand { letter-spacing:.22em; font-size:22px; font-weight:800; }
      .sub { color:#77778e; font-size:10px; letter-spacing:.2em; margin-top:5px; }
      .status { text-align:right; font-size:10px; color:#8f8fa8; letter-spacing:.16em; }
      .orb {
        height:125px; margin:20px 0; border-radius:18px; position:relative; overflow:hidden;
        background: radial-gradient(circle at 50% 50%, rgba(150,110,255,.24), transparent 25%),
                    radial-gradient(circle at 35% 55%, rgba(50,180,255,.12), transparent 30%),
                    #0d0d1a;
        border:1px solid rgba(255,255,255,.08);
      }
      .orb:before {
        content:""; position:absolute; inset:25px; border-radius:50%;
        border:1px solid rgba(180,150,255,.22);
        box-shadow:0 0 40px rgba(130,100,255,.16), inset 0 0 30px rgba(130,100,255,.12);
        animation: breathe 3.8s ease-in-out infinite;
      }
      .playing .orb:before { animation-duration:1.2s; box-shadow:0 0 65px rgba(130,100,255,.34), inset 0 0 45px rgba(50,200,255,.18); }
      @keyframes breathe { 50% { transform:scale(1.06); opacity:.62; } }
      .stages { display:grid; grid-template-columns:repeat(6,1fr); gap:5px; }
      .stage { padding:8px 3px; text-align:center; font-size:9px; letter-spacing:.12em; color:#606078; border-bottom:2px solid #1b1b2c; }
      .stage.active { color:#e9e7ff; border-color:#9b78ff; text-shadow:0 0 15px rgba(150,110,255,.7); }
      .controls { display:flex; gap:8px; margin-top:18px; }
      button {
        border:1px solid rgba(255,255,255,.14); background:#121222; color:#eee;
        border-radius:10px; padding:10px 15px; cursor:pointer; font-weight:700;
      }
      button:hover { background:#1a1a30; }
      button.primary { background:#8060e8; border-color:#a88fff; }
      .row { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:18px; }
      label { display:flex; justify-content:space-between; font-size:10px; color:#818197; letter-spacing:.12em; }
      input[type=range] { width:100%; accent-color:#9675ff; margin-top:8px; }
      .seed { margin-top:17px; color:#77778e; font:11px ui-monospace,monospace; }
    </style>

    <div class="top">
      <div>
        <div class="brand">SOULCHAIN</div>
        <div class="sub">MUSICAL MUTATION ENGINE</div>
      </div>
      <div class="status"><span class="stageName">SEED</span><br><span class="mut">MUTATION 0</span></div>
    </div>

    <div class="orb"></div>
    <div class="stages">${stages.map((s,i)=>`<div class="stage ${i===0?'active':''}" data-stage="${i}">${s}</div>`).join("")}</div>

    <div class="controls">
      <button class="primary play">PLAY</button>
      <button class="stop">STOP</button>
      <button class="mutate">MUTATE</button>
    </div>

    <div class="row">
      <div>
        <label>TEMPO <span class="tempoValue">82</span></label>
        <input class="tempo" type="range" min="50" max="180" value="82">
      </div>
      <div>
        <label>LEVEL <span class="levelValue">80%</span></label>
        <input class="level" type="range" min="0" max="100" value="80">
      </div>
    </div>
    <div class="seed">SEED: <span class="seedValue">0 · 3 · 7 · 10</span></div>
  `;

  const $ = (s) => root.querySelector(s);
  const sync = (s) => {
    $(".stageName").textContent = s.stageName;
    $(".mut").textContent = `MUTATION ${s.mutation}`;
    $(".tempoValue").textContent = Math.round(s.tempo);
    $(".levelValue").textContent = `${Math.round(s.level * 100)}%`;
    $(".seedValue").textContent = s.seed.join(" · ");
    $(".orb").classList.toggle("playing", s.playing);
    root.classList.toggle("playing", s.playing);
    root.querySelectorAll(".stage").forEach(el => {
      el.classList.toggle("active", Number(el.dataset.stage) === s.stage);
    });
  };

  $(".play").onclick = () => plugin.start();
  $(".stop").onclick = () => plugin.stop();
  $(".mutate").onclick = () => plugin.mutate();

  $(".tempo").oninput = (e) => plugin.setParamValue("tempo", Number(e.target.value));
  $(".level").oninput = (e) => plugin.setParamValue("level", Number(e.target.value) / 100);

  root.querySelectorAll(".stage").forEach(el => {
    el.onclick = () => plugin.setStage(Number(el.dataset.stage));
  });

  const unsubscribe = plugin.onState(sync);
  sync(plugin.getState());

  // Hosts may remove/recreate GUIs. Keep the callback harmless if that happens.
  root.addEventListener("DOMNodeRemoved", () => unsubscribe(), {once:true});

  return root;
}

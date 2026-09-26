/* ══════════════════════════════════════════════════════════════
   NOEDIS Three.js Isometric Gameplay — v2.0
   ══════════════════════════════════════════════════════════════ */

// ─── SCENE GLOBALS ──────────────────────────────────────────
let scene, camera, renderer;
let clock = new THREE.Clock();
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let buildingGroup, floorGroups = [], agentMeshes = [];
let activeFloor = 0, targetFloor = 0;
let cameraState = { angle: 0, height: 0, zoom: 1 };
let targetCameraState = { angle: 0, height: 0, zoom: 1 };
let selectedAgent = null;
let hoveredAgent = null;
let animFrameId = null;
let containerEl = null;
let allAgents = [];
let chatPanelEl = null;
let floorLabelsEl = null;
let hierarchyLines = [];
let particles = [];
let autoRotate = true;
let isTransitioning = false;

// ─── COLORS ─────────────────────────────────────────────────
const FLOOR_COLORS = [
  { label: 'EXECUTIVE',     color: 0xffb000, bg: '#ffb000' },
  { label: 'USER',          color: 0x33ddff, bg: '#33ddff' },
  { label: 'TECHNOLOGY',    color: 0x33ff33, bg: '#33ff33' },
  { label: 'GAME & ECONOMY',color: 0xaa66ff, bg: '#aa66ff' },
  { label: 'CREATIVE',      color: 0xff66aa, bg: '#ff66aa' },
  { label: 'MARKETING + BIZ',color: 0xff8800, bg: '#ff8800' },
  { label: 'LEGAL + QA',    color: 0x4488ff, bg: '#4488ff' }
];

const STATUS_COLORS = {
  idle:    0x888888,
  working: 0x33ff33,
  active:  0x33ff33,
  running: 0x33ff33,
  paused:  0xffb000,
  error:   0xff4444,
  failed:  0xff4444
};

// ─── INIT ───────────────────────────────────────────────────
export function initThreeGameplay(container, agentsData) {
  containerEl = container;
  allAgents = agentsData || [];

  // Create scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0f);
  scene.fog = new THREE.Fog(0x0a0a0f, 30, 60);

  // Camera
  const aspect = container.clientWidth / container.clientHeight;
  const d = 16;
  camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 0.1, 100);
  camera.position.set(15, 10, 15);
  camera.lookAt(0, 0, 0);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0x222244, 0.6);
  scene.add(ambientLight);

  const hemiLight = new THREE.HemisphereLight(0x4466ff, 0x222244, 0.8);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffeedd, 2.5);
  dirLight.position.set(10, 15, 8);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 30;
  dirLight.shadow.camera.left = -20;
  dirLight.shadow.camera.right = 20;
  dirLight.shadow.camera.top = 20;
  dirLight.shadow.camera.bottom = -20;
  scene.add(dirLight);

  const fillLight = new THREE.DirectionalLight(0x8888ff, 0.6);
  fillLight.position.set(-8, 5, -6);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0x00ffaa, 0.4);
  rimLight.position.set(-5, 8, 10);
  scene.add(rimLight);

  // Ground
  const groundGeo = new THREE.PlaneGeometry(40, 40);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x0a0a14,
    roughness: 0.9,
    metalness: 0.1,
    transparent: true,
    opacity: 0.8
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.5;
  ground.receiveShadow = true;
  scene.add(ground);

  // Grid
  const gridHelper = new THREE.GridHelper(30, 30, 0x222244, 0x111833);
  gridHelper.position.y = -0.45;
  scene.add(gridHelper);

  // Build building
  buildingGroup = new THREE.Group();
  scene.add(buildingGroup);
  buildBuilding();

  // Ambient particles
  createAmbientParticles();

  // Floor switcher UI
  createFloorSwitcher();

  // Chat panel
  createChatPanel();

  // Hierarchy labels
  createHierarchyLabels();

  // Events
  container.addEventListener('mousedown', onMouseDown);
  container.addEventListener('mousemove', onMouseMove);
  container.addEventListener('wheel', onWheel);
  window.addEventListener('resize', onResize);

  // Keyboard
  document.addEventListener('keydown', onKeyDown);

  // Start
  animate();
}

// ─── BUILDING ───────────────────────────────────────────────
function buildBuilding() {
  const floors = FLOOR_COLORS.length;
  const spacing = 3.2;
  const floorW = 8, floorD = 6;

  for (let i = 0; i < floors; i++) {
    const yPos = i * spacing;
    const group = new THREE.Group();
    group.position.y = yPos;
    group.userData.floorIndex = i;

    // Floor platform
    const platGeo = new THREE.BoxGeometry(floorW, 0.08, floorD);
    const platMat = new THREE.MeshPhysicalMaterial({
      color: FLOOR_COLORS[i].color,
      transparent: true,
      opacity: 0.25,
      roughness: 0.3,
      metalness: 0.6,
      clearcoat: 0.3,
      clearcoatRoughness: 0.4
    });
    const platform = new THREE.Mesh(platGeo, platMat);
    platform.position.y = 0.04;
    platform.receiveShadow = true;
    group.add(platform);

    // Floor border glow
    const borderGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(floorW, 0.02, floorD));
    const borderMat = new THREE.LineBasicMaterial({
      color: FLOOR_COLORS[i].color,
      transparent: true,
      opacity: 0.6
    });
    const border = new THREE.LineSegments(borderGeo, borderMat);
    border.position.y = 0.09;
    group.add(border);

    // Glass walls (semi-transparent)
    const wallMat = new THREE.MeshPhysicalMaterial({
      color: FLOOR_COLORS[i].color,
      transparent: true,
      opacity: 0.08,
      roughness: 0.05,
      metalness: 0.1,
      side: THREE.DoubleSide
    });

    const wallPositions = [
      { x: 0, z: -floorD/2, w: floorW, h: 1.5, rot: 0 },
      { x: floorW/2, z: 0, w: floorD, h: 1.5, rot: Math.PI/2 },
      { x: -floorW/2, z: 0, w: floorD, h: 1.5, rot: Math.PI/2 }
    ];

    for (const wp of wallPositions) {
      const wallGeo = new THREE.PlaneGeometry(wp.w, wp.h);
      const wall = new THREE.Mesh(wallGeo, wallMat);
      wall.position.set(wp.x, 0.75, wp.z);
      wall.rotation.y = wp.rot;
      group.add(wall);
    }

    // Floor label (3D text sprite)
    const labelSprite = createTextSprite(FLOOR_COLORS[i].label, FLOOR_COLORS[i].color);
    labelSprite.position.set(0, 1.6, -floorD/2 - 0.8);
    labelSprite.scale.set(2.5, 0.7, 1);
    group.add(labelSprite);

    // Agent positions on this floor
    const floorAgents = allAgents.filter((a, idx) => {
      const fi = getAgentFloor(idx);
      return fi === i;
    });

    placeAgentsOnFloor(group, floorAgents, i, floorW, floorD);

    buildingGroup.add(group);
    floorGroups.push(group);
  }

  // Building core (elevator shaft)
  const coreMat = new THREE.MeshPhysicalMaterial({
    color: 0x1a1a2a,
    transparent: true,
    opacity: 0.3,
    roughness: 0.4,
    metalness: 0.8
  });
  const coreGeo = new THREE.BoxGeometry(0.3, floors * spacing, 0.3);
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.position.set(-floorW/2 - 0.5, (floors * spacing) / 2 - spacing/2, 0);
  buildingGroup.add(core);

  // Window frames on core
  for (let i = 0; i < floors; i++) {
    const frameMat = new THREE.MeshBasicMaterial({
      color: FLOOR_COLORS[i].color,
      transparent: true,
      opacity: 0.3
    });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), frameMat);
    frame.position.set(-floorW/2 - 0.5, i * spacing + spacing/2, 0);
    buildingGroup.add(frame);
  }

  // Connect floors with reporting hierarchy lines
  buildHierarchyLines(floorW, floorD, spacing);
}

// ─── AGENTS ON FLOOR ────────────────────────────────────────
function placeAgentsOnFloor(floorGroup, agents, floorIdx, floorW, floorD) {
  const cols = 3;
  const spacingX = floorW / (cols + 1);
  const spacingZ = floorD / (Math.ceil(agents.length / cols) + 1);

  agents.forEach((agent, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = -floorW/2 + spacingX * (col + 1);
    const z = -floorD/2 + spacingZ * (row + 1);

    const agentMesh = createAgentMesh(agent, floorIdx);
    agentMesh.position.set(x, 0.3, z);
    agentMesh.userData.agent = agent;
    agentMesh.userData.floorIndex = floorIdx;
    floorGroup.add(agentMesh);
    agentMeshes.push(agentMesh);
  });
}

// ─── AGENT MESH ─────────────────────────────────────────────
function createAgentMesh(agent, floorIdx) {
  const group = new THREE.Group();

  const status = (agent.status || 'idle').toLowerCase();
  const color = STATUS_COLORS[status] || 0x888888;

  // Body (cylinder)
  const bodyGeo = new THREE.CylinderGeometry(0.25, 0.3, 0.5, 8);
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: color,
    roughness: 0.4,
    metalness: 0.3,
    emissive: color,
    emissiveIntensity: 0.1
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.35;
  body.castShadow = true;
  group.add(body);

  // Head (sphere)
  const headGeo = new THREE.SphereGeometry(0.18, 12, 12);
  const headMat = new THREE.MeshPhysicalMaterial({
    color: 0xddddff,
    roughness: 0.3,
    metalness: 0.1
  });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 0.7;
  head.castShadow = true;
  group.add(head);

  // Glow ring
  const ringGeo = new THREE.RingGeometry(0.35, 0.45, 24);
  const ringMat = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  group.add(ring);

  // Status light (small sphere on top)
  const lightGeo = new THREE.SphereGeometry(0.06, 8, 8);
  const lightMat = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.8
  });
  const light = new THREE.Mesh(lightGeo, lightMat);
  light.position.y = 0.9;
  group.add(light);
  light.userData.isLight = true;

  // Name label
  const name = agent.name || agent.codename || 'Agent';
  const shortName = name.length > 8 ? name.substring(0, 7) + '…' : name;
  const nameSprite = createTextSprite(shortName, color);
  nameSprite.position.set(0, 1.1, 0);
  nameSprite.scale.set(1.5, 0.4, 1);
  group.add(nameSprite);

  // Role label (smaller)
  if (agent.role) {
    const roleStr = agent.role.length > 12 ? agent.role.substring(0, 11) + '…' : agent.role;
    const roleSprite = createTextSprite(roleStr, 0x888888);
    roleSprite.position.set(0, 0.85, 0);
    roleSprite.scale.set(1.2, 0.3, 1);
    roleSprite.userData.isRole = true;
    group.add(roleSprite);
  }

  // Clickable interaction area (invisible)
  const hitGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.8, 8);
  const hitMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide
  });
  const hitMesh = new THREE.Mesh(hitGeo, hitMat);
  hitMesh.position.y = 0.4;
  hitMesh.userData.isHitArea = true;
  group.add(hitMesh);

  group.userData.isAgent = true;
  group.userData.agentData = agent;

  return group;
}

// ─── TEXT SPRITE ────────────────────────────────────────────
function createTextSprite(text, color) {
  const canvas = document.createElement('canvas');
  const size = 256;
  canvas.width = size;
  canvas.height = size / 4;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const hexColor = '#' + new THREE.Color(color).getHexString();
  ctx.fillStyle = hexColor;
  ctx.font = 'bold 38px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 8;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;

  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    depthTest: false
  });
  return new THREE.Sprite(mat);
}

// ─── HIERARCHY LINES ────────────────────────────────────────
function buildHierarchyLines(floorW, floorD, spacing) {
  // Draw lines from each floor's agents to the floor below (reporting up)
  for (let i = 1; i < floorGroups.length; i++) {
    const agentsOnFloor = agentMeshes.filter(m => m.userData.floorIndex === i);
    const agentsBelow = agentMeshes.filter(m => m.userData.floorIndex === i - 1);

    if (agentsBelow.length === 0 || agentsOnFloor.length === 0) continue;

    agentsOnFloor.forEach((agentMesh, idx) => {
      const belowIdx = idx % agentsBelow.length;
      const belowMesh = agentsBelow[belowIdx];

      const worldPos = new THREE.Vector3();
      agentMesh.getWorldPosition(worldPos);
      const belowPos = new THREE.Vector3();
      belowMesh.getWorldPosition(belowPos);

      const points = [
        new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z),
        new THREE.Vector3(worldPos.x, (worldPos.y + belowPos.y) / 2, worldPos.z),
        new THREE.Vector3(belowPos.x, (worldPos.y + belowPos.y) / 2, belowPos.z),
        new THREE.Vector3(belowPos.x, belowPos.y, belowPos.z)
      ];

      const curve = new THREE.CatmullRomCurve3(points);
      const curvePoints = curve.getPoints(20);
      const geo = new THREE.BufferGeometry().setFromPoints(curvePoints);

      const color = FLOOR_COLORS[i].color;
      const mat = new THREE.LineBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.15,
        linewidth: 1
      });

      const line = new THREE.Line(geo, mat);
      buildingGroup.add(line);
      hierarchyLines.push(line);

      // Data flow dot
      const dotGeo = new THREE.SphereGeometry(0.04, 6, 6);
      const dotMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.6
      });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.userData.curve = curve;
      dot.userData.progress = idx / agentsOnFloor.length;
      dot.userData.speed = 0.2 + Math.random() * 0.3;
      buildingGroup.add(dot);
      particles.push(dot);
    });
  }
}

// ─── AMBIENT PARTICLES ──────────────────────────────────────
function createAmbientParticles() {
  const count = 200;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 40;
    positions[i * 3 + 1] = Math.random() * 25;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 40;

    const c = new THREE.Color(FLOOR_COLORS[Math.floor(Math.random() * FLOOR_COLORS.length)].color);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.05,
    transparent: true,
    opacity: 0.4,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const points = new THREE.Points(geo, mat);
  points.userData.isParticles = true;
  scene.add(points);
}

// ─── FLOOR SWITCHER UI ──────────────────────────────────────
function createFloorSwitcher() {
  floorLabelsEl = document.createElement('div');
  floorLabelsEl.id = 'floor-switcher';
  floorLabelsEl.innerHTML = FLOOR_COLORS.map((f, i) =>
    `<button class="floor-btn ${i === 0 ? 'active' : ''}" data-floor="${i}" style="--floor-color: ${f.bg}">
       <span class="floor-dot"></span>
       <span class="floor-name">${f.label}</span>
       <span class="floor-num">L${i}</span>
     </button>`
  ).join('');

  floorLabelsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.floor-btn');
    if (!btn) return;
    const fi = parseInt(btn.dataset.floor);
    if (!isNaN(fi)) switchToFloor(fi);
  });

  containerEl.parentElement.appendChild(floorLabelsEl);
}

// ─── CHAT PANEL ─────────────────────────────────────────────
function createChatPanel() {
  chatPanelEl = document.createElement('div');
  chatPanelEl.id = 'agent-chat-panel';
  chatPanelEl.className = 'chat-panel hidden';
  chatPanelEl.innerHTML = `
    <div class="chat-header">
      <div class="chat-agent-info">
        <span class="chat-agent-avatar">◆</span>
        <div>
          <div class="chat-agent-name">Agent</div>
          <div class="chat-agent-role">Role</div>
        </div>
      </div>
      <button class="chat-close">✕</button>
    </div>
    <div class="chat-messages">
      <div class="chat-welcome">
        <div class="chat-welcome-icon">◈</div>
        <div class="chat-welcome-text">Select an agent to start chatting</div>
      </div>
    </div>
    <div class="chat-input-area">
      <input type="text" class="chat-input" placeholder="Type a message..." disabled />
      <button class="chat-send" disabled>→</button>
    </div>
  `;

  containerEl.parentElement.appendChild(chatPanelEl);

  // Events
  chatPanelEl.querySelector('.chat-close').addEventListener('click', closeChat);

  const input = chatPanelEl.querySelector('.chat-input');
  const sendBtn = chatPanelEl.querySelector('.chat-send');

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      sendChatMessage(input.value.trim());
    }
  });

  sendBtn.addEventListener('click', () => {
    if (input.value.trim()) sendChatMessage(input.value.trim());
  });
}

// ─── HIERARCHY LABELS ───────────────────────────────────────
function createHierarchyLabels() {
  const label = document.createElement('div');
  label.id = 'hierarchy-label';
  label.className = 'hierarchy-label hidden';
  containerEl.parentElement.appendChild(label);
}

// ─── SWITCH FLOOR ───────────────────────────────────────────
export function switchToFloor(floorIndex) {
  if (isTransitioning || floorIndex === activeFloor) return;
  targetFloor = Math.max(0, Math.min(floorIndex, FLOOR_COLORS.length - 1));
  isTransitioning = true;
  autoRotate = false;

  // Update UI
  document.querySelectorAll('.floor-btn').forEach((btn, i) => {
    btn.classList.toggle('active', i === targetFloor);
  });

  // Camera will animate to this floor
  setTimeout(() => {
    isTransitioning = false;
    // Resume auto-rotate after a delay
    setTimeout(() => { autoRotate = true; }, 3000);
  }, 800);
}

// ─── CHAT ───────────────────────────────────────────────────
function openChat(agent) {
  if (!agent || !chatPanelEl) return;
  selectedAgent = agent;
  chatPanelEl.classList.remove('hidden');

  const name = agent.name || agent.codename || 'Unknown Agent';
  const role = agent.role || 'Specialist';

  chatPanelEl.querySelector('.chat-agent-name').textContent = name;
  chatPanelEl.querySelector('.chat-agent-role').textContent = role;

  const avatar = chatPanelEl.querySelector('.chat-agent-avatar');
  const status = (agent.status || 'idle').toLowerCase();
  const colors = { idle: '#888', working: '#3f3', active: '#3f3', running: '#3f3', paused: '#fb0', error: '#f44', failed: '#f44' };
  avatar.style.color = colors[status] || '#888';

  const msgs = chatPanelEl.querySelector('.chat-messages');
  msgs.innerHTML = `
    <div class="chat-message agent">
      <div class="msg-bubble">Hello! I'm ${name}, ${role}. How can I help you today?</div>
    </div>
  `;

  const input = chatPanelEl.querySelector('.chat-input');
  const sendBtn = chatPanelEl.querySelector('.chat-send');
  input.disabled = false;
  sendBtn.disabled = false;
  input.placeholder = `Message ${name}...`;
  input.focus();
}

function closeChat() {
  if (!chatPanelEl) return;
  chatPanelEl.classList.add('hidden');
  selectedAgent = null;
}

async function sendChatMessage(text) {
  if (!selectedAgent) return;

  const msgs = chatPanelEl.querySelector('.chat-messages');
  const input = chatPanelEl.querySelector('.chat-input');

  // User message
  msgs.innerHTML += `<div class="chat-message user"><div class="msg-bubble">${escapeHtml(text)}</div></div>`;
  input.value = '';
  msgs.scrollTop = msgs.scrollHeight;

  // Loading
  msgs.innerHTML += `<div class="chat-message agent"><div class="msg-bubble thinking"><span>●</span><span>●</span><span>●</span></div></div>`;

  try {
    const agentId = selectedAgent.id || selectedAgent.codename;
    const res = await fetch('/noedis/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: agentId, message: text })
    });
    const data = await res.json();

    // Remove thinking
    const thinking = msgs.querySelector('.thinking');
    if (thinking) thinking.closest('.chat-message').remove();

    const reply = data.response || data.message || 'I received your message. Processing...';
    msgs.innerHTML += `<div class="chat-message agent"><div class="msg-bubble">${escapeHtml(reply)}</div></div>`;
  } catch (e) {
    const thinking = msgs.querySelector('.thinking');
    if (thinking) thinking.closest('.chat-message').remove();
    msgs.innerHTML += `<div class="chat-message agent"><div class="msg-bubble error">Connection error. Please try again.</div></div>`;
  }

  msgs.scrollTop = msgs.scrollHeight;
}

// ─── HELPERS ────────────────────────────────────────────────
function getAgentFloor(idx) {
  // NOE COMMAND/REPORT → floor 0
  // Then distribute based on role
  const a = allAgents[idx];
  if (!a) return 1;

  const n = (a.name || '').toUpperCase();
  const r = (a.role || '').toUpperCase();

  if (n.indexOf('COMMAND') >= 0 || r.indexOf('COMMAND') >= 0 ||
      n.indexOf('REPORT') >= 0 || r.indexOf('REPORT') >= 0 ||
      n.indexOf('NOE') >= 0) return 0;
  if (n.indexOf('USER') >= 0 || r.indexOf('USER') >= 0) return 1;
  if (n.indexOf('TECH') >= 0 || n.indexOf('ENG') >= 0 || n.indexOf('DEV') >= 0 || r.indexOf('TECH') >= 0) return 2;
  if (n.indexOf('GAME') >= 0 || n.indexOf('ECON') >= 0 || r.indexOf('GAME') >= 0) return 3;
  if (n.indexOf('CREATE') >= 0 || n.indexOf('DESIGN') >= 0 || n.indexOf('ART') >= 0 || r.indexOf('CREATE') >= 0) return 4;
  if (n.indexOf('MARKET') >= 0 || n.indexOf('BIZ') >= 0 || r.indexOf('MARKET') >= 0) return 5;
  if (n.indexOf('LEGAL') >= 0 || n.indexOf('QA') >= 0 || n.indexOf('LAB') >= 0 || n.indexOf('RELEASE') >= 0) return 6;

  return (idx % 6) + 1;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ─── EVENTS ─────────────────────────────────────────────────
function onMouseDown(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  // Check agent intersections
  const agentMeshesFlat = [];
  agentMeshes.forEach(g => {
    g.children.forEach(child => {
      if (child.userData.isHitArea) {
        agentMeshesFlat.push(child);
      }
    });
  });

  const intersects = raycaster.intersectObjects(agentMeshesFlat);

  if (intersects.length > 0) {
    const hit = intersects[0].object;
    const parentGroup = hit.parent;
    if (parentGroup && parentGroup.userData.isAgent) {
      openChat(parentGroup.userData.agentData);
      return;
    }
  }

  // Click on empty space → close chat
  closeChat();
}

function onMouseMove(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const agentMeshesFlat = [];
  agentMeshes.forEach(g => {
    g.children.forEach(child => {
      if (child.userData.isHitArea) {
        agentMeshesFlat.push(child);
      }
    });
  });

  const intersects = raycaster.intersectObjects(agentMeshesFlat);

  if (intersects.length > 0) {
    const parentGroup = intersects[0].object.parent;
    if (parentGroup && parentGroup.userData.isAgent) {
      renderer.domElement.style.cursor = 'pointer';
      if (hoveredAgent !== parentGroup) {
        hoveredAgent = parentGroup;
        highlightAgent(parentGroup, true);
      }
      return;
    }
  }

  renderer.domElement.style.cursor = 'default';
  if (hoveredAgent) {
    highlightAgent(hoveredAgent, false);
    hoveredAgent = null;
  }
}

function highlightAgent(agentGroup, on) {
  agentGroup.children.forEach(child => {
    if (child.isMesh && child.material && !child.userData.isHitArea) {
      if (child.material.emissiveIntensity !== undefined) {
        child.material.emissiveIntensity = on ? 0.5 : 0.1;
      }
    }
  });

  // Scale
  const targetScale = on ? 1.2 : 1;
  agentGroup.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
}

function onWheel(event) {
  const zoom = event.deltaY > 0 ? 1.1 : 0.9;
  targetCameraState.zoom *= zoom;
  targetCameraState.zoom = Math.max(0.4, Math.min(2, targetCameraState.zoom));
}

function onResize() {
  if (!containerEl || !camera || !renderer) return;
  const w = containerEl.clientWidth;
  const h = containerEl.clientHeight;
  const aspect = w / h;
  const d = 16 / cameraState.zoom;
  camera.left = -d * aspect;
  camera.right = d * aspect;
  camera.top = d;
  camera.bottom = -d;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

function onKeyDown(e) {
  if (e.key === 'Escape') closeChat();
  if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
    switchToFloor(targetFloor + 1);
    e.preventDefault();
  }
  if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
    switchToFloor(targetFloor - 1);
    e.preventDefault();
  }
}

// ─── ANIMATION LOOP ─────────────────────────────────────────
function animate() {
  animFrameId = requestAnimationFrame(animate);
  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  // Auto-rotate
  if (autoRotate) {
    const targetAngle = Math.PI * 0.25 + Math.sin(elapsed * 0.03) * 0.1;
    cameraState.angle += (targetAngle - cameraState.angle) * 0.01;
  }

  // Floor transition
  const targetY = targetFloor * 3.2;
  const spacing = 3.2;
  const totalHeight = FLOOR_COLORS.length * spacing;

  // Camera follows the active floor
  if (isTransitioning) {
    cameraState.height += (targetY - cameraState.height) * 0.05;
  }

  // Update camera position
  const radius = 14 / cameraState.zoom;
  const heightOffset = 8 / cameraState.zoom;

  const targetCamY = cameraState.height + heightOffset;
  camera.position.x = Math.cos(cameraState.angle) * radius;
  camera.position.z = Math.sin(cameraState.angle) * radius;
  camera.position.y = targetCamY;

  camera.lookAt(0, cameraState.height, 0);

  // Update orthographic frustum for zoom
  onResize();

  // Animate agents
  agentMeshes.forEach((mesh, idx) => {
    // Gentle idle bob
    mesh.position.y += Math.sin(elapsed * 0.8 + idx * 2) * 0.0005;

    // Status light pulse
    mesh.children.forEach(child => {
      if (child.userData.isLight) {
        const s = (child.material.userData ||= {});
        const status = (mesh.userData.agentData?.status || 'idle').toLowerCase();
        const isActive = status === 'working' || status === 'active' || status === 'running';
        const pulse = isActive ? Math.sin(elapsed * 3 + idx) * 0.3 + 0.7 : 0.5;
        child.material.opacity = pulse;
        child.scale.setScalar(isActive ? 1 + Math.sin(elapsed * 2 + idx) * 0.2 : 1);
      }
    });

    // Hover animation
    if (hoveredAgent === mesh) {
      const s = 1 + Math.sin(elapsed * 4) * 0.03;
      mesh.scale.set(s, s, s);
    }
  });

  // Animate hierarchy data dots
  particles.forEach(dot => {
    if (dot.userData.curve) {
      dot.userData.progress += delta * dot.userData.speed;
      if (dot.userData.progress > 1) dot.userData.progress = 0;
      const pt = dot.userData.curve.getPoint(dot.userData.progress);
      dot.position.copy(pt);
    }
  });

  // Animate ambient particles
  scene.children.forEach(child => {
    if (child.userData.isParticles && child.geometry) {
      const pos = child.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        pos.array[i * 3 + 1] += Math.sin(elapsed * 0.1 + i) * 0.001;
      }
      pos.needsUpdate = true;
    }
  });

  // Floor glow pulse
  floorGroups.forEach((group, i) => {
    group.children.forEach(child => {
      if (child.isMesh && child.material && child.geometry.type === 'BoxGeometry' && child.material.opacity !== undefined) {
        if (i === targetFloor) {
          child.material.opacity = 0.35 + Math.sin(elapsed * 1.5) * 0.1;
        } else if (Math.abs(i - targetFloor) <= 1) {
          child.material.opacity = 0.2 + Math.sin(elapsed * 0.5 + i) * 0.05;
        }
      }
    });
  });

  renderer.render(scene, camera);
}

// ─── CLEANUP ────────────────────────────────────────────────
export function destroyThreeGameplay() {
  if (animFrameId) cancelAnimationFrame(animFrameId);

  if (containerEl && renderer) {
    containerEl.removeChild(renderer.domElement);
  }

  if (floorLabelsEl) floorLabelsEl.remove();
  if (chatPanelEl) chatPanelEl.remove();

  // Clean up scene
  if (scene) {
    scene.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (obj.material.map) obj.material.map.dispose();
        obj.material.dispose();
      }
    });
  }

  if (renderer) renderer.dispose();

  window.removeEventListener('resize', onResize);
  document.removeEventListener('keydown', onKeyDown);
}

// ─── GLOBALS FOR APP.JS INTEGRATION ─────────────────────────
// Expose chat functions globally so the crew rail can trigger them
window.__threeOpenChat = function(agentData) {
  openChat(agentData);
};

window.__threeCloseChat = function() {
  closeChat();
};

window.__threeGetAgentByIndex = function(idx) {
  return allAgents[idx] || null;
};

// ─── EXPORTS ────────────────────────────────────────────────
export function getAgentMeshes() { return agentMeshes; }
export function getActiveFloor() { return activeFloor; }
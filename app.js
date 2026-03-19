const STORAGE_KEY = "last-light-ten-minutes-v1";
const TURN_DELAY = 320;
const MAX_LOGS = 8;
const BASE_TIMER_MS = 10 * 60 * 1000;

const enemyNames = {
  normal: ["Bog Imp", "Moss Wolf", "Ash Beetle", "Cave Shade", "Bone Scout", "Thorn Bat"],
  miniBoss: ["Gloom Knight", "Swamp Hydra", "Ashen Stag", "Grim Idol"],
  boss: ["Crypt Tyrant", "Rift Chimera", "Storm Warlock", "Grave Colossus"],
  finalBoss: ["The Last Thing"],
};

const rewardPool = [
  {
    id: "edge",
    title: "+2 damage",
    text: "Your strikes hit harder every turn.",
    tags: ["Offense", "Reliable"],
    apply: (run) => {
      run.player.damage += 2;
    },
  },
  {
    id: "guard",
    title: "+2 defense",
    text: "Blunt incoming hits and stay upright longer.",
    tags: ["Defense", "Reliable"],
    apply: (run) => {
      run.player.defense += 2;
    },
  },
  {
    id: "vigor",
    title: "+10 max health, heal 10",
    text: "Grow tougher and patch yourself up immediately.",
    tags: ["Health", "Tempo"],
    apply: (run) => {
      run.player.maxHealth += 10;
      run.player.health = Math.min(run.player.maxHealth, run.player.health + 10);
    },
  },
  {
    id: "cinder",
    title: "+12% burn chance",
    text: "Hits may ignite enemies for damage over time.",
    tags: ["Burn", "DoT"],
    apply: (run) => {
      run.player.burnChance += 0.12;
    },
  },
  {
    id: "ember",
    title: "+2 burn damage",
    text: "Your burning effects tick harder every enemy turn.",
    tags: ["Burn", "Scaling"],
    apply: (run) => {
      run.player.burnDamage += 2;
    },
  },
  {
    id: "split",
    title: "+10% multi-hit chance",
    text: "Sometimes you strike twice before foes can react.",
    tags: ["Combo", "High roll"],
    apply: (run) => {
      run.player.multiHitChance += 0.1;
    },
  },
  {
    id: "reverb",
    title: "Splash 35% to another foe",
    text: "Each hit splashes a smaller echo into a random enemy.",
    tags: ["AoE", "Cleave"],
    apply: (run) => {
      run.player.splash = 0.35;
    },
  },
  {
    id: "tempo_down",
    title: "Emergency medallion",
    text: "Heal 18, but the doom clock loses 20 seconds.",
    tags: ["Negative", "Timer"],
    apply: (run) => {
      run.player.health = Math.min(run.player.maxHealth, run.player.health + 18);
      run.timerRemaining = Math.max(0, run.timerRemaining - 20000);
    },
  },
  {
    id: "clock_fear",
    title: "Frantic rhythm",
    text: "+3 damage, but time now drains 15% faster.",
    tags: ["Negative", "Timer"],
    apply: (run) => {
      run.player.damage += 3;
      run.timerRate += 0.15;
    },
  },
  {
    id: "thorns",
    title: "Spite shield",
    text: "Reflect 3 damage whenever enemies hit you.",
    tags: ["Defense", "Retaliate"],
    apply: (run) => {
      run.player.thorns += 3;
    },
  },
];

const ui = {
  titleScreen: document.getElementById("titleScreen"),
  gameScreen: document.getElementById("gameScreen"),
  gameOverScreen: document.getElementById("gameOverScreen"),
  startBtn: document.getElementById("startBtn"),
  resumeBtn: document.getElementById("resumeBtn"),
  wipeBtn: document.getElementById("wipeBtn"),
  restartBtn: document.getElementById("restartBtn"),
  titleBtn: document.getElementById("titleBtn"),
  menuBtn: document.getElementById("menuBtn"),
  timer: document.getElementById("timer"),
  levelValue: document.getElementById("levelValue"),
  waveValue: document.getElementById("waveValue"),
  threatValue: document.getElementById("threatValue"),
  healthValue: document.getElementById("healthValue"),
  healthFill: document.getElementById("healthFill"),
  damageValue: document.getElementById("damageValue"),
  defenseValue: document.getElementById("defenseValue"),
  burnValue: document.getElementById("burnValue"),
  multiValue: document.getElementById("multiValue"),
  encounterTitle: document.getElementById("encounterTitle"),
  enemyGrid: document.getElementById("enemyGrid"),
  rewardPanel: document.getElementById("rewardPanel"),
  rewardGrid: document.getElementById("rewardGrid"),
  logList: document.getElementById("logList"),
  gameOverTitle: document.getElementById("gameOverTitle"),
  gameOverText: document.getElementById("gameOverText"),
  summaryLevel: document.getElementById("summaryLevel"),
  summaryTurns: document.getElementById("summaryTurns"),
  summaryBosses: document.getElementById("summaryBosses"),
  summaryPowers: document.getElementById("summaryPowers"),
};

let state = loadState();
let lastFrame = 0;
let rafId = 0;
let lastSavedSecond = null;

function createNewRun() {
  return {
    screen: "game",
    run: {
      active: true,
      awaitingReward: false,
      gameOver: false,
      finalBossSpawned: false,
      timerRemaining: BASE_TIMER_MS,
      timerRate: 1,
      level: 1,
      wave: 1,
      bossesDefeated: 0,
      turnsTaken: 0,
      chosenPowers: [],
      player: {
        health: 44,
        maxHealth: 44,
        damage: 8,
        defense: 2,
        burnChance: 0.08,
        burnDamage: 3,
        multiHitChance: 0.06,
        splash: 0,
        thorns: 0,
      },
      enemies: [],
      logs: ["<strong>The bell tolls.</strong> Ten minutes remain."],
      nextEnemyId: 1,
      threat: "Skirmish",
    },
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { screen: "title", run: null };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { screen: "title", run: null };
    return {
      screen: parsed.screen || (parsed.run?.active ? "game" : "title"),
      run: parsed.run || null,
    };
  } catch {
    return { screen: "title", run: null };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function clearState() {
  localStorage.removeItem(STORAGE_KEY);
  state = { screen: "title", run: null };
}

function showScreen(name) {
  const map = {
    title: ui.titleScreen,
    game: ui.gameScreen,
    gameOver: ui.gameOverScreen,
  };

  Object.values(map).forEach((node) => {
    node.hidden = true;
    node.classList.remove("active");
  });

  map[name].hidden = false;
  map[name].classList.add("active");
  state.screen = name;
  saveState();
}

function startRun() {
  state = createNewRun();
  spawnEncounter();
  showScreen("game");
  syncTitleButtons();
  render();
}

function resumeRun() {
  if (!state.run) return;
  showScreen(state.run.gameOver ? "gameOver" : "game");
  render();
}

function abandonToTitle() {
  if (!state.run) {
    showScreen("title");
    return;
  }
  state.screen = "title";
  saveState();
  showScreen("title");
  syncTitleButtons();
}

function syncTitleButtons() {
  const resumable = Boolean(state.run && state.run.active && !state.run.gameOver);
  ui.resumeBtn.hidden = !resumable;
  ui.wipeBtn.hidden = !state.run;
}

function render() {
  syncTitleButtons();
  if (state.screen === "game" && state.run) {
    renderGame();
  } else if (state.screen === "gameOver" && state.run) {
    renderGameOver();
  }
}

function renderGame() {
  const { run } = state;
  ui.timer.textContent = formatTime(run.timerRemaining);
  ui.levelValue.textContent = String(run.level);
  ui.waveValue.textContent = String(run.wave);
  ui.threatValue.textContent = run.threat;
  ui.healthValue.textContent = `${Math.max(0, Math.ceil(run.player.health))} / ${run.player.maxHealth}`;
  ui.healthFill.style.width = `${Math.max(0, (run.player.health / run.player.maxHealth) * 100)}%`;
  ui.damageValue.textContent = String(run.player.damage);
  ui.defenseValue.textContent = String(run.player.defense);
  ui.burnValue.textContent = `${Math.round(run.player.burnChance * 100)}%`;
  ui.multiValue.textContent = `${Math.round(run.player.multiHitChance * 100)}%`;
  ui.encounterTitle.textContent = encounterTitle(run);
  renderEnemies(run.enemies);
  renderRewards();
  renderLogs();
}

function renderEnemies(enemies) {
  ui.enemyGrid.innerHTML = enemies
    .map((enemy) => {
      const hpPercent = Math.max(0, (enemy.health / enemy.maxHealth) * 100);
      const burnTag = enemy.dotBurn > 0 ? `<span class="tag">Burn ${enemy.dotBurn}</span>` : "";
      return `
        <button class="enemy-card ${enemy.kind !== "normal" ? "is-boss" : ""} ${enemy.health <= 0 ? "dead" : ""}" data-enemy-id="${enemy.id}" ${enemy.health <= 0 || state.run.awaitingReward || state.run.gameOver ? "disabled" : ""}>
          <div class="enemy-top">
            <div>
              <div class="enemy-name">${enemy.name}</div>
              <div class="enemy-tags">
                <span class="tag">ATK ${enemy.damage}</span>
                <span class="tag">DEF ${enemy.defense}</span>
                ${burnTag}
              </div>
            </div>
            <span class="tag">${enemy.label}</span>
          </div>
          <div class="enemy-hp">
            <strong>${Math.max(0, Math.ceil(enemy.health))} / ${enemy.maxHealth} HP</strong>
            <div class="meter"><span style="width:${hpPercent}%"></span></div>
          </div>
        </button>`;
    })
    .join("");

  ui.enemyGrid.querySelectorAll("[data-enemy-id]").forEach((button) => {
    button.addEventListener("click", () => handleEnemyTap(Number(button.dataset.enemyId)));
  });
}

function renderRewards() {
  const { run } = state;
  ui.rewardPanel.hidden = !run.awaitingReward;
  if (!run.awaitingReward) {
    ui.rewardGrid.innerHTML = "";
    return;
  }

  const rewards = getRewardChoices(run);
  ui.rewardGrid.innerHTML = rewards
    .map(
      (reward) => `
        <button class="reward-card" data-reward-id="${reward.id}">
          <strong>${reward.title}</strong>
          <p>${reward.text}</p>
          <div class="reward-tags">${reward.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}</div>
        </button>`,
    )
    .join("");

  ui.rewardGrid.querySelectorAll("[data-reward-id]").forEach((button) => {
    button.addEventListener("click", () => selectReward(button.dataset.rewardId));
  });
}

function renderLogs() {
  ui.logList.innerHTML = state.run.logs.map((entry) => `<li>${entry}</li>`).join("");
}

function renderGameOver() {
  const { run } = state;
  ui.gameOverTitle.textContent = run.victory ? "You won the ten-minute war." : "The clock claimed you.";
  ui.gameOverText.textContent = run.victory
    ? "The Last Thing shattered before the final grain of time disappeared."
    : run.gameOverReason || "You were overwhelmed before the final boss fell.";
  ui.summaryLevel.textContent = String(run.level);
  ui.summaryTurns.textContent = String(run.turnsTaken);
  ui.summaryBosses.textContent = String(run.bossesDefeated);
  ui.summaryPowers.textContent = String(run.chosenPowers.length);
}

function addLog(text) {
  state.run.logs.unshift(text);
  state.run.logs = state.run.logs.slice(0, MAX_LOGS);
}

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function encounterTitle(run) {
  if (run.finalBossSpawned) return "Final Boss: The Last Thing";
  if (run.level % 10 === 0) return "Boss floor";
  if (run.level % 5 === 0) return "Mini-boss floor";
  return `Wave ${run.wave} · Level ${run.level}`;
}

function getThreat(level, finalBoss) {
  if (finalBoss) return "Final Boss";
  if (level % 10 === 0) return "Boss";
  if (level % 5 === 0) return "Mini-boss";
  return "Skirmish";
}

function spawnEncounter() {
  const run = state.run;
  if (!run || run.gameOver) return;

  const finalBoss = run.timerRemaining <= 0 || run.finalBossSpawned;
  run.finalBossSpawned = finalBoss;
  run.threat = getThreat(run.level, finalBoss);
  run.awaitingReward = false;

  if (finalBoss) {
    run.enemies = [createEnemy(run, "finalBoss")];
    addLog("<strong>The timer hits zero.</strong> The Last Thing arrives.");
  } else if (run.level % 10 === 0) {
    run.enemies = [createEnemy(run, "boss")];
    addLog(`<strong>Boss floor.</strong> ${run.enemies[0].name} blocks your path.`);
  } else if (run.level % 5 === 0) {
    run.enemies = [createEnemy(run, "miniBoss"), createEnemy(run, "normal", 0.9)];
    addLog(`<strong>Mini-boss floor.</strong> ${run.enemies[0].name} leads the ambush.`);
  } else {
    const count = Math.min(4, 1 + Math.floor((run.level + 1) / 2));
    run.enemies = Array.from({ length: count }, (_, index) => createEnemy(run, "normal", 1 + index * 0.08));
    addLog(`<strong>Wave ${run.wave} begins.</strong> ${count} enemies close in.`);
  }

  saveState();
}

function createEnemy(run, kind, scaleBonus = 1) {
  const tier = 1 + run.level * 0.18;
  const base = {
    normal: { health: 16, damage: 6, defense: 1, label: "Foe" },
    miniBoss: { health: 48, damage: 10, defense: 3, label: "Mini-boss" },
    boss: { health: 78, damage: 13, defense: 4, label: "Boss" },
    finalBoss: { health: 138, damage: 16, defense: 5, label: "Final Boss" },
  }[kind];

  return {
    id: run.nextEnemyId++,
    kind,
    name: randomFrom(enemyNames[kind]),
    health: Math.round(base.health * tier * scaleBonus),
    maxHealth: Math.round(base.health * tier * scaleBonus),
    damage: Math.round(base.damage * (1 + run.level * 0.12) * scaleBonus),
    defense: Math.max(0, Math.round(base.defense + run.level * 0.08)),
    dotBurn: 0,
    label: base.label,
  };
}

function handleEnemyTap(enemyId) {
  const run = state.run;
  if (!run || run.awaitingReward || run.gameOver) return;
  const enemy = run.enemies.find((entry) => entry.id === enemyId && entry.health > 0);
  if (!enemy) return;

  playerAttack(enemy);

  if (checkEncounterResolved()) return;

  run.turnsTaken += 1;
  saveState();
  renderGame();

  window.setTimeout(() => {
    enemyTurn();
    if (!run.gameOver && !run.awaitingReward) {
      renderGame();
      saveState();
    }
  }, TURN_DELAY);
}

function playerAttack(enemy) {
  const run = state.run;
  const strikes = Math.random() < run.player.multiHitChance ? 2 : 1;
  for (let hit = 0; hit < strikes; hit += 1) {
    if (enemy.health <= 0) break;
    const damage = Math.max(1, run.player.damage - enemy.defense);
    enemy.health -= damage;
    addLog(`<strong>You strike ${enemy.name}.</strong> ${damage} damage dealt.`);

    if (run.player.splash > 0) {
      const others = run.enemies.filter((entry) => entry.id !== enemy.id && entry.health > 0);
      if (others.length) {
        const splashTarget = randomFrom(others);
        const splashDamage = Math.max(1, Math.floor(damage * run.player.splash));
        splashTarget.health -= splashDamage;
        addLog(`${splashTarget.name} takes ${splashDamage} splash damage.`);
      }
    }

    if (Math.random() < run.player.burnChance && enemy.health > 0) {
      enemy.dotBurn += run.player.burnDamage;
      addLog(`${enemy.name} ignites for ${run.player.burnDamage} burn.`);
    }

    if (strikes === 2 && hit === 0) {
      addLog("<strong>Combo!</strong> You lunge again before the enemy turn.");
    }
  }

  cleanupEnemies();
}

function enemyTurn() {
  const run = state.run;
  if (!run || run.gameOver) return;

  applyDots();
  cleanupEnemies();
  if (checkEncounterResolved()) return;

  let totalDamage = 0;
  run.enemies.forEach((enemy) => {
    if (enemy.health <= 0) return;
    const hit = Math.max(1, enemy.damage - run.player.defense);
    totalDamage += hit;
    addLog(`<strong>${enemy.name}</strong> hits you for ${hit}.`);

    if (run.player.thorns > 0) {
      enemy.health -= run.player.thorns;
      addLog(`${enemy.name} takes ${run.player.thorns} thorns damage.`);
    }
  });

  run.player.health -= totalDamage;
  cleanupEnemies();

  if (run.player.health <= 0) {
    finishRun(false, "Your health hit zero before the run could end in victory.");
    return;
  }

  checkEncounterResolved();
}

function applyDots() {
  state.run.enemies.forEach((enemy) => {
    if (enemy.health > 0 && enemy.dotBurn > 0) {
      enemy.health -= enemy.dotBurn;
      addLog(`${enemy.name} burns for ${enemy.dotBurn}.`);
    }
  });
}

function cleanupEnemies() {
  state.run.enemies.forEach((enemy) => {
    if (enemy.health < 0) enemy.health = 0;
  });
}

function checkEncounterResolved() {
  const run = state.run;
  const living = run.enemies.filter((enemy) => enemy.health > 0);
  if (living.length) return false;

  if (run.finalBossSpawned) {
    finishRun(true);
    return true;
  }

  if (run.threat === "Boss" || run.threat === "Mini-boss") {
    run.bossesDefeated += 1;
  }

  run.awaitingReward = true;
  run.pendingRewards = pickRewards(run);
  addLog("<strong>Victory.</strong> Choose one power-up before the next wave.");
  renderGame();
  saveState();
  return true;
}

function pickRewards(run) {
  const excluded = new Set();
  const rewards = [];
  while (rewards.length < 3) {
    const reward = randomFrom(rewardPool);
    if (excluded.has(reward.id)) continue;
    excluded.add(reward.id);
    rewards.push(reward);
  }
  return rewards;
}

function getRewardChoices(run) {
  if (!run.pendingRewards) {
    run.pendingRewards = pickRewards(run);
  }
  return run.pendingRewards;
}

function selectReward(rewardId) {
  const run = state.run;
  const reward = getRewardChoices(run).find((entry) => entry.id === rewardId);
  if (!reward) return;

  reward.apply(run);
  run.chosenPowers.push(reward.id);
  run.awaitingReward = false;
  run.pendingRewards = null;
  run.level += 1;
  run.wave += 1;
  addLog(`<strong>Power gained:</strong> ${reward.title}.`);

  if (run.player.health <= 0) {
    finishRun(false, "A desperate power-up bought no survival.");
    return;
  }

  spawnEncounter();
  renderGame();
  saveState();
}

function finishRun(victory, reason = "") {
  const run = state.run;
  run.active = false;
  run.gameOver = true;
  run.victory = victory;
  run.gameOverReason = reason;
  run.awaitingReward = false;
  run.pendingRewards = null;
  if (victory) {
    addLog("<strong>The Last Thing falls.</strong> You outlasted the ten-minute curse.");
  }
  saveState();
  showScreen("gameOver");
  renderGameOver();
}

function tick(timestamp) {
  if (!lastFrame) lastFrame = timestamp;
  const delta = timestamp - lastFrame;
  lastFrame = timestamp;

  if (state.run && state.screen === "game" && state.run.active && !state.run.gameOver && !state.run.finalBossSpawned) {
    state.run.timerRemaining = Math.max(0, state.run.timerRemaining - delta * state.run.timerRate);
    ui.timer.textContent = formatTime(state.run.timerRemaining);

    const currentSecond = Math.ceil(state.run.timerRemaining / 1000);
    if (currentSecond !== lastSavedSecond) {
      lastSavedSecond = currentSecond;
      saveState();
    }

    if (state.run.timerRemaining <= 0) {
      state.run.timerRemaining = 0;
      state.run.level = Math.max(state.run.level, 1);
      state.run.wave += 1;
      state.run.finalBossSpawned = true;
      state.run.awaitingReward = false;
      state.run.pendingRewards = null;
      spawnEncounter();
      renderGame();
    }
  }

  rafId = window.requestAnimationFrame(tick);
}

function formatTime(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.max(0, Math.floor(totalSeconds / 60));
  const seconds = Math.max(0, totalSeconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

ui.startBtn.addEventListener("click", startRun);
ui.resumeBtn.addEventListener("click", resumeRun);
ui.restartBtn.addEventListener("click", startRun);
ui.titleBtn.addEventListener("click", () => {
  showScreen("title");
  syncTitleButtons();
});
ui.menuBtn.addEventListener("click", abandonToTitle);
ui.wipeBtn.addEventListener("click", () => {
  clearState();
  showScreen("title");
  syncTitleButtons();
});

document.addEventListener("visibilitychange", () => {
  lastFrame = 0;
  saveState();
});

if (state.run && !state.run.enemies?.length && !state.run.gameOver) {
  spawnEncounter();
}

showScreen(state.screen || "title");
render();
rafId = window.requestAnimationFrame(tick);

window.addEventListener("beforeunload", () => {
  if (rafId) window.cancelAnimationFrame(rafId);
  saveState();
});

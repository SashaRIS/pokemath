const POKE_COUNT = 20;
const MAX_RESULT = 20;
const STORAGE_KEY = "pokemon_math_progress_v1";
const ERROR_SOUND_URL = "https://actions.google.com/sounds/v1/alarms/beep_short.ogg";
const UKRAINIAN_NAMES = {
  1: "Бульбазавр",
  2: "Айвізавр",
  3: "Венузавр",
  4: "Чармандер",
  5: "Чармелеон",
  6: "Чарізард",
  7: "Сквіртл",
  8: "Вортортл",
  9: "Бластойз",
  10: "Катерпі",
  11: "Метапод",
  12: "Баттерфрі",
  13: "Відл",
  14: "Какуна",
  15: "Бідріл",
  16: "Піджі",
  17: "Піджеотто",
  18: "Піджеот",
  19: "Раттата",
  20: "Ратікейт",
};

const ids = {
  status: document.getElementById("status"),
  progressText: document.getElementById("progressText"),
  progressBar: document.getElementById("progressBar"),
  questionBox: document.getElementById("questionBox"),
  answersGrid: document.getElementById("answersGrid"),
  revealSection: document.getElementById("revealSection"),
  revealTitle: document.getElementById("revealTitle"),
  revealImage: document.getElementById("revealImage"),
  revealHint: document.getElementById("revealHint"),
  nextBtn: document.getElementById("nextBtn"),
  resetProgressBtn: document.getElementById("resetProgressBtn"),
  collectionGrid: document.getElementById("collectionGrid"),
  victoryOverlay: document.getElementById("victoryOverlay"),
  victoryImage: document.getElementById("victoryImage"),
  playAgainBtn: document.getElementById("playAgainBtn"),
};

const state = {
  pokemons: [],
  discovered: new Set(),
  currentQuestion: null,
  ready: false,
  locked: true,
};

function getImageUrl(id) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(arr) {
  return arr[randomInt(0, arr.length - 1)];
}

function persistProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.discovered]));
}

function restoreProgress() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    parsed.forEach((id) => {
      if (Number.isInteger(id) && id >= 1 && id <= POKE_COUNT) {
        state.discovered.add(id);
      }
    });
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function clearProgress() {
  state.discovered.clear();
  persistProgress();
  renderCollection();
  updateProgress();
  hideVictory();
  ids.status.textContent = "Прогрес скинуто. Починаємо спочатку.";
  startRound();
}

function updateProgress() {
  const count = state.discovered.size;
  ids.progressText.textContent = `Відкрито ${count} / ${POKE_COUNT}`;
  ids.progressBar.style.width = `${(count / POKE_COUNT) * 100}%`;
}

function renderCollection() {
  ids.collectionGrid.innerHTML = "";
  state.pokemons.forEach((pokemon) => {
    const card = document.createElement("article");
    const unlocked = state.discovered.has(pokemon.id);
    card.className = `poke-card ${unlocked ? "" : "locked"}`.trim();

    const img = document.createElement("img");
    img.src = pokemon.image;
    img.alt = unlocked ? pokemon.name : "Невідомий покемон";

    const label = document.createElement("span");
    label.textContent = unlocked ? pokemon.ukName : "???";

    card.appendChild(img);
    card.appendChild(label);
    ids.collectionGrid.appendChild(card);
  });
}

function buildQuestion() {
  const operator = Math.random() < 0.5 ? "+" : "-";
  if (operator === "+") {
    const a = randomInt(0, MAX_RESULT);
    const b = randomInt(0, MAX_RESULT - a);
    return { a, b, operator, result: a + b };
  }
  const a = randomInt(0, MAX_RESULT);
  const b = randomInt(0, a);
  return { a, b, operator, result: a - b };
}

function buildAnswers(correct) {
  const pool = new Set([correct]);
  while (pool.size < 9) {
    pool.add(randomInt(0, MAX_RESULT));
  }
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function renderAnswers() {
  const { result } = state.currentQuestion;
  const answers = buildAnswers(result);
  ids.answersGrid.innerHTML = "";

  answers.forEach((value) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "answer-btn";
    btn.textContent = String(value);
    btn.addEventListener("click", () => onAnswer(value));
    ids.answersGrid.appendChild(btn);
  });
}

function rerollAnswersForSameQuestion() {
  renderAnswers();
}

function getUndiscoveredPokemons() {
  return state.pokemons.filter((pokemon) => !state.discovered.has(pokemon.id));
}

function hideReveal() {
  ids.revealSection.classList.add("hidden");
  ids.revealImage.src = "";
  ids.revealTitle.textContent = "";
  ids.revealHint.textContent = "";
  ids.nextBtn.disabled = true;
}

function hideVictory() {
  ids.victoryOverlay.classList.add("hidden");
  ids.playAgainBtn.classList.add("hidden");
  ids.victoryImage.src = "";
}

function lockAnswers(lock) {
  state.locked = lock;
  Array.from(ids.answersGrid.children).forEach((node) => {
    node.disabled = lock;
  });
}

function startRound() {
  hideReveal();
  hideVictory();
  if (!state.ready) return;
  if (state.discovered.size >= POKE_COUNT) {
    ids.status.textContent = "Усіх покемонів уже відкрито. Натисни «Скинути прогрес» для нової гри.";
    ids.questionBox.textContent = "Готово!";
    ids.answersGrid.innerHTML = "";
    return;
  }

  state.currentQuestion = buildQuestion();
  ids.questionBox.textContent = `${state.currentQuestion.a} ${state.currentQuestion.operator} ${state.currentQuestion.b} = ?`;
  ids.status.textContent = "Обери правильну відповідь.";
  renderAnswers();
  lockAnswers(false);
}

function speakWithBrowser(text) {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) {
      resolve(false);
      return;
    }
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "uk-UA";
    utterance.rate = 0.95;
    utterance.pitch = 1.1;
    utterance.addEventListener("end", () => finish(true), { once: true });
    utterance.addEventListener("error", () => finish(false), { once: true });
    const timer = setTimeout(() => {
      window.speechSynthesis.cancel();
      finish(false);
    }, 1800);
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } catch {
      finish(false);
    }
  });
}

async function playPokemonName(pokemon) {
  const spoken = pokemon.ukName || pokemon.name;
  if (spoken) {
    await speakWithBrowser(spoken);
  }
}

function playErrorSound() {
  const audio = new Audio(ERROR_SOUND_URL);
  audio.volume = 0.45;
  audio.play().catch(() => {});
}

async function revealPokemon() {
  const unseen = getUndiscoveredPokemons();
  if (unseen.length === 0) {
    return;
  }
  const pokemon = pickRandom(unseen);
  state.discovered.add(pokemon.id);
  persistProgress();
  updateProgress();
  renderCollection();

  ids.revealSection.classList.remove("hidden");
  ids.revealTitle.textContent = `${pokemon.ukName} відкрито!`;
  ids.revealImage.src = pokemon.image;
  ids.revealHint.textContent = "Слухай українську назву покемона...";
  ids.nextBtn.disabled = false;

  if (state.discovered.size === POKE_COUNT) {
    showVictory(pokemon);
    return;
  }

  playPokemonName(pokemon).finally(() => {
    if (!ids.revealSection.classList.contains("hidden")) {
      ids.revealHint.textContent = "Готово! Натисни «Далі».";
    }
  });
}

async function showVictory(pokemon) {
  ids.victoryImage.src = pokemon.image;
  ids.victoryOverlay.classList.remove("hidden");
  ids.playAgainBtn.classList.add("hidden");
  ids.status.textContent = "Мета виконана! Ти відкрив усіх покемонів.";
  ids.answersGrid.innerHTML = "";
  ids.questionBox.textContent = "Перемога!";

  await playPokemonName(pokemon);

  ids.playAgainBtn.classList.remove("hidden");
}

function onAnswer(value) {
  if (!state.ready || state.locked || !state.currentQuestion) {
    return;
  }
  const correct = state.currentQuestion.result;
  if (value === correct) {
    lockAnswers(true);
    ids.status.textContent = "Правильно! Відкриваю покемона...";
    ids.answersGrid.innerHTML = "";
    revealPokemon();
    return;
  }
  ids.status.textContent = "Неправильно. Спробуй ще.";
  playErrorSound();
  rerollAnswersForSameQuestion();
}

async function loadPokemons() {
  return Array.from({ length: POKE_COUNT }, (_, i) => {
    const id = i + 1;
    const ukName = UKRAINIAN_NAMES[id] || `Покемон ${id}`;
    return {
      id,
      name: ukName,
      ukName,
      image: getImageUrl(id),
    };
  });
}

async function init() {
  ids.resetProgressBtn.addEventListener("click", clearProgress);
  ids.nextBtn.addEventListener("click", startRound);
  ids.playAgainBtn.addEventListener("click", clearProgress);

  restoreProgress();
  updateProgress();

  state.pokemons = await loadPokemons();
  state.ready = true;
  renderCollection();
  startRound();
}

init();

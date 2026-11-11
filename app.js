// ============================================================
// Veryra — website version (works with Supabase for sign-in + saving)
// ============================================================
// >>> PASTE YOUR TWO DETAILS BETWEEN THE QUOTES BELOW <<<
// 1) Your Supabase Project URL      (looks like https://xxxxx.supabase.co)
// 2) Your Supabase Publishable key  (starts with sb_publishable_ )
// Do NOT paste the secret key / service_role key anywhere in this file.
const SUPABASE_URL = "https://iagkqmmxkxrfbhplerkb.supabase.co/rest/v1/";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_2b3g8Q_5GhW9qbs5SuiFPw_clNNnsGN";
// ============================================================

const $ = (id) => document.getElementById(id);
const configured =
  SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("PASTE") &&
  SUPABASE_PUBLISHABLE_KEY.length > 10 && !SUPABASE_PUBLISHABLE_KEY.includes("PASTE");

let sb = null;
if (configured && window.supabase) {
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
} else {
  $("configWarning").classList.remove("hidden");
}

let currentUser = null;
let selectedCategory = "other";
let selectedMood = null;

const CATEGORY_EMOJI = { jumps: "🦘", turns: "🌀", flexibility: "🌸", strength: "💪", choreography: "🎶", other: "✨" };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtDate = (d) => (d ? new Date(d + "T12:00:00").toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "");

// ---------- AUTH ----------
async function refreshSession() {
  if (!sb) { $("authSection").classList.remove("hidden"); return; }
  const { data } = await sb.auth.getSession();
  currentUser = data.session ? data.session.user : null;
  renderAuthState();
}
function renderAuthState() {
  const loggedIn = !!currentUser;
  $("authSection").classList.toggle("hidden", loggedIn);
  $("appSection").classList.toggle("hidden", !loggedIn);
  $("userBar").classList.toggle("hidden", !loggedIn);
  if (loggedIn) {
    $("userEmail").textContent = currentUser.email;
    loadGoals(); loadCoachHistory(); loadCheckins();
  }
}
async function signIn() {
  if (!sb) return;
  $("authMessage").textContent = "Signing you in...";
  const { error } = await sb.auth.signInWithPassword({
    email: $("authEmail").value.trim(), password: $("authPassword").value,
  });
  $("authMessage").textContent = error ? error.message : "";
  refreshSession();
}
async function signUp() {
  if (!sb) return;
  $("authMessage").textContent = "Creating your account...";
  const { data, error } = await sb.auth.signUp({
    email: $("authEmail").value.trim(), password: $("authPassword").value,
  });
  if (error) { $("authMessage").textContent = error.message; return; }
  $("authMessage").textContent = data.session
    ? "Account created — you are signed in!"
    : "Account created! Check your email and click the confirm link, then sign in here.";
  refreshSession();
}
async function signOut() { if (sb) { await sb.auth.signOut(); refreshSession(); } }

// ---------- TABS ----------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b === btn));
    ["goals", "coach", "mindset"].forEach((t) => $("tab-" + t).classList.toggle("hidden", t !== btn.dataset.tab));
  });
});
document.querySelectorAll("#categoryChips .chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    document.querySelectorAll("#categoryChips .chip").forEach((c) => c.classList.remove("selected"));
    chip.classList.add("selected");
    selectedCategory = chip.dataset.cat;
  });
});

// ---------- GOALS ----------
async function loadGoals() {
  if (!sb || !currentUser) return;
  const { data: goals, error } = await sb.from("goals")
    .select("*").order("created_at", { ascending: false });
  if (error) { $("goalsList").innerHTML = `<p class="message">${esc(error.message)}</p>`; return; }
  const { data: entries } = await sb.from("progress_entries")
    .select("*").order("entry_date", { ascending: false });
  const byGoal = {};
  (entries || []).forEach((e) => { (byGoal[e.goal_id] = byGoal[e.goal_id] || []).push(e); });

  $("growingCount").textContent = `🌱 Growing: ${goals.filter((g) => !g.achieved).length}`;
  $("achievedCount").textContent = `🏆 Achieved: ${goals.filter((g) => g.achieved).length}`;

  if (!goals.length) {
    $("goalsList").innerHTML = `<div class="card"><p class="sub">No goals yet — dream up your first one above! 💭</p></div>`;
    return;
  }
  $("goalsList").innerHTML = goals.map((g) => `
    <div class="card goal-card">
      <div class="goal-top">
        <div style="display:flex;gap:10px;align-items:center">
          <span class="badge">${CATEGORY_EMOJI[g.category] || "✨"}</span>
          <div>
            <strong style="font-size:18px">${esc(g.title)}</strong>
            <div class="sub" style="margin:2px 0 0">${g.target_date ? "🎯 Target: " + fmtDate(g.target_date) : "No target date"}${g.note ? " · " + esc(g.note) : ""}</div>
          </div>
        </div>
        <span class="status-pill ${g.achieved ? "achieved" : ""}">${g.achieved ? "🏆 Achieved!" : "🌱 Growing"}</span>
      </div>
      <div class="goal-actions">
        <button class="btn small" onclick="toggleAchieved('${g.id}', ${!g.achieved})">${g.achieved ? "Back to growing" : "🏆 Mark achieved"}</button>
        <button class="btn small ghost" onclick="deleteGoal('${g.id}')">Delete</button>
      </div>
      <div class="progress-box">
        <strong>📈 Progress check-ins</strong>
        <ul class="timeline">
          ${(byGoal[g.id] || []).map((e) => `<li><strong>${fmtDate(e.entry_date)}</strong> <span class="stars">${"★".repeat(e.stars || 0)}${"☆".repeat(5 - (e.stars || 0))}</span>${e.note ? " — " + esc(e.note) : ""}</li>`).join("") || "<li class='sub'>No check-ins yet — add your first below.</li>"}
        </ul>
        <div class="row wrap">
          <label>Stars 1–5 <input id="stars-${g.id}" class="star-num" type="number" min="1" max="5" value="4"></label>
          <label class="grow">Note <input id="pnote-${g.id}" type="text" placeholder="How did practice go?"></label>
          <button class="btn small primary" onclick="addProgress('${g.id}')">Add check-in</button>
        </div>
      </div>
    </div>`).join("");
}
async function addGoal() {
  const title = $("goalTitle").value.trim();
  if (!title) { $("goalMessage").textContent = "Give your goal a name first 💭"; return; }
  const { error } = await sb.from("goals").insert({
    user_id: currentUser.id, title, category: selectedCategory,
    target_date: $("goalDate").value || null, note: $("goalNote").value.trim() || null,
  });
  $("goalMessage").textContent = error ? error.message : "Goal added! 🌱";
  if (!error) { $("goalTitle").value = ""; $("goalNote").value = ""; $("goalDate").value = ""; loadGoals(); }
}
async function toggleAchieved(id, achieved) { await sb.from("goals").update({ achieved }).eq("id", id); loadGoals(); }
async function deleteGoal(id) { if (confirm("Delete this goal and its check-ins?")) { await sb.from("goals").delete().eq("id", id); loadGoals(); } }
async function addProgress(goalId) {
  const stars = Math.min(5, Math.max(1, parseInt($("stars-" + goalId).value, 10) || 4));
  const { error } = await sb.from("progress_entries").insert({
    goal_id: goalId, user_id: currentUser.id, stars,
    note: $("pnote-" + goalId).value.trim() || null,
  });
  if (!error) loadGoals();
}

// ---------- COACH ----------
const yt = (q) => "https://www.youtube.com/results?search_query=" + encodeURIComponent(q);
const COACH_TOPICS = [
  { keys: ["pirouette", "turn", "falling out", "spin"], title: "Steadier pirouettes",
    summary: "Falling out of pirouettes is usually a prep and spot problem, not a strength problem. Small fixes add up fast.",
    steps: ["Prep from a strong plié with your weight fully over the supporting leg before you turn.", "Find a fixed spot at eye level; snap your head around and find it again each turn.", "Keep ribs down and shoulders over hips — leaning back pulls you off balance.", "Relevé high and pull up through the supporting leg like a string from the top of your head.", "Finish every attempt in a clean position, even a wobbly one — train the ending, not the fall."],
    drills: ["Quarter turns with a hold: prep, turn 90°, freeze 3 seconds. Build to half, then full turns.", "Spotting drill: 8 slow relevés facing a sticker on the wall, snapping your head back to it.", "10 clean single pirouettes at 80% power before trying any doubles."],
    links: [["Pirouette technique tutorial (YouTube search)", yt("how to do a clean pirouette ballet tutorial")], ["Fixing pirouette balance (YouTube search)", yt("stop falling out of pirouettes tips")]] },
  { keys: ["jete", "jeté", "jump", "leap", "grand"], title: "Higher grand jetés",
    summary: "Big leaps come from the plié and the brush, not from throwing yourself into the air.",
    steps: ["Use a deep, honest plié in the step before — that is your spring.", "Brush the front leg hard along the floor so it throws you up and forward.", "Split the legs fast at the top; think front leg up, back leg reaching behind.", "Keep your chest lifted and arms in a clean line — don't fold forward.", "Land toe-ball-heel into plié so the next step can flow."],
    drills: ["10 small sautés focusing on a fast plié and a tall relevé finish.", "Brush jumps at the barre: tendu brush to a small jump, 8 each side.", "Practice the run + plié + brush without the full leap until timing feels easy."],
    links: [["Grand jeté tutorial (YouTube search)", yt("grand jete tutorial ballet leap technique")], ["Jump higher for dancers (YouTube search)", yt("how to jump higher dance leaps exercises")]] },
  { keys: ["split", "flexib", "stretch", "tight"], title: "Getting your splits safely",
    summary: "Splits come from daily gentle work, never from forcing. Warm muscles stretch further and stay safer.",
    steps: ["Always warm up first — 5 minutes of movement before any deep stretch.", "Start in a low lunge, hips square and low, hold 30 seconds each side.", "Slide forward only to a strong stretch, never pain; breathe out and relax into it.", "Use blocks or pillows under your hands or hips for support as you lower.", "Stretch a little every day rather than one huge session once a week."],
    drills: ["Lunge series: low lunge, hamstring fold, repeat 3 rounds each side.", "Wall splits for control without sliding too far.", "End with gentle hamstring and hip-flexor stretches, 30 seconds each."],
    links: [["Splits flexibility routine (YouTube search)", yt("how to get splits flexibility routine dancers")], ["Safe stretching for dancers (YouTube search)", yt("safe stretching routine dancers flexibility")]] },
  { keys: ["balance", "wobbl", "ankle", "releve", "relevé"], title: "Better balance",
    summary: "Balance is a skill you train in tiny daily doses — ankles, core, and focus together.",
    steps: ["Press all four corners of your standing foot into the floor.", "Engage your core gently like you're zipping up tight jeans.", "Fix your eyes on one still point — a wandering gaze makes a wandering balance.", "Breathe out slowly; holding your breath makes you tense and wobble.", "Come down with control instead of falling out — endings build strength."],
    drills: ["Relevé holds: 10 seconds, building to 30, each leg, daily.", "Passé balances at the barre, then letting go for 3 seconds at a time.", "Single-leg balances while brushing your teeth — sneaky daily practice."],
    links: [["Balance exercises for dancers (YouTube search)", yt("balance exercises dancers ankle strength")]] },
  { keys: ["choreo", "forget", "remember", "memory", "routine"], title: "Remembering choreography",
    summary: "Nobody remembers a whole routine at once — dancers chunk it, mark it, and build it layer by layer.",
    steps: ["Break the routine into small chunks of 4–8 counts and learn one chunk at a time.", "Say the counts and names out loud while you mark it with your hands.", "Connect each chunk to a picture or story in your head ('reach for the sun, melt down').", "Practise the transitions between chunks — that's where forgetting usually happens.", "Run it once slowly before bed; sleep helps lock movement memory in."],
    drills: ["Mark the full routine 3 times small, then once full out.", "Teach one chunk to an imaginary student — teaching makes it stick.", "Film yourself; watching once shows you the gaps instantly."],
    links: [["How to learn choreography faster (YouTube search)", yt("how to learn choreography fast memorize dance")]] },
  { keys: ["beginner", "start", "new to", "first class", "never danced"], title: "Starting out as a beginner",
    summary: "Every dancer you admire was a beginner who felt lost in class. Starting is the bravest step and you already took it.",
    steps: ["Pick one style you love watching and start there — fun keeps you going.", "In class, stand where you can see the teacher clearly and copy big shapes first, details later.", "Ask one question per class; teachers expect beginner questions.", "Practise 10 minutes at home between classes — short and often beats long and rare.", "Compare yourself only to last week's you."],
    drills: ["Learn 3 basics well: plié, tendu, relevé (or your style's equivalents).", "Follow one beginner follow-along video twice a week.", "Keep a tiny dance notebook: one new word or step per class."],
    links: [["Absolute beginner dance class (YouTube search)", yt("absolute beginner dance tutorial follow along")]] },
  { keys: ["strong", "strength", "core", "weak", "conditioning"], title: "Building dancer strength",
    summary: "Short, regular conditioning supports everything in class — jumps get higher and balances get steadier.",
    steps: ["Train little and often: 10–15 minutes, 3 times a week beats one huge session.", "Focus on calves (relevés), core (planks), and glutes (bridges) — a dancer's big three.", "Use slow, controlled reps; flailing fast reps don't build useful strength.", "Rest days matter: muscles get stronger between workouts, not during.", "Stop any exercise that causes sharp pain and ask a teacher or professional."],
    drills: ["Relevé series: 16 slow, 16 pulses, both legs then single legs.", "Plank circuit: 30 seconds front, 20 seconds each side, 3 rounds.", "Glute bridges: 12 reps with a 3-second hold at the top."],
    links: [["Dancer conditioning workout (YouTube search)", yt("dancer strength conditioning workout follow along")]] },
  { keys: ["confiden", "nervous", "scared", "compare", "bad class", "give up", "mindset"], title: "Confidence and tough days",
    summary: "Confidence in dance is built, not born — it grows from tiny proof that you showed up and improved by 1%.",
    steps: ["Keep a 'proof list' in your phone: skills that were hard and are now easier.", "Set one tiny goal per class (just one!) so every class ends with a win.", "Compare to your past self only — other dancers' journeys are different choreography.", "On a bad day, do the Mindset check-in here and use the breathing reset.", "Remember: teachers correct dancers they believe in. Corrections are investment, not criticism."],
    drills: ["Before class, say one affirmation from the Mindset tab out loud.", "After class, write one thing that improved, however small.", "Once a month, re-read your goal timeline and see how far you've come. 🌱"],
    links: [["Dancer mindset and confidence (YouTube search)", yt("dance confidence mindset tips for dancers")]] },
];
const COACH_DEFAULT = {
  title: "Let's work on it",
  summary: "Great question. Here is a safe, general way to approach it — and a teacher who can see you in person can refine it further.",
  steps: ["Warm up well first — cold muscles don't learn or stretch safely.", "Break the skill into its smallest piece and practise that piece slowly.", "Watch one tutorial below all the way through, then copy it piece by piece.", "Film yourself once and compare — small adjustments beat big guessing.", "Repeat short practices on several days; dancers improve by layering, not cramming."],
  drills: ["5 minutes of the basic version of the skill, slowly, with full attention.", "3 rounds: slow, medium, then full speed, keeping the same good form."],
  links: [["Dance tutorials on YouTube (search)", yt("dance technique tutorial")]],
};
function coachAnswer(q) {
  const text = q.toLowerCase();
  const topic = COACH_TOPICS.find((t) => t.keys.some((k) => text.includes(k)));
  return topic || COACH_DEFAULT;
}
function openCoachModal(html) { $("coachModalContent").innerHTML = html; $("coachModal").classList.remove("hidden"); }
function answerHtml(a, q) {
  return `<h3>${esc(a.title)}</h3><p><em>${esc(q)}</em></p><p>${esc(a.summary)}</p>
    <h4>Steps</h4><ol>${a.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
    <h4>Try this drill</h4><ul>${a.drills.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
    <h4>Watch & learn</h4><ul>${a.links.map(([label, url]) => `<li><a href="${url}" target="_blank" rel="noopener">${esc(label)}</a></li>`).join("")}</ul>`;
}
async function askCoach() {
  const q = $("coachQuestion").value.trim();
  if (!q) return;
  openCoachModal(`<div class="thinking">💭 Your coach is thinking...</div>`);
  const a = coachAnswer(q);
  const fullText = a.summary + "\n\nSteps:\n" + a.steps.map((s, i) => `${i + 1}. ${s}`).join("\n") +
    "\n\nDrills:\n" + a.drills.join("\n") + "\n\nLinks:\n" + a.links.map(([l, u]) => `${l}: ${u}`).join("\n");
  setTimeout(async () => {
    openCoachModal(answerHtml(a, q));
    if (sb && currentUser) {
      await sb.from("coach_chats").insert({ user_id: currentUser.id, question: q, answer: fullText });
      loadCoachHistory();
    }
    $("coachQuestion").value = "";
  }, 700);
}
async function loadCoachHistory() {
  if (!sb || !currentUser) return;
  const { data } = await sb.from("coach_chats").select("*").order("created_at", { ascending: false }).limit(20);
  $("coachHistory").innerHTML = (data || []).map((c) => `
    <div class="card coach-row"><span>${esc(c.question)}</span>
    <button class="btn small" onclick="reopenCoach('${c.id}')">See the answer</button></div>`).join("")
    || `<p class="sub">No questions yet — ask your first one above!</p>`;
  window._coachRows = data || [];
}
function reopenCoach(id) {
  const c = (window._coachRows || []).find((r) => r.id === id);
  if (c) openCoachModal(`<h3>Coach answer</h3><p><em>${esc(c.question)}</em></p><p style="white-space:pre-line">${esc(c.answer || "")}</p>`);
}

// ---------- MINDSET ----------
const AFFIRMATIONS = [
  "I am a dancer who is growing — every class, every try counts. 🌱",
  "Progress, not perfection. Small steps are still steps. ✨",
  "My body learns at its own pace, and that pace is okay. 💛",
  "I can be a beginner at something and still belong here.",
  "Corrections help me grow. They mean my teacher believes in me.",
  "One hard class does not define my whole dance journey.",
  "I showed up today, and showing up is powerful. 💪",
];
function showAffirmation() {
  const day = Math.floor(Date.now() / 86400000);
  $("affirmation").textContent = AFFIRMATIONS[day % AFFIRMATIONS.length];
}
document.querySelectorAll("#moodChips .chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    document.querySelectorAll("#moodChips .chip").forEach((c) => c.classList.remove("selected"));
    chip.classList.add("selected");
    selectedMood = chip.dataset.mood;
  });
});
document.querySelectorAll(".acc-head").forEach((head) => {
  head.addEventListener("click", () => {
    const target = $("acc-" + head.dataset.acc);
    const willOpen = target.classList.contains("hidden");
    ["checkin", "tools", "history"].forEach((k) => $("acc-" + k).classList.add("hidden"));
    if (willOpen) target.classList.remove("hidden");
  });
});
async function saveCheckin() {
  if (!selectedMood) { $("checkinMessage").textContent = "Pick a mood first 💛"; return; }
  const { error } = await sb.from("checkins").insert({
    user_id: currentUser.id, mood: selectedMood, note: $("checkinNote").value.trim() || null,
  });
  $("checkinMessage").textContent = error ? error.message : "Saved 💛";
  if (!error) { $("checkinNote").value = ""; loadCheckins(); }
}
async function loadCheckins() {
  if (!sb || !currentUser) return;
  const { data } = await sb.from("checkins").select("*").order("entry_date", { ascending: false }).limit(30);
  $("checkinHistory").innerHTML = (data || []).map((c) => `
    <div class="checkin-row" style="padding:8px 0;border-bottom:1px dashed var(--line)">
      <span><strong>${fmtDate(c.entry_date)}</strong> — ${esc(c.mood || "")}${c.note ? " · " + esc(c.note) : ""}</span>
      <button class="del" onclick="deleteCheckin('${c.id}')">✕</button>
    </div>`).join("") || `<p class="sub">No check-ins yet.</p>`;
}
async function deleteCheckin(id) { await sb.from("checkins").delete().eq("id", id); loadCheckins(); }

// Breathing reset: in 4s, hold 4s, out 4s — about 60 seconds total
let breathTimer = null;
function toggleBreathing() {
  const circle = $("breathCircle"), btn = $("breathBtn");
  if (breathTimer) {
    clearInterval(breathTimer); breathTimer = null;
    circle.classList.remove("in"); circle.textContent = "Ready"; btn.textContent = "Start breathing reset";
    return;
  }
  btn.textContent = "Stop";
  const phases = [["Breathe in", true], ["Hold", true], ["Breathe out", false], ["Hold", false]];
  let i = 0, rounds = 0;
  const step = () => {
    const [label, isIn] = phases[i % phases.length];
    circle.textContent = label;
    circle.classList.toggle("in", isIn);
    if (i % phases.length === 0) { rounds++; if (rounds > 5) { toggleBreathing(); circle.textContent = "Done 💛"; return; } }
    i++;
  };
  step();
  breathTimer = setInterval(step, 4000);
}

// ---------- WIRING ----------
$("signInBtn").addEventListener("click", signIn);
$("signUpBtn").addEventListener("click", signUp);
$("signOutBtn").addEventListener("click", signOut);
$("addGoalBtn").addEventListener("click", addGoal);
$("askCoachBtn").addEventListener("click", askCoach);
document.querySelectorAll(".coach-chip").forEach((chip) =>
  chip.addEventListener("click", () => { $("coachQuestion").value = chip.textContent.trim(); askCoach(); }));
$("saveCheckinBtn").addEventListener("click", saveCheckin);
$("breathBtn").addEventListener("click", toggleBreathing);
$("coachModalClose").addEventListener("click", () => $("coachModal").classList.add("hidden"));
$("coachModal").addEventListener("click", (e) => { if (e.target === $("coachModal")) $("coachModal").classList.add("hidden"); });
$("privacyLink").addEventListener("click", (e) => { e.preventDefault(); $("privacyModal").classList.remove("hidden"); });
$("privacyModalClose").addEventListener("click", () => $("privacyModal").classList.add("hidden"));
$("privacyModal").addEventListener("click", (e) => { if (e.target === $("privacyModal")) $("privacyModal").classList.add("hidden"); });
if (sb) sb.auth.onAuthStateChange(() => refreshSession());
showAffirmation();
refreshSession();

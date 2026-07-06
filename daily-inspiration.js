const inspirations = [
  {
    text: "Indeed, with hardship comes ease.",
    source: "Qur’an 94:6"
  },
  {
    text: "And whoever relies upon Allah — then He is sufficient for him.",
    source: "Qur’an 65:3"
  },
  {
    text: "Indeed, Allah is with the patient.",
    source: "Qur’an 2:153"
  },
  {
    text: "Speak good, and you will be known by it.",
    source: "Imam Ali (a)"
  },
  {
    text: "The best worship is patience.",
    source: "Imam Ali (a)"
  }
];

function getDailyInspiration() {
  const today = new Date();
  const dayNumber = Math.floor(today.getTime() / 86400000);
  return inspirations[dayNumber % inspirations.length];
}

const card = document.getElementById("dailyInspirationCard");

if (card) {
  const item = getDailyInspiration();

  card.innerHTML = `
    <h2>🌙 Daily Reminder</h2>
    <p class="daily-quote">“${item.text}”</p>
    <p class="daily-source">${item.source}</p>
  `;
}
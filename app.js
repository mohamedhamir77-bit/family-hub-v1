import {
  addPointsTransaction,
  watchPoints,
  deletePointsTransaction,
  hidePointsTransaction
} from "./points.js";
import { watchMembers, addMember, deleteMember } from "./members.js";
import { watchNodes, addNode, deleteNode, updateNode } from "./nodes.js";
import { addActivity, watchActivity, deleteActivity } from "./activity.js";
import { testWorkspaceModule, nodeIcon } from "./workspace.js";
import { showAddDialog } from "./dialogs.js";
import { renderBreadcrumbs } from "./breadcrumbs.js";
testWorkspaceModule();

const $ = id => document.getElementById(id);

let members = [];
let nodes = [];
let selectedMemberId = null;
let currentParentId = null;
let selectedNode = null;
let selectedDashboardFilter = null;
let calendarDate = new Date();
let parentMode = false;
let activities = [];
let pointTransactions = [];
let nodesLoaded = false;
let pointsLoaded = false;
let missedTasksProcessed = false;
let prayerTimes = {};

const PRAYER_POINTS = {
  withinHour: 10,
  withinTwoHours: 5,
  completed: 2
};

let appVersion = "";
const parentPin = "1234";
const CALENDAR_COLOURS = [
  "purple",
  "blue",
  "green",
  "orange",
  "red",
  "pink",
  "teal"
];
function calendarIconFromName(name) {
  const text = name.toLowerCase();

  if (
    text.includes("hujjat") ||
    text.includes("mosque") ||
    text.includes("masjid") ||
    text.includes("majlis")
  ) {
    return "🕌";
  }

  if (text.includes("school")) return "🏫";

  if (
    text.includes("football") ||
    text.includes("soccer")
  ) {
    return "⚽";
  }

  if (text.includes("birthday")) return "🎂";
  if (text.includes("work")) return "💼";
  if (text.includes("medical") || text.includes("hospital")) return "🏥";
  if (text.includes("holiday")) return "✈️";

  return "📅";
}
function nextCalendarColour() {
  const usedColours = externalCalendars.map(
    calendar => calendar.color
  );

  return (
    CALENDAR_COLOURS.find(
      colour => !usedColours.includes(colour)
    ) ||
    CALENDAR_COLOURS[
      externalCalendars.length % CALENDAR_COLOURS.length
    ]
  );
}

function pointsFromCurrentWeek() {
  const now = new Date();

  const startOfWeek = new Date(now);
  const day = startOfWeek.getDay();

  const daysSinceMonday =
    day === 0 ? 6 : day - 1;

  startOfWeek.setDate(
    startOfWeek.getDate() - daysSinceMonday
  );

  startOfWeek.setHours(0, 0, 0, 0);

  return pointTransactions.filter(transaction => {
    const relevantDate =
      transaction.occurrenceDate ||
      transaction.createdAt;

    if (!relevantDate) return false;

    const transactionDate =
      relevantDate.includes("T")
        ? new Date(relevantDate)
        : new Date(`${relevantDate}T00:00:00`);

    return transactionDate >= startOfWeek;
  });
}

function updateDashboard() {
  const today = new Date().toISOString().split("T")[0];

  const overdue = nodes.filter(n =>
    n.type === "task" &&
    !n.done &&
    n.dueDate &&
    n.dueDate < today
  ).length;

  const dueToday = nodes.filter(n =>
    n.type === "task" &&
    !n.done &&
    n.dueDate === today
  ).length;

  const upcoming = nodes.filter(n =>
    n.type === "task" &&
    !n.done &&
    n.dueDate &&
    n.dueDate > today
  ).length;

  const completed = nodes.filter(n =>
    n.type === "task" &&
    n.done
  ).length;

  $("overdueCount").textContent = overdue;
  $("todayCount").textContent = dueToday;
  $("upcomingCount").textContent = upcoming;
  $("completedCount").textContent = completed;
}

function currentMember() {
  return members.find(member => member.id === selectedMemberId);
}
function renderPrayerTracker() {
  const member = currentMember();
  const memberText = $("prayerMemberText");
  const progressText = $("prayerProgressText");
  const checkboxes = document.querySelectorAll("[data-prayer]");

  if (!member) {
    memberText.textContent = "Select a family member";

    checkboxes.forEach(checkbox => {
      checkbox.checked = false;
      checkbox.disabled = true;
    });

    progressText.textContent = "0 of 5 completed";
    return;
  }

  memberText.textContent =
    `${member.emoji || "👤"} ${member.name}`;

  const today = formatDateLocal(new Date());
  const storageKey = `prayers-${member.id}-${today}`;

  const savedPrayers = JSON.parse(
    localStorage.getItem(storageKey) || "{}"
  );

  checkboxes.forEach(checkbox => {
    const prayer = checkbox.dataset.prayer;

    checkbox.disabled = false;
    checkbox.checked = savedPrayers[prayer] === true;

    checkbox.onchange = async () => {
  const wasChecked = savedPrayers[prayer];

  savedPrayers[prayer] = checkbox.checked;

  localStorage.setItem(
    storageKey,
    JSON.stringify(savedPrayers)
  );

  // Prayer has just been ticked
  if (!wasChecked && checkbox.checked) {
    await awardPrayerPoints(prayer);
  }

  // Prayer has just been unticked
  if (wasChecked && !checkbox.checked) {
    await removePrayerPoints(prayer);
  }

  updatePrayerProgress();
};

 function updatePrayerProgress() {
  const completed = Array.from(checkboxes).filter(
    checkbox => checkbox.checked
  ).length;

  progressText.textContent =
    `${completed} of 5 completed`;
}

updatePrayerProgress();
});

function updatePrayerProgress() {
  const completed = Array.from(checkboxes).filter(
    checkbox => checkbox.checked
  ).length;

  progressText.textContent =
    `${completed} of 5 completed`;
}

updatePrayerProgress();

}

async function awardPrayerPoints(prayer) {
  if (!prayerTimes[prayer]) return;

  const memberId = selectedMemberId;
  if (!memberId) return;

  const today = formatDateLocal(new Date());

  const alreadyAwarded = pointTransactions.some(transaction =>
    transaction.type === "prayer-on-time" &&
    transaction.memberId === memberId &&
    transaction.title?.toLowerCase() === prayer.toLowerCase() &&
    transaction.occurrenceDate === today
  );

  if (alreadyAwarded) return;

  const [hour, minute] = prayerTimes[prayer]
    .slice(0, 5)
    .split(":")
    .map(Number);

  const prayerTime = new Date();
  prayerTime.setHours(hour, minute, 0, 0);

  const now = new Date();

  // Fajr gives zero points after sunrise
  if (prayer === "fajr" && prayerTimes.sunrise) {
    const [sunriseHour, sunriseMinute] =
      prayerTimes.sunrise
        .slice(0, 5)
        .split(":")
        .map(Number);

    const sunriseTime = new Date();

    sunriseTime.setHours(
      sunriseHour,
      sunriseMinute,
      0,
      0
    );

    if (now >= sunriseTime) {
      return;
    }
  }

  // Dhuhr and Asr give zero points after Maghrib
  if (
    (prayer === "dhuhr" || prayer === "asr") &&
    prayerTimes.maghrib
  ) {
    const [maghribHour, maghribMinute] =
      prayerTimes.maghrib
        .slice(0, 5)
        .split(":")
        .map(Number);

    const maghribTime = new Date();

    maghribTime.setHours(
      maghribHour,
      maghribMinute,
      0,
      0
    );

    if (now >= maghribTime) {
      return;
    }
  }

  const diffMinutes =
    (now - prayerTime) / 60000;

  if (diffMinutes < 0) {
    return;
  }

  let amount = PRAYER_POINTS.completed;

  if (diffMinutes <= 60) {
    amount = PRAYER_POINTS.withinHour;
  } else if (diffMinutes <= 120) {
    amount = PRAYER_POINTS.withinTwoHours;
  }

  const prayerName =
    prayer.charAt(0).toUpperCase() +
    prayer.slice(1);

  await addPointsTransaction({
    memberId,
    amount,
    type: "prayer-on-time",
    title: prayerName,
    reason: `${prayerName} prayer completed`,
    occurrenceDate: today,
    displayOnMemberCard: true
  });
}
async function removePrayerPoints(prayer) {
  const memberId = selectedMemberId;
  if (!memberId) return;

  const today = formatDateLocal(new Date());

  const transaction = pointTransactions.find(item =>
    item.type === "prayer-on-time" &&
    item.memberId === memberId &&
    item.title?.toLowerCase() === prayer.toLowerCase() &&
    item.occurrenceDate === today
  );

  if (!transaction) return;

  await deletePointsTransaction(transaction.id);
}
async function loadPrayerTimes() {
  console.log("Loading prayer times...");

  const locationText = $("prayerLocationText");
  const dateText = $("prayerDateText");

  const city =
    localStorage.getItem("prayerCity") || "Harrow";

  const country =
    localStorage.getItem("prayerCountry") ||
    "United Kingdom";

  try {
    const url =
      "https://api.aladhan.com/v1/timingsByCity" +
      `?city=${encodeURIComponent(city)}` +
      `&country=${encodeURIComponent(country)}` +
      "&method=0";

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("Prayer times could not be loaded");
    }

    const result = await response.json();

    if (!result.data?.timings) {
      throw new Error("No prayer times were returned");
    }

    const timings = result.data.timings;

    prayerTimes = {
  fajr: timings.Fajr,
  sunrise: timings.Sunrise,
  dhuhr: timings.Dhuhr,
  asr: timings.Dhuhr,
  maghrib: timings.Maghrib,
  isha: timings.Maghrib
};

    const prayers = [
  ["Fajr", timings.Fajr],
  ["Dhuhr / Asr", timings.Dhuhr],
  ["Maghrib / Isha", timings.Maghrib]
];

    function updateNextPrayer() {
      const now = new Date();
      let nextPrayerName = "";
      let nextPrayerTime = null;

      for (const [name, time] of prayers) {
        const cleanTime = time.slice(0, 5);
        const [hours, minutes] =
          cleanTime.split(":").map(Number);

        const prayerDate = new Date();
        prayerDate.setHours(hours, minutes, 0, 0);

        if (prayerDate > now) {
          nextPrayerName = name;
          nextPrayerTime = prayerDate;
          break;
        }
      }

      // After Isha, show tomorrow's Fajr
      if (!nextPrayerTime) {
        const fajrTime = prayers[0][1].slice(0, 5);

        const [hours, minutes] =
          fajrTime.split(":").map(Number);

        nextPrayerName = "Fajr";
        nextPrayerTime = new Date();

        nextPrayerTime.setDate(
          nextPrayerTime.getDate() + 1
        );

        nextPrayerTime.setHours(
          hours,
          minutes,
          0,
          0
        );
      }

      const difference = nextPrayerTime - now;

      const hoursLeft = Math.floor(
        difference / 3600000
      );

      const minutesLeft = Math.floor(
        (difference % 3600000) / 60000
      );

      $("nextPrayerName").textContent =
        nextPrayerName;

      $("nextPrayerCountdown").textContent =
        `in ${hoursLeft}h ${minutesLeft}m`;
    }

    updateNextPrayer();

    document
      .querySelectorAll("[data-prayer]")
      .forEach(checkbox => {
        const prayer = checkbox.dataset.prayer;
        const row = checkbox.closest(".prayer-row");
        const timeText = row.querySelector("strong");

        timeText.textContent =
          prayerTimes[prayer]?.slice(0, 5) ||
          "--:--";
      });

    const sunriseElement = $("sunriseTime");

    if (sunriseElement) {
      sunriseElement.textContent =
        timings.Sunrise?.slice(0, 5) ||
        "--:--";
    }

    locationText.textContent =
      `${city}, ${country}`;

    dateText.textContent =
      new Date().toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      });
  } catch (error) {
    console.error(
      "Prayer time error:",
      error
    );

    dateText.textContent =
      `Prayer times unavailable: ${error.message}`;
  }
}
async function checkForNewVersion() {
  try {
    const response = await fetch(
      `version.json?t=${Date.now()}`,
      { cache: "no-store" }
    );

    const data = await response.json();

    const latestVersion = data.version;



    const storedVersion =
      localStorage.getItem("familyHubVersion");

    if (!storedVersion) {
      localStorage.setItem(
        "familyHubVersion",
        latestVersion
      );
      appVersion = latestVersion;
      return;
    }

    if (storedVersion !== latestVersion) {
      const updateNow = confirm(
        `🚀 Family Hub ${latestVersion} is available.\n\nReload now to update?`
      );

      if (updateNow) {
        localStorage.setItem(
          "familyHubVersion",
          latestVersion
        );

        const cleanUrl =
  `${window.location.origin}${window.location.pathname}`;

window.location.replace(
  `${cleanUrl}?update=${Date.now()}`
);
      }
    }

    appVersion = latestVersion;

  } catch (error) {
    console.error("Version check failed", error);
  }
}

// checkForNewVersion();

// Check again every 5 minutes
// setInterval(checkForNewVersion, 5 * 60 * 1000);
loadPrayerTimes();
const prayerLocationDialog =
  $("prayerLocationDialog");

const changePrayerLocationBtn =
  $("changePrayerLocationBtn");

const closePrayerLocationDialogBtn =
  $("closePrayerLocationDialogBtn");

const cancelPrayerLocationBtn =
  $("cancelPrayerLocationBtn");

const prayerLocationSearch =
  $("prayerLocationSearch");

const prayerLocationResults =
  $("prayerLocationResults");

const prayerLocationSearchStatus =
  $("prayerLocationSearchStatus");

const savePrayerLocationBtn =
  $("savePrayerLocationBtn");

function closePrayerLocationDialog() {
  prayerLocationDialog.close();

  prayerLocationSearch.value = "";
  prayerLocationResults.innerHTML = "";

  prayerLocationSearchStatus.textContent =
    "Enter at least 3 letters.";

  savePrayerLocationBtn.disabled = true;
}

changePrayerLocationBtn.onclick = () => {
  prayerLocationDialog.showModal();

  setTimeout(() => {
    prayerLocationSearch.focus();
  }, 100);
};

closePrayerLocationDialogBtn.onclick =
  closePrayerLocationDialog;

cancelPrayerLocationBtn.onclick =
  closePrayerLocationDialog;

prayerLocationDialog.onclick = event => {
  if (event.target === prayerLocationDialog) {
    closePrayerLocationDialog();
  }
};
let selectedPrayerLocation = null;
let prayerLocationSearchTimer = null;

prayerLocationSearch.oninput = () => {
  clearTimeout(prayerLocationSearchTimer);

  const query =
    prayerLocationSearch.value.trim();

  selectedPrayerLocation = null;
  savePrayerLocationBtn.disabled = true;
  prayerLocationResults.innerHTML = "";

  if (query.length < 3) {
    prayerLocationSearchStatus.textContent =
      "Enter at least 3 letters.";
    return;
  }

  prayerLocationSearchStatus.textContent =
    "Searching...";

  prayerLocationSearchTimer = setTimeout(async () => {
    try {
      const url =
        "https://nominatim.openstreetmap.org/search" +
        `?format=jsonv2` +
        `&q=${encodeURIComponent(query)}` +
        `&addressdetails=1` +
        `&limit=5`;

      const response = await fetch(url, {
        headers: {
          "Accept-Language": "en"
        }
      });

      if (!response.ok) {
        throw new Error("Location search failed");
      }

      const results = await response.json();

      if (!results.length) {
        prayerLocationSearchStatus.textContent =
          "No matching locations found.";
        return;
      }

      prayerLocationSearchStatus.textContent =
        "Select the correct location.";

      prayerLocationResults.innerHTML =
        results.map((result, index) => {
          const address = result.address || {};

          const city =
            address.city ||
            address.town ||
            address.village ||
            address.municipality ||
            result.name ||
            query;

          const country =
            address.country || "";

          return `
            <button
              type="button"
              class="prayer-location-result"
              data-location-index="${index}"
            >
              <strong>📍 ${city}</strong>
              <span>${result.display_name}</span>
            </button>
          `;
        }).join("");

      document
        .querySelectorAll("[data-location-index]")
        .forEach(button => {
          button.onclick = () => {
            document
              .querySelectorAll(".prayer-location-result")
              .forEach(item => {
                item.classList.remove("selected");
              });

            button.classList.add("selected");

            const result =
              results[Number(button.dataset.locationIndex)];

            const address = result.address || {};

            selectedPrayerLocation = {
              city:
                address.city ||
                address.town ||
                address.village ||
                address.municipality ||
                result.name ||
                query,

              country:
                address.country || "",

              latitude:
                Number(result.lat),

              longitude:
                Number(result.lon),

              displayName:
                result.display_name
            };

            savePrayerLocationBtn.disabled = false;
          };
        });
    } catch (error) {
      console.error(
        "Location search error:",
        error
      );

      prayerLocationSearchStatus.textContent =
        "Could not search for locations.";
    }
  }, 500);
};
savePrayerLocationBtn.onclick = async () => {
  if (!selectedPrayerLocation) return;

  localStorage.setItem(
    "prayerCity",
    selectedPrayerLocation.city
  );

  localStorage.setItem(
    "prayerCountry",
    selectedPrayerLocation.country
  );

  localStorage.setItem(
    "prayerLatitude",
    String(selectedPrayerLocation.latitude)
  );

  localStorage.setItem(
    "prayerLongitude",
    String(selectedPrayerLocation.longitude)
  );

  closePrayerLocationDialog();
  await loadPrayerTimes();
};




function sharedProgress(node) {
  const participants = effectiveParticipantIds(node);

  const completed = participants.filter(
    memberId => node.completedBy?.[memberId] === true
  ).length;

  return {
    completed,
    total: participants.length
  };
}
function sharedParticipantIds(node) {
  if (!node.sharedEnabled) {
    return [node.memberId];
  }
  
  return [
    ...new Set([
      node.memberId,
      ...(node.participantIds || [])
    ])
  ];
}
function rotatingParticipantIds(node) {
  const pool = Array.isArray(node.rotationMembers)
    ? node.rotationMembers.filter(memberId =>
        members.some(member => member.id === memberId)
      )
    : [];

  if (!node.rotationEnabled || !pool.length) {
    return sharedParticipantIds(node).filter(memberId =>
      members.some(member => member.id === memberId)
    );
  }

  const requestedCount =
    Number(node.participantsPerOccurrence) || 1;

  const count = Math.min(
    Math.max(1, requestedCount),
    pool.length
  );

  const today = formatDateLocal(new Date());

  let storedParticipants = [];

  if (
    Array.isArray(node.nextActiveParticipantIds) &&
    node.nextActiveParticipantIds.length &&
    node.dueDate &&
    node.dueDate <= today
  ) {
    storedParticipants =
      node.nextActiveParticipantIds;
  } else if (
    Array.isArray(node.activeParticipantIds) &&
    node.activeParticipantIds.length
  ) {
    storedParticipants =
      node.activeParticipantIds;
  }

  const validStoredParticipants = [
    ...new Set(
      storedParticipants.filter(memberId =>
        pool.includes(memberId) &&
        members.some(member => member.id === memberId)
      )
    )
  ];

  if (validStoredParticipants.length >= count) {
    return validStoredParticipants.slice(0, count);
  }

  const startIndex = Number.isInteger(node.rotationIndex)
    ? node.rotationIndex
    : 0;

  const participants = [
    ...validStoredParticipants
  ];

  let offset = 0;

  while (
    participants.length < count &&
    offset < pool.length
  ) {
    const memberId =
      pool[(startIndex + offset) % pool.length];

    if (!participants.includes(memberId)) {
      participants.push(memberId);
    }

    offset++;
  }

  return participants;
}
function nextRotatingParticipantIds(node, completedBy) {
  const pool = Array.isArray(node.rotationMembers)
    ? node.rotationMembers
    : [];

  const currentParticipants =
    rotatingParticipantIds(node);

  const incompleteParticipants =
    currentParticipants.filter(memberId => {
      const effectiveId =
        node.temporarySwaps?.[memberId] || memberId;

      return completedBy?.[effectiveId] !== true;
    });

  const requiredCount =
    Math.min(
      Number(node.participantsPerOccurrence) || 1,
      pool.length
    );

  const nextParticipants = [
    ...incompleteParticipants
  ];

  const lastCurrentParticipant =
    currentParticipants[currentParticipants.length - 1];

  let nextIndex =
    pool.indexOf(lastCurrentParticipant) + 1;

  while (
    nextParticipants.length < requiredCount &&
    pool.length
  ) {
    const candidate =
      pool[nextIndex % pool.length];

    if (!nextParticipants.includes(candidate)) {
      nextParticipants.push(candidate);
    }

    nextIndex++;
  }

  return nextParticipants;
}
function effectiveParticipantIds(node) {
  const originalIds =
  node.rotationEnabled
    ? rotatingParticipantIds(node)
    : sharedParticipantIds(node);
  const swaps = node.temporarySwaps || {};

  return originalIds.map(memberId =>
    swaps[memberId] || memberId
  );
}
function participantDisplay(node) {
  if (!node || node.type !== "task") {
    const member = members.find(
      item => item.id === node?.memberId
    );

    return member
      ? `${member.emoji || "👤"} ${member.name}`
      : "Unassigned";
  }

  const participantIds =
    node.sharedEnabled || node.rotationEnabled
      ? effectiveParticipantIds(node)
      : [node.memberId].filter(Boolean);

  const participantNames = participantIds
    .map(memberId => {
      const member = members.find(
        item => item.id === memberId
      );

      return member
        ? `${member.emoji || "👤"} ${member.name}`
        : null;
    })
    .filter(Boolean);

  return participantNames.length
    ? participantNames.join(" + ")
    : "Unassigned";
}
function visibleNodes() {
  return nodes.filter(node => {
    let belongsToMember;

    if (
      node.type === "task" &&
      node.opportunityTaskEnabled
    ) {
      belongsToMember = true;
    } else if (
      node.type === "task" &&
      node.rotationEnabled &&
      node.sharedEnabled
    ) {
      belongsToMember =
        effectiveParticipantIds(node).includes(selectedMemberId);
    } else if (
      node.type === "task" &&
      node.sharedEnabled
    ) {
      belongsToMember =
        effectiveParticipantIds(node).includes(selectedMemberId);
    } else {
      belongsToMember =
        node.memberId === selectedMemberId;
    }

    return (
      belongsToMember &&
      (node.parentId || null) === (currentParentId || null)
    );
  });
}

function renderMembers() {
  const list = $("membersList");

  if (!members.length) {
    list.innerHTML = `<p class="empty">No members yet.</p>`;
    return;
  }

  const totals = {};

pointsFromCurrentWeek().forEach(transaction => {
  const amount = Number(transaction.amount) || 0;

  totals[transaction.memberId] =
    (totals[transaction.memberId] || 0) + amount;
});

const rankedMembers = [...members]
  .map(member => ({
    ...member,
    totalPoints: totals[member.id] || 0
  }))
  .sort((a, b) => b.totalPoints - a.totalPoints);

list.innerHTML = members.map(member => {
  const position =
    rankedMembers.findIndex(
      rankedMember => rankedMember.id === member.id
    ) + 1;

  const totalPoints = totals[member.id] || 0;
  const visibleAdjustments = pointsFromCurrentWeek()
  .filter(transaction =>
  transaction.memberId === member.id &&
  transaction.displayOnMemberCard !== false
)
  .slice(0, 3);

  return `
    <div class="card member-card" data-member-id="${member.id}">
      <div class="member-info">
        <span class="avatar">${member.emoji || "👤"}</span>
        <div>
          <strong>${member.name}</strong>
          <small>${member.role || "member"}</small>
          <div class="meta-row">
  <span class="badge">
    🏆 Position ${position}
  </span>

  <span class="badge">
    ⭐ ${totalPoints} points
  </span>
</div>
${
  visibleAdjustments.length
    ? `
      <div class="member-activity">
        ${visibleAdjustments.map(transaction => `
          <div class="member-activity-item">
  <span>
    ${transaction.amount > 0 ? "+" : "-"}${Math.abs(transaction.amount)} ⭐
    ${transaction.reason}
  </span>

  ${
    parentMode
      ? `
        ${
  parentMode && transaction.displayOnMemberCard !== false
    ? `
      <button
        type="button"
        class="member-activity-delete"
        data-hide-adjustment="${transaction.id}">
        ×
      </button>
    `
    : ""
}
      `
      : ""
  }
</div>
        `).join("")}
      </div>
    `
    : ""
}
        </div>
      </div>
      <button class="danger" data-delete="${member.id}">Delete</button>
    </div>
  `;
}).join("");

  document.querySelectorAll(".member-card").forEach(card => {
    card.onclick = event => {
      if (event.target.tagName === "BUTTON") return;
      selectedMemberId = card.dataset.memberId;
currentParentId = null;
renderWorkspace();
renderPrayerTracker();
    };
  });

  document.querySelectorAll("[data-delete]").forEach(button => {
    button.onclick = async event => {
  event.stopPropagation();

  if (!parentMode) {
    alert("Only a parent can delete members.");
    return;
  }

  const memberItems = nodes.filter(
    node => node.memberId === button.dataset.delete
  );

  if (memberItems.length > 0) {
    alert(
      "This member still has tasks, folders, notes or events. Delete or move them first."
    );
    return;
  }

  if (confirm("Delete this member?")) {
    await deleteMember(button.dataset.delete);
  }
};
  });
document
  .querySelectorAll("[data-hide-adjustment]")
  .forEach(button => {
    button.onclick = async event => {
      event.stopPropagation();

      if (!confirm("Remove this message?")) return;

      await hidePointsTransaction(
        button.dataset.hideAdjustment
      );
    };
  });
}


function renderWorkspace() {
  const member = currentMember();

  if (!member) {
  $("workspaceTitle").textContent = "";
  $("folderList").innerHTML = "";
  $("workspacePanel").classList.add("hidden");
  return;
}

  $("workspacePanel").dataset.memberId = member.id;
  $("workspaceTitle").textContent = `${member.emoji || "👤"} ${member.name}`;
  $("workspacePanel").classList.remove("hidden");
  renderBreadcrumbs({
  nodes,
  currentParentId,
  goHome: () => {
    currentParentId = null;
    renderWorkspace();
  },
  goToNode: nodeId => {
    currentParentId = nodeId;
    renderWorkspace();
  }
});
  $("workspacePanel").scrollIntoView({ behavior: "smooth" });

  const list = $("folderList");
  const items = visibleNodes();

  if (!items.length) {
    list.innerHTML = `<p class="empty">Nothing here yet.</p>`;
    return;
  }

  list.innerHTML = items.map(node => `
    <div class="card member-card" data-node-id="${node.id}">
      <div class="member-info">
        <span class="avatar">
  ${
    node.type === "folder"
      ? "📁"
      : node.type === "event"
      ? "📅"
      : node.type === "note"
      ? "📝"
      : node.type === "checklist"
      ? "☑"
      : "✅"
  }
</span>
        <div>
          <strong>
  ${
    node.opportunityTaskEnabled
      ? "⭐ "
      : ""
  }${node.title}
</strong>

${
  node.notes
    ? `<p class="task-notes">${node.notes}</p>`
    : ""
}

<div class="meta-row">
  <span class="badge">
  ${
    node.opportunityTaskEnabled
      ? "⭐ Bonus"
      : node.type
  }
</span>
  ${node.done ? `<span class="badge done">✅ Done</span>` : ""}
  ${
  node.type === "task" &&
  (node.sharedEnabled || node.rotationEnabled)
    ? `
      <span class="badge">
        👥 Currently due: ${participantDisplay(node)}
      </span>
    `
    : ""
}
  ${
  node.opportunityTaskEnabled &&
  node.awardedToMemberId
    ? (() => {
        const winner = members.find(
          m => m.id === node.awardedToMemberId
        );

        return `
          <span class="badge">
            🏆 ${
              winner
                ? `${winner.emoji || "👤"} ${winner.name}`
                : "Awarded"
            }
          </span>
        `;
      })()
    : ""
}
  ${node.dueDate ? `<span class="badge date">📅 ${node.dueDate}</span>` : ""}
  ${node.priority ? `<span class="badge priority-${node.priority}">${node.priority}</span>` : ""}
  ${
  node.type === "task"
    ? `<span class="badge">⭐ ${node.points ?? 1} points</span>`
    : ""
}
  ${node.dueDate ? `<span class="badge date">📅 ${node.dueDate}</span>` : ""}
${node.priority ? `<span class="badge priority-${node.priority}">${node.priority}</span>` : ""}
  ${
  node.sharedEnabled
    ? (() => {
        const progress = sharedProgress(node);

        return `
          <span class="badge">
            👥 ${progress.completed}/${progress.total} complete
          </span>
        `;
      })()
    : ""
}
</div>
${
  node.sharedEnabled
    ? `
      <div class="shared-progress-list">
        ${(
  node.rotationEnabled
    ? rotatingParticipantIds(node)
    : sharedParticipantIds(node)
)
  .map(memberId => {
            const effectiveId =
  node.temporarySwaps?.[memberId] || memberId;

const member = members.find(item => item.id === effectiveId);

const originalMember = members.find(
  item => item.id === memberId
);

const completed =
  node.completedBy?.[effectiveId] === true;

            return `
              <span class="shared-person">
  ${completed ? "✅" : "⬜"}
  ${member?.emoji || "👤"} ${member?.name || "Unknown"}
${
  effectiveId !== memberId
    ? ` <small>(covering ${originalMember?.name || "someone"})</small>`
    : ""
}

  ${
  parentMode && !completed
    ? `
      <button
        type="button"
        class="ghost shared-swap-button"
        data-swap-participant-task="${node.id}"
        data-original-participant="${memberId}">
        ⇄
      </button>
    `
    : ""
}
</span>
            `;
          })
          .join("")}
      </div>
    `
    : ""
}
        </div>
      </div>
      <div class="workspace-buttons">
  <label class="complete-checkbox">
  <input
    type="checkbox"
    data-complete-node="${node.id}"
    ${
      node.opportunityTaskEnabled
  ? (
      node.done
        ? "checked disabled"
        : currentMember()?.role === "parent"
        ? ""
        : "disabled"
    )
  : node.sharedEnabled
  ? node.completedBy?.[selectedMemberId]
    ? "checked disabled"
    : ""
  : node.done
  ? "checked disabled"
  : ""
    }
  >
  <span>
  ${
    node.opportunityTaskEnabled
      ? (
          currentMember()?.role === "parent"
            ? "Complete and claim bonus"
            : "Waiting for parent to award"
        )
      : node.sharedEnabled
      ? node.completedBy?.[selectedMemberId]
        ? "Your part completed"
        : "Complete your part"
      : "Complete"
  }
</span>
</label>
  ${
  node.sharedEnabled
    ? ""
    : `
      <button
        type="button"
        class="ghost"
        data-swap-node="${node.id}">
        ⇄ Swap
      </button>
    `
}
${
  node.opportunityTaskEnabled && parentMode && !node.done
    ? `
      <button
        type="button"
        class="ghost"
        data-award-bonus-task="${node.id}">
        ⭐ Award bonus
      </button>
    `
    : ""
}
  <button
    class="danger"
    data-delete-node="${node.id}">
    Delete
  </button>
</div>
    </div>
  `).join("");

document.querySelectorAll("[data-node-id]").forEach(card => {
  card.onclick = event => {
    if (event.target.tagName === "BUTTON") return;

    selectedNode = nodes.find(node => node.id === card.dataset.nodeId);

    $("detailsTitle").value = selectedNode.title || "";
    $("detailsNotes").value = selectedNode.notes || "";
    $("detailsType").value = selectedNode.type || "";
    $("detailsDone").checked = selectedNode.done === true;
    $("detailsDueDate").value = selectedNode.dueDate || "";
    $("detailsEndDate").value = selectedNode.endDate || "";
    $("detailsPriority").value = selectedNode.priority || "";
    $("detailsPoints").value = selectedNode.points ?? 1;
    $("detailsRepeat").value = selectedNode.repeat || "none";
    $("detailsRepeatUntil").value = selectedNode.repeatUntil || "";

$("detailsRotationEnabled").checked =
  selectedNode.rotationEnabled === true;

renderRotationMembers(selectedNode.rotationMembers || []);
$("detailsParticipantsPerOccurrence").value =
  selectedNode.participantsPerOccurrence || 1;
  updateAssignmentControls();
$("detailsSharedEnabled").checked =
  selectedNode.sharedEnabled === true;

if (selectedNode.opportunityTaskEnabled) {
  $("detailsAssignmentType").value = "opportunity";
} else if (selectedNode.rotationEnabled) {
  $("detailsAssignmentType").value = "rotating";
} else if (selectedNode.sharedEnabled) {
  $("detailsAssignmentType").value = "shared";
} else {
  $("detailsAssignmentType").value = "assigned";
}

renderSharedParticipants(selectedNode.participantIds || []);

    $("detailsPanel").classList.remove("hidden");
    $("detailsPanel").scrollIntoView({ behavior: "smooth" });
    if (selectedNode.type === "folder") {
      currentParentId = selectedNode.id;
      renderWorkspace();
    }
  };
});
document.querySelectorAll("[data-complete-node]").forEach(checkbox => {
  checkbox.onchange = async event => {
    event.stopPropagation();

    const node = nodes.find(n => n.id === checkbox.dataset.completeNode);
    if (!node) return;

    await completeNodeFromList(node);
  };
});
document
  .querySelectorAll("[data-swap-participant-task]")
  .forEach(button => {
    button.onclick = async event => {
      event.stopPropagation();

      const node = nodes.find(
        item => item.id === button.dataset.swapParticipantTask
      );

      if (!node) return;

      await swapSharedParticipant(
        node,
        button.dataset.originalParticipant
      );
    };
  });
document.querySelectorAll("[data-swap-node]").forEach(button => {
  button.onclick = async event => {
    event.stopPropagation();

    const node = nodes.find(
      item => item.id === button.dataset.swapNode
    );

    if (!node) return;

    await swapTaskOwner(node);
  };
});
document
  .querySelectorAll("[data-award-bonus-task]")
  .forEach(button => {
    button.onclick = async event => {
      event.stopPropagation();

      const node = nodes.find(
        item => item.id === button.dataset.awardBonusTask
      );

      if (!node) return;

      await awardBonusTask(node);
    };
  });
  document.querySelectorAll("[data-delete-node]").forEach(button => {
    button.onclick = async event => {
  event.stopPropagation();

  if (!parentMode) {
    alert("Only a parent can delete items.");
    return;
  }

  if (confirm("Delete this item?")) {
    await deleteNode(button.dataset.deleteNode);
  }
};
  });
}

$("backToMembers").onclick = () => {
  if (currentParentId) {
    const current = nodes.find(node => node.id === currentParentId);
    currentParentId = current?.parentId || null;
    renderWorkspace();
    return;
  }

  $("workspacePanel").classList.add("hidden");
};

$("addItemBtn").onclick = async () => {

  selectedNode = null;
  $("detailsPanel").classList.add("hidden");

  if (!parentMode) {
    alert("Only a parent can add items.");
    return;
  }

  if (!selectedMemberId) {
    alert("Select a member first");
    return;
  }

  const result = await showAddDialog();
  if (!result) return;

  await addNode({
  title: result.title,
  type: result.type,
  notes: "",
  points: 0,
  endDate: "",
  sharedEnabled: false,
  opportunityTaskEnabled: false,
  participantIds: [],
  temporarySwaps: {},
  completedBy: {},
  memberId: selectedMemberId,
  parentId: currentParentId,

  repeat: "none",
  repeatUntil: "",
  rotationEnabled: false,
rotationMembers: [],
rotationIndex: 0,
participantsPerOccurrence: 1
});
selectedNode = null;
$("detailsPanel").classList.add("hidden");
}; 

$("memberForm").onsubmit = async event => {
  event.preventDefault();

  if (!parentMode) {
    alert("Only a parent can add members.");
    return;
  }

  await addMember({
    name: $("memberName").value,
    emoji: $("memberEmoji").value,
    role: $("memberRole").value
  });

  $("memberForm").reset();
  $("memberEmoji").value = "👤";
};
$("saveDetailsBtn").onclick = async () => {
  if (!selectedNode) return;
  const latestNode = nodes.find(
  node => node.id === selectedNode.id
);

if (!latestNode) {
  alert("This task no longer exists. Please refresh and open it again.");
  selectedNode = null;
  $("detailsPanel").classList.add("hidden");
  return;
}

selectedNode = latestNode;
  if (!parentMode) {
  alert("Only a parent can edit items.");
  return;
}

  let newDueDate = $("detailsDueDate").value;
let newDone = $("detailsDone").checked;
const rotationMembers = Array.from(
  document.querySelectorAll("#rotationMembersList input:checked")
).map(input => input.value);
const participantIds = Array.from(
  document.querySelectorAll("#sharedParticipantsList input:checked")
).map(input => input.value);
const participantsPerOccurrence = Math.min(
  rotationMembers.length || 1,
  Math.max(
    1,
    Number($("detailsParticipantsPerOccurrence").value) || 1
  )
);
const rotationEnabled =
  $("detailsRotationEnabled").checked;

const sharedEnabled =
  rotationEnabled ||
  $("detailsSharedEnabled").checked;
  const opportunityTaskEnabled =
  $("detailsAssignmentType").value === "opportunity";
const wasJustCompleted =
  $("detailsDone").checked === true &&
  selectedNode.done !== true;

if (wasJustCompleted) {
  const updatedNode = {
    ...selectedNode,
    title: $("detailsTitle").value.trim(),
    dueDate: $("detailsDueDate").value,
    endDate: $("detailsEndDate").value,
    notes: $("detailsNotes").value.trim(),
    priority: $("detailsPriority").value,
    points: Math.max(0, Number($("detailsPoints").value) || 0),
    repeat: $("detailsRepeat").value,
    repeatUntil: $("detailsRepeatUntil").value,
    rotationEnabled: rotationEnabled,
    rotationMembers: rotationMembers,
participantsPerOccurrence: participantsPerOccurrence,
sharedEnabled: sharedEnabled,
opportunityTaskEnabled: opportunityTaskEnabled,

participantIds: rotationEnabled
  ? []
  : participantIds,

completedBy: sharedEnabled
  ? selectedNode.completedBy || {}
  : {}
  };

  await completeTask(updatedNode, {
    source: "details"
  });

  selectedNode = null;
  $("detailsPanel").classList.add("hidden");
  return;
}
let newMemberId = selectedNode.memberId;
let newRotationIndex = selectedNode.rotationIndex || 0;

await updateNode(selectedNode.id, {
  title: $("detailsTitle").value.trim(),
  notes: $("detailsNotes").value.trim(),
  memberId: newMemberId,
  done: newDone,
  completedAt: $("detailsDone").checked
  ? selectedNode.completedAt || new Date().toISOString()
  : "",
  dueDate: newDueDate,
  endDate: $("detailsEndDate").value,
  priority: $("detailsPriority").value,
  points: Math.max(0, Number($("detailsPoints").value) || 0),
  repeat: $("detailsRepeat").value,
  repeatUntil: $("detailsRepeatUntil").value,
  rotationEnabled: rotationEnabled,
  rotationMembers: rotationMembers,
participantsPerOccurrence: participantsPerOccurrence,
sharedEnabled: sharedEnabled,
opportunityTaskEnabled: opportunityTaskEnabled,

participantIds: rotationEnabled
  ? []
  : participantIds,

completedBy: sharedEnabled
  ? selectedNode.completedBy || {}
  : {},
  rotationIndex: newRotationIndex
});

  selectedNode = null;
  $("detailsPanel").classList.add("hidden");
};
document.querySelectorAll("[data-dashboard-filter]").forEach(card => {
  card.onclick = () => {
    const filter = card.dataset.dashboardFilter;
    const results = $("dashboardResults");

    // Clicking the selected card closes it
    if (selectedDashboardFilter === filter) {
      selectedDashboardFilter = null;

      card.classList.remove("selected");
      results.classList.add("hidden");
      results.innerHTML = "";

      return;
    }

    selectedDashboardFilter = filter;

    document.querySelectorAll("[data-dashboard-filter]").forEach(otherCard => {
      otherCard.classList.remove("selected");
    });

    card.classList.add("selected");

    showDashboardResults(filter);
  };
});
watchMembers(newMembers => {
  members = newMembers;
  renderMembers();
  renderPendingMemberDropdown();
  renderPointsAdjustmentMembers();
  renderFamilyEconomy();
  $("syncStatus").textContent = "Online • synced";
});

watchNodes(async newNodes => {
  nodes = newNodes;
  nodesLoaded = true;

  await maybeProcessMissedRecurringTasks();

  if (
    selectedNode &&
    !nodes.some(node => node.id === selectedNode.id)
  ) {
    selectedNode = null;
    $("detailsPanel").classList.add("hidden");
  }

  updateDashboard();
  renderCalendar();
  updateGreeting();
  updateTodaySummary();
  renderPrayerTracker();
  updateParentDashboard();
  updateParentActivity();
  renderPendingMemberDropdown();
  renderPendingTasksForSelectedMember();
  runGlobalSearch();

  if (selectedMemberId) {
    renderWorkspace();
  }

  $("syncStatus").textContent = "Online • synced";
});
watchActivity(newActivities => {
  activities = newActivities;
  updateParentActivity();
});
watchPoints(async newTransactions => {
  pointTransactions = newTransactions;
  pointsLoaded = true;

  await maybeProcessMissedRecurringTasks();

  renderFamilyEconomy();
  renderMembers();
});
$("familyEconomyCard").onclick = () => {
  const panel = $("familyEconomyPanel");

  panel.classList.toggle("hidden");

  if (!panel.classList.contains("hidden")) {
    renderFamilyEconomy();

    panel.scrollIntoView({
      behavior: "smooth"
    });
  $("copyFamilySummaryBtn").onclick = async () => {
  const today = formatDateLocal(new Date());

  const dateText = new Date().toLocaleDateString(
    "en-GB",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    }
  );

  const totals = {};

  pointsFromCurrentWeek().forEach(transaction => {
    totals[transaction.memberId] =
      (totals[transaction.memberId] || 0) +
      (Number(transaction.amount) || 0);
  });

  const todaysTasks = nodes.filter(node =>
    node.type === "task" &&
    shouldShowTaskToday(node, today)
  );

  const todaysHubEvents = nodes.filter(node =>
    node.type === "event" &&
    occursOnDate(node, today)
  );

  const todaysExternalEvents =
    enabledExternalEvents().filter(event =>
      occursOnDate(event, today)
    );

  function peopleForItem(item) {
    let ids = [];

    if (item.sharedEnabled) {
      ids = effectiveParticipantIds(item);
    } else if (item.memberId) {
      ids = [item.memberId];
    }

    return ids
      .map(id => members.find(member => member.id === id))
      .filter(Boolean)
      .map(member =>
        `${member.emoji || "👤"} ${member.name}`
      )
      .join(", ");
  }

  let summary = `🏡 *FAMILY HUB SUMMARY*\n`;
  summary += `📅 ${dateText}\n\n`;

  // =========================
  // FAMILY HUB TASKS
  // =========================

  summary += `✅ *FAMILY HUB TASKS*\n\n`;

  members.forEach(member => {
    const memberTasks = todaysTasks.filter(task => {
      if (task.sharedEnabled) {
        return effectiveParticipantIds(task)
          .includes(member.id);
      }

      return task.memberId === member.id;
    });

    summary +=
      `${member.emoji || "👤"} *${member.name}*\n`;

    summary +=
  `⭐ Week total: ${totals[member.id] || 0} points\n`;


    if (!memberTasks.length) {
      summary += `🎉 No tasks today\n\n`;
      return;
    }

    memberTasks.forEach(task => {
      const completed = task.sharedEnabled
        ? task.completedBy?.[member.id] === true
        : task.done === true;

      const symbol = completed ? "✅" : "⬜";

      summary += `${symbol} ${task.title}`;

      if (task.points !== undefined) {
        summary += ` (+${task.points ?? 1} ⭐)`;
      }

      summary += `\n`;

      if (task.notes?.trim()) {
  const noteLines = task.notes
    .trim()
    .split(/\r?\n/)
    .map(line =>
      line
        .replace(/^>\s*/, "")
        .trim()
    )
    .filter(Boolean);

  noteLines.forEach(line => {
    summary += `   • ${line}\n`;
  });
}
    });

    summary += `\n`;
  });

  // =========================
  // FAMILY HUB EVENTS
  // =========================

  summary += `🏠 *FAMILY HUB EVENTS*\n`;

  if (!todaysHubEvents.length) {
    summary += `No Family Hub events today\n`;
  } else {
    todaysHubEvents.forEach(event => {
      summary += `📅 ${event.title}\n`;

      const people = peopleForItem(event);

      if (people) {
        summary += `   👥 ${people}\n`;
      }

      if (event.notes?.trim()) {
        summary +=
          `   💬 ${event.notes.trim()}\n`;
      }
    });
  }

  summary += `\n`;

  // =========================
  // EXTERNAL CALENDARS
  // =========================

  summary += `🌐 *EXTERNAL CALENDARS*\n`;

  if (!todaysExternalEvents.length) {
    summary += `No external calendar events today\n`;
  } else {
    const calendarGroups = new Map();

    todaysExternalEvents.forEach(event => {
      const calendarName =
        event.externalCalendarName ||
        "External calendar";

      if (!calendarGroups.has(calendarName)) {
        calendarGroups.set(calendarName, []);
      }

      calendarGroups
        .get(calendarName)
        .push(event);
    });

    calendarGroups.forEach(
      (events, calendarName) => {
        const calendarSymbol =
          events[0]?.calendarSymbol || "📅";

        summary +=
          `\n${calendarSymbol} *${calendarName}*\n`;

        events
          .sort((a, b) =>
            (a.startTime || "")
              .localeCompare(b.startTime || "")
          )
          .forEach(event => {
            if (event.startTime) {
  summary += `• ${event.startTime}`;

  if (event.endTime) {
    summary += `–${event.endTime}`;
  }

  summary += ` — ${event.title}\n`;
} else {
  summary += `• All day — ${event.title}\n`;
}

            if (event.location?.trim()) {
              summary +=
                `📍 ${event.location.trim()}\n`;
            }
          });
      }
    );
  }
// =========================
// COMING UP — 3 MONTHS
// =========================

const todayDate =
  new Date(`${today}T00:00:00`);

// 7 days from today
const next7Date =
  new Date(todayDate);

next7Date.setDate(
  next7Date.getDate() + 7
);

const next7End =
  formatDateLocal(next7Date);

// End of this month
const monthEndDate =
  new Date(
    todayDate.getFullYear(),
    todayDate.getMonth() + 1,
    0
  );

const monthEnd =
  formatDateLocal(monthEndDate);

// End of the next 2 months
// Example: September -> end of November
const threeMonthEndDate =
  new Date(
    todayDate.getFullYear(),
    todayDate.getMonth() + 3,
    0
  );

const threeMonthEnd =
  formatDateLocal(threeMonthEndDate);

// Family Hub tasks + events
const upcomingHubItems = nodes
  .filter(node =>
    (
      node.type === "task" ||
      node.type === "event"
    ) &&
    node.dueDate &&
    node.dueDate > today &&
    node.dueDate <= threeMonthEnd &&
    (
      node.type === "event" ||
      !node.done
    )
  )
  .map(node => ({
    ...node,
    upcomingSource: "hub"
  }));

// Google Family, Hujjat Live, etc.
const upcomingExternalItems =
  enabledExternalEvents()
    .filter(event =>
      event.dueDate &&
      event.dueDate > today &&
      event.dueDate <= threeMonthEnd
    )
    .map(event => ({
      ...event,
      upcomingSource: "external"
    }));

// Combine everything chronologically
const allUpcoming = [
  ...upcomingHubItems,
  ...upcomingExternalItems
].sort((a, b) => {
  const dateCompare =
    a.dueDate.localeCompare(b.dueDate);

  if (dateCompare !== 0) {
    return dateCompare;
  }

  return (a.startTime || "")
    .localeCompare(b.startTime || "");
});

// First 7 days
const next7Items = allUpcoming
  .filter(item =>
    item.dueDate <= next7End
  )
  .slice(0, 5);

// Rest of this month
const laterThisMonth = allUpcoming
  .filter(item =>
    item.dueDate > next7End &&
    item.dueDate <= monthEnd
  )
  .slice(0, 5);

// Following 2 months
const nextMonthStartDate =
  new Date(
    todayDate.getFullYear(),
    todayDate.getMonth() + 1,
    1
  );

const nextMonthEndDate =
  new Date(
    todayDate.getFullYear(),
    todayDate.getMonth() + 2,
    0
  );

const nextMonthStart =
  formatDateLocal(nextMonthStartDate);

const nextMonthEnd =
  formatDateLocal(nextMonthEndDate);

const followingMonthStartDate =
  new Date(
    todayDate.getFullYear(),
    todayDate.getMonth() + 2,
    1
  );

const followingMonthStart =
  formatDateLocal(
    followingMonthStartDate
  );

const nextMonthItems = allUpcoming
  .filter(item =>
    item.dueDate >= nextMonthStart &&
    item.dueDate <= nextMonthEnd
  )
  .slice(0, 5);

const followingMonthItems = allUpcoming
  .filter(item =>
    item.dueDate >= followingMonthStart &&
    item.dueDate <= threeMonthEnd
  )
  .slice(0, 5);
  function addComingUpItem(item) {
  const date =
    new Date(`${item.dueDate}T00:00:00`);

  const dateLabel =
    date.toLocaleDateString(
      "en-GB",
      {
        weekday: "short",
        day: "numeric",
        month: "short"
      }
    );

  let icon = "📅";
  let source = "";

  if (item.upcomingSource === "external") {
    icon =
      item.calendarSymbol || "📅";

    source =
      item.externalCalendarName || "";
  } else if (item.type === "task") {
    icon = "✅";

    const people =
      peopleForItem(item);

    source = people || "";
  } else {
    icon = "🏠";

    const people =
      peopleForItem(item);

    source = people || "";
  }

  summary +=
    `• ${dateLabel} ${icon} ${item.title}`;

  if (item.startTime) {
    summary += ` (${item.startTime}`;

    if (item.endTime) {
      summary += `–${item.endTime}`;
    }

    summary += `)`;
  }

  if (source) {
    summary += ` — ${source}`;
  }

  summary += `\n`;
}

const nextMonthLabel =
  nextMonthStartDate.toLocaleDateString(
    "en-GB",
    { month: "long" }
  );

const followingMonthLabel =
  followingMonthStartDate.toLocaleDateString(
    "en-GB",
    { month: "long" }
  );

if (
  next7Items.length ||
  laterThisMonth.length ||
  nextMonthItems.length ||
  followingMonthItems.length
) {
  summary +=
    `\n\n🔮 *COMING UP — 3 MONTHS*\n`;

  if (next7Items.length) {
    summary +=
      `\n*Next 7 days*\n`;

    next7Items.forEach(
      addComingUpItem
    );
  }

  if (laterThisMonth.length) {
    summary +=
      `\n*Later this month*\n`;

    laterThisMonth.forEach(
      addComingUpItem
    );
  }

  if (nextMonthItems.length) {
    summary +=
      `\n*${nextMonthLabel}*\n`;

    nextMonthItems.forEach(
      addComingUpItem
    );
  }

  if (followingMonthItems.length) {
    summary +=
      `\n*${followingMonthLabel}*\n`;

    followingMonthItems.forEach(
      addComingUpItem
    );
  }
}
  
  summary +=
    `\n🌐 *Open Family Hub:*\n`;
  summary +=
    `https://family-hub-9b455.web.app/`;

  await navigator.clipboard.writeText(summary);

  alert(
    "Family summary copied. You can now paste it into WhatsApp."
  );
};

  }
};

const minusBtn = document.getElementById("pointsMinusBtn");
const plusBtn = document.getElementById("pointsPlusBtn");
const amountBox = document.getElementById("pointsAdjustmentAmount");


if (minusBtn) {
  minusBtn.onclick = () => amountBox.stepDown();
}

if (plusBtn) {
  plusBtn.onclick = () => amountBox.stepUp();
}
$("savePointsAdjustmentBtn").onclick = async () => {

  if (!parentMode) {
    alert("Only a parent can adjust points.");
    return;
  }

  const memberId = $("pointsAdjustmentMember").value;
  const amount = Number($("pointsAdjustmentAmount").value);
const reason =
  $("pointsAdjustmentReason").value.trim();
  if (!memberId) {
    alert("Please select a member.");
    return;
  }

  if (!Number.isFinite(amount) || amount === 0) {
    alert("Enter a positive or negative number.");
    return;
  }

await addPointsTransaction({
  memberId,
  amount,
  type: amount > 0
    ? "manual-addition"
    : "manual-deduction",
  title: reason || (
    amount > 0
      ? "Manual points added"
      : "Manual points deducted"
  ),
  reason,
  displayOnMemberCard: reason.length > 0,
  adjustedByParent: true
});
$("pointsAdjustmentAmount").value = "";
$("pointsAdjustmentReason").value = "";
$("pointsAdjustmentMember").value = "";

alert("Points updated.");
};
function dashboardItems(filter) {
  const today = new Date().toISOString().split("T")[0];

  return nodes.filter(n => {
    if (n.type !== "task" && n.type !== "event") return false;

    if (filter === "overdue") return !n.done && n.dueDate && n.dueDate < today;
    if (filter === "today") return !n.done && n.dueDate === today;
    if (filter === "upcoming") return !n.done && n.dueDate && n.dueDate > today;
    if (filter === "completed") return n.done;

    return false;
  });
}
function showDashboardResults(filter) {
  const items = dashboardItems(filter);
  const results = $("dashboardResults");

  if (items.length === 0) {
    results.innerHTML = `
      <h3>${filter.toUpperCase()}</h3>
      <p>No matching tasks.</p>
    `;
    results.classList.remove("hidden");
    return;
  }

  results.innerHTML = `
    <h3>${filter.toUpperCase()}</h3>

    ${items.map(item => `
      <div class="card dashboard-result-card" data-dashboard-node-id="${item.id}">

        <div class="dashboard-result-title">
          ✅ ${item.title}
        </div>

        <div class="meta-row">

  ${
    members.find(member => member.id === item.memberId)
      ? `<span class="badge">
          ${members.find(member => member.id === item.memberId).emoji || "👤"}
          ${members.find(member => member.id === item.memberId).name}
        </span>`
      : ""
  }

  ${
    item.dueDate
      ? `<span class="badge date">📅 ${item.dueDate}</span>`
      : `<span class="badge">No due date</span>`
  }

  ${
    item.priority
      ? `<span class="badge priority-${item.priority}">
          ${
            item.priority === "high"
              ? "🔴"
              : item.priority === "medium"
              ? "🟡"
              : "🟢"
          }
          ${item.priority}
        </span>`
      : ""
  }

  ${item.done ? `<span class="badge done">✅ Done</span>` : ""}

</div>

      </div>
    `).join("")}
  `;

  results.classList.remove("hidden");
  document.querySelectorAll("[data-dashboard-node-id]").forEach(card => {
  card.onclick = () => {
    const item = nodes.find(node => node.id === card.dataset.dashboardNodeId);
    if (!item) return;

    selectedMemberId = item.memberId;
    selectedNode = item;
    currentParentId = item.parentId || null;

    renderMembers();
    renderWorkspace();

    $("detailsTitle").value = item.title || "";
    $("detailsNotes").value = item.notes || "";
    $("detailsType").value = item.type || "";
    $("detailsDone").checked = item.done === true;
    $("detailsDueDate").value = item.dueDate || "";
    $("detailsEndDate").value = item.endDate || "";
    $("detailsPriority").value = item.priority || "";
    $("detailsRepeat").value = item.repeat || "none";
    $("detailsPoints").value = item.points ?? 1;
    $("detailsRepeatUntil").value = item.repeatUntil || "";
    $("detailsRotationEnabled").checked =
  item.rotationEnabled === true;

renderRotationMembers(item.rotationMembers || []);

$("detailsParticipantsPerOccurrence").value =
  item.participantsPerOccurrence || 1;

$("detailsSharedEnabled").checked =
  item.sharedEnabled === true;

if (item.opportunityTaskEnabled) {
  $("detailsAssignmentType").value = "opportunity";
} else if (item.rotationEnabled) {
  $("detailsAssignmentType").value = "rotating";
} else if (item.sharedEnabled) {
  $("detailsAssignmentType").value = "shared";
} else {
  $("detailsAssignmentType").value = "assigned";
}

renderSharedParticipants(item.participantIds || []);

updateAssignmentControls();

$("detailsPanel").classList.remove("hidden");
    $("detailsPanel").scrollIntoView({ behavior: "smooth" });
  };
});
}
function formatDateLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getNextRepeatDate(dateString, repeat) {
  if (!dateString || !repeat || repeat === "none") return null;

  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  if (repeat === "daily") {
    date.setDate(date.getDate() + 1);
  } else if (repeat === "weekly") {
    date.setDate(date.getDate() + 7);
  } else if (repeat === "monthly") {
    date.setMonth(date.getMonth() + 1);
  } else if (repeat === "yearly") {
    date.setFullYear(date.getFullYear() + 1);
  } else {
    return null;
  }

  return formatDateLocal(date);
}
async function maybeProcessMissedRecurringTasks() {
  if (
    missedTasksProcessed ||
    !nodesLoaded ||
    !pointsLoaded
  ) {
    return;
  }

  missedTasksProcessed = true;

  await processMissedRecurringTasks();
}
async function processMissedRecurringTasks() {
  const today = formatDateLocal(new Date());

  const missedRecurringTasks = nodes.filter(node =>
    node.type === "task" &&
    !node.done &&
    node.dueDate &&
    node.dueDate < today &&
    node.repeat &&
    node.repeat !== "none"
  );

  console.log(
    "Missed recurring tasks:",
    missedRecurringTasks
  );

  for (const task of missedRecurringTasks) {
    let workingTask = {
      ...task,
      completedBy: task.completedBy || {},
      temporarySwaps: task.temporarySwaps || {}
    };

    let missedDate = task.dueDate;

    while (missedDate < today) {
      const assignedMemberIds =
        workingTask.rotationEnabled ||
        workingTask.sharedEnabled
          ? effectiveParticipantIds(workingTask)
          : [workingTask.memberId];

      for (const memberId of assignedMemberIds) {
        if (!memberId) continue;

        const penaltyAlreadyExists =
          pointTransactions.some(transaction =>
            transaction.type ===
              "missed-recurring-task" &&
            transaction.taskId === task.id &&
            transaction.memberId === memberId &&
            transaction.occurrenceDate === missedDate
          );

        if (!penaltyAlreadyExists) {
          await addPointsTransaction({
            memberId,
            amount: -(Number(task.points) || 0),
            type: "missed-recurring-task",
            title: task.title,
            reason: `Didn't complete "${task.title}"`,
            taskId: task.id,
            occurrenceDate: missedDate,
            displayOnMemberCard: true
          });
        }
      }

      const nextDueDate = getNextRepeatDate(
        missedDate,
        task.repeat
      );

      if (!nextDueDate) break;

      if (
        workingTask.rotationEnabled &&
        Array.isArray(workingTask.rotationMembers) &&
        workingTask.rotationMembers.length
      ) {
        const pool = workingTask.rotationMembers;

        const participantCount = Math.min(
          Math.max(
            1,
            Number(
              workingTask.participantsPerOccurrence
            ) || 1
          ),
          pool.length
        );

        let currentRotationIndex =
          Number.isInteger(
            workingTask.rotationIndex
          )
            ? workingTask.rotationIndex
            : 0;

        const currentParticipants =
          Array.isArray(
            workingTask.activeParticipantIds
          ) &&
          workingTask.activeParticipantIds.length
            ? workingTask.activeParticipantIds
            : rotatingParticipantIds(workingTask);

        const firstCurrentIndex = pool.indexOf(
          currentParticipants[0]
        );

        if (firstCurrentIndex >= 0) {
          currentRotationIndex =
            firstCurrentIndex;
        }

        const nextRotationIndex =
          (
            currentRotationIndex +
            participantCount
          ) % pool.length;

        const nextParticipants =
          Array.from(
            { length: participantCount },
            (_, offset) =>
              pool[
                (
                  nextRotationIndex +
                  offset
                ) % pool.length
              ]
          );

        workingTask = {
          ...workingTask,
          dueDate: nextDueDate,
          memberId:
            nextParticipants[0] ||
            workingTask.memberId,
          rotationIndex: nextRotationIndex,
          activeParticipantIds: nextParticipants,
          nextActiveParticipantIds: [],
          completedBy: {},
          temporarySwaps: {}
        };
      } else {
        workingTask = {
          ...workingTask,
          dueDate: nextDueDate,
          completedBy: {},
          temporarySwaps: {}
        };
      }

      missedDate = nextDueDate;
    }

    const updateData = {
      dueDate: workingTask.dueDate,
      done: false,
      completedAt: "",
      completedBy: {},
      temporarySwaps: {}
    };

    if (workingTask.rotationEnabled) {
      updateData.memberId =
        workingTask.memberId;

      updateData.rotationIndex =
        workingTask.rotationIndex;

      updateData.activeParticipantIds =
        workingTask.activeParticipantIds || [];

      updateData.nextActiveParticipantIds = [];
    }

    await updateNode(task.id, updateData);

    console.log(
      `Rolled forward "${task.title}" from ` +
      `${task.dueDate} to ${workingTask.dueDate}`
    );
  }
}
async function completeTask(node, options = {}) {
  if (!node) return;

  const completedAt = new Date().toISOString();

  await addActivity({
    title: node.title,
    memberId: node.memberId,
    completedAt,
    originalType: node.type,
    recurring: node.repeat
      ? node.repeat !== "none"
      : false,
    repeat: node.repeat || "none",
    dueDate: node.dueDate || ""
  });

  await addPointsTransaction({
  memberId: node.memberId,
  amount: node.points ?? 1,
  type: "task-completed",
  title: node.title,
  reason: `Completed "${node.title}"`,
  taskId: node.id,
  occurrenceDate:
    node.dueDate || formatDateLocal(new Date()),
  displayOnMemberCard: true
});

  let newDueDate = node.dueDate || "";
  let newDone = true;
  let newMemberId = node.memberId;
  let newRotationIndex = node.rotationIndex || 0;

  if (node.repeat && node.repeat !== "none") {
    let nextDate = getNextRepeatDate(newDueDate, node.repeat);
const today = formatDateLocal(new Date());

while (nextDate && nextDate <= today) {
  nextDate = getNextRepeatDate(nextDate, node.repeat);
}

    if (nextDate && (!node.repeatUntil || nextDate <= node.repeatUntil)) {
      newDueDate = nextDate;
      newDone = false;

      if (
        node.rotationEnabled &&
        node.rotationMembers &&
        node.rotationMembers.length > 1
      ) {
        const scheduledIndex =
  Number.isInteger(node.rotationIndex)
    ? node.rotationIndex
    : node.rotationMembers.indexOf(node.memberId);

newRotationIndex =
  scheduledIndex >= 0
    ? (scheduledIndex + 1) % node.rotationMembers.length
    : 0;

        newMemberId = node.rotationMembers[newRotationIndex];
      }
    }
  }
console.log("COMPLETE TASK", {
  title: node.title,
  dueDate: node.dueDate,
  repeat: node.repeat,
  participantsPerOccurrence: node.participantsPerOccurrence,
  rotationMembers: node.rotationMembers,
  completedBy: node.completedBy
});
  await updateNode(node.id, {
  done: newDone,
  completedAt: newDone ? completedAt : "",
  dueDate: newDueDate,
  memberId: newMemberId,
  rotationIndex: newRotationIndex,
    nextActiveParticipantIds: [],
    activeParticipantIds:
    !newDone && node.rotationEnabled
      ? nextRotatingParticipantIds(
          node,
          node.completedBy || {}
        )
      : node.activeParticipantIds || [],

  completedBy: newDone
    ? node.completedBy || {}
    : {},

  temporarySwaps: newDone
    ? node.temporarySwaps || {}
    : {}
});
selectedNode = null;
$("detailsPanel").classList.add("hidden");
}
async function completeSharedTaskForMember(node, memberId) {
  if (!node || !memberId) return;

  const requiredMembers = effectiveParticipantIds(node);

  if (!requiredMembers.includes(memberId)) {
    alert("You are not assigned to this shared task.");
    return;
  }

  const completedBy = {
    ...(node.completedBy || {}),
    [memberId]: true
  };
  const today = formatDateLocal(new Date());

const isOverdueRotatingTask =
  node.rotationEnabled &&
  node.repeat &&
  node.repeat !== "none" &&
  node.dueDate &&
  node.dueDate < today;

if (isOverdueRotatingTask) {
  let nextDate =
    getNextRepeatDate(node.dueDate, node.repeat);

  while (nextDate && nextDate <= today) {
    nextDate =
      getNextRepeatDate(nextDate, node.repeat);
  }

  if (
    nextDate &&
    (!node.repeatUntil || nextDate <= node.repeatUntil)
  ) {
    const nextParticipants =
      nextRotatingParticipantIds(node, completedBy);

    await updateNode(node.id, {
      dueDate: nextDate,
      done: false,
      completedAt: "",
      activeParticipantIds: rotatingParticipantIds(node),
      nextActiveParticipantIds: nextParticipants,
completedBy,
temporarySwaps: node.temporarySwaps || {}
    });

    return;
  }
}

  const everyoneDone = requiredMembers.every(
    id => completedBy[id] === true
  );

  if (!everyoneDone) {
    await updateNode(node.id, {
      completedBy
    });

    return;
  }

  await completeTask({
  ...node,
  memberId,
  completedBy
});
}
async function awardBonusTask(node) {
  if (!node || !node.opportunityTaskEnabled) return;

  if (!parentMode) {
    alert("Only a parent can award a bonus task.");
    return;
  }

  const availableMembers = members.filter(member =>
    member.role !== "parent"
  );

  if (!availableMembers.length) {
    alert("No children are available to receive this task.");
    return;
  }

  const choices = availableMembers
    .map(
      (member, index) =>
        `${index + 1}. ${member.emoji || "👤"} ${member.name}`
    )
    .join("\n");

  const answer = prompt(
    `Who completed "${node.title}"?\n\n${choices}\n\nEnter a number:`
  );

  if (!answer) return;

  const selectedIndex = Number(answer) - 1;
  const awardedMember = availableMembers[selectedIndex];

  if (!awardedMember) {
    alert("Please enter a valid number.");
    return;
  }

  const confirmed = confirm(
    `Award "${node.title}" to ${awardedMember.name} for ${
      node.points ?? 0
    } points?`
  );

  if (!confirmed) return;

  const completedAt = new Date().toISOString();
  const occurrenceDate =
    node.dueDate || formatDateLocal(new Date());

  await addActivity({
    title: `Bonus awarded: ${node.title}`,
    memberId: awardedMember.id,
    completedAt,
    originalType: "bonus-task",
    recurring:
      node.repeat && node.repeat !== "none",
    repeat: node.repeat || "none",
    dueDate: node.dueDate || ""
  });

  await addPointsTransaction({
    memberId: awardedMember.id,
    amount: node.points ?? 0,
    type: "bonus-task-completed",
    title: node.title,
    taskId: node.id,
    occurrenceDate
  });

  let newDueDate = node.dueDate || "";
  let newDone = true;

  if (node.repeat && node.repeat !== "none") {
    let nextDate =
      getNextRepeatDate(newDueDate, node.repeat);

    const today = formatDateLocal(new Date());

    while (nextDate && nextDate <= today) {
      nextDate =
        getNextRepeatDate(nextDate, node.repeat);
    }

    if (
      nextDate &&
      (!node.repeatUntil || nextDate <= node.repeatUntil)
    ) {
      newDueDate = nextDate;
      newDone = false;
    }
  }

  await updateNode(node.id, {
    done: newDone,
    completedAt: newDone ? completedAt : "",
    dueDate: newDueDate,
    awardedToMemberId: awardedMember.id,
    awardedAt: completedAt
  });

  selectedNode = null;
  $("detailsPanel").classList.add("hidden");

  alert(
    `${awardedMember.name} received ${
      node.points ?? 0
    } points.`
  );
}
async function completeNodeFromList(node) {
if (
  node.opportunityTaskEnabled &&
  currentMember()?.role === "parent"
) {
  if (node.done || node.awardedToMemberId) {
  alert("This bonus task has already been completed.");
  return;
}
  const completedAt = new Date().toISOString();

  await addActivity({
    title: `Bonus completed: ${node.title}`,
    memberId: selectedMemberId,
    completedAt,
    originalType: "bonus-task",
    recurring: node.repeat && node.repeat !== "none",
    repeat: node.repeat || "none",
    dueDate: node.dueDate || ""
  });

  await addPointsTransaction({
    memberId: selectedMemberId,
    amount: node.points ?? 0,
    type: "bonus-task-completed",
    title: node.title,
    taskId: node.id,
    occurrenceDate:
      node.dueDate || formatDateLocal(new Date())
  });

  await updateNode(node.id, {
  done: true,
  completedAt,
  awardedToMemberId: selectedMemberId,
  awardedAt: completedAt
});

  return;
}
  if (node.sharedEnabled) {
    await completeSharedTaskForMember(
      node,
      selectedMemberId
    );

    return;
  }

  await completeTask(node, {
    source: "workspace"
  });
}
async function swapSharedParticipant(node, originalParticipantId) {
  if (!node || !originalParticipantId) return;
  const currentEffectiveId =
  node.temporarySwaps?.[originalParticipantId] || originalParticipantId;

if (node.completedBy?.[currentEffectiveId] === true) {
  alert("This person has already completed their part and cannot be swapped.");
  return;
}

  const currentParticipantIds = effectiveParticipantIds(node);

const availableMembers = members.filter(member =>
  !currentParticipantIds.includes(member.id)
);

  if (!availableMembers.length) {
    alert("There is nobody available to cover this person.");
    return;
  }

  const originalMember = members.find(
    member => member.id === originalParticipantId
  );

  const choices = availableMembers
    .map(
      (member, index) =>
        `${index + 1}. ${member.emoji || "👤"} ${member.name}`
    )
    .join("\n");

  const answer = prompt(
    `Who should cover ${
      originalMember?.name || "this person"
    } for "${node.title}"?\n\n${choices}\n\nEnter a number:`
  );

  if (!answer) return;

  const selectedIndex = Number(answer) - 1;
  const replacement = availableMembers[selectedIndex];

  if (!replacement) {
    alert("Please enter a valid number.");
    return;
  }

  const confirmed = confirm(
    `Replace ${originalMember?.name || "this person"} with ${
      replacement.name
    } for this occurrence only?`
  );

  if (!confirmed) return;

  await updateNode(node.id, {
    temporarySwaps: {
      ...(node.temporarySwaps || {}),
      [originalParticipantId]: replacement.id
    }
  });

  await addActivity({
    title: `Temporary cover: ${node.title}`,
    memberId: replacement.id,
    previousMemberId: originalParticipantId,
    completedAt: new Date().toISOString(),
    originalType: "participant-swap",
    recurring: node.repeat && node.repeat !== "none",
    repeat: node.repeat || "none",
    dueDate: node.dueDate || ""
  });
}
async function swapTaskOwner(node) {
  if (!node) return;

  const availableMembers = members.filter(member =>
    member.id !== node.memberId
  );

  if (!availableMembers.length) {
    alert("There is nobody else available to take this task.");
    return;
  }

  const choices = availableMembers
    .map((member, index) =>
      `${index + 1}. ${member.emoji || "👤"} ${member.name}`
    )
    .join("\n");

  const answer = prompt(
    `Swap "${node.title}" to:\n\n${choices}\n\nEnter a number:`
  );

  if (!answer) return;

  const selectedIndex = Number(answer) - 1;
  const newOwner = availableMembers[selectedIndex];

  if (!newOwner) {
    alert("Please enter a valid number.");
    return;
  }

  const oldOwner = members.find(member => member.id === node.memberId);

  const confirmed = confirm(
    `Swap "${node.title}" from ${
      oldOwner?.name || "current owner"
    } to ${newOwner.name}?`
  );

  if (!confirmed) return;

  await updateNode(node.id, {
    memberId: newOwner.id,
    swappedFromMemberId: node.memberId,
    swappedAt: new Date().toISOString()
  });

  await addActivity({
    title: `Swapped: ${node.title}`,
    memberId: newOwner.id,
    previousMemberId: node.memberId,
    completedAt: new Date().toISOString(),
    originalType: "swap",
    recurring: node.repeat && node.repeat !== "none",
    repeat: node.repeat || "none",
    dueDate: node.dueDate || ""
  });
}
function occursOnDate(item, dateString) {
  if (!item.dueDate) return false;

  if (item.endDate && item.endDate > item.dueDate) {
    return (
      dateString >= item.dueDate &&
      dateString < item.endDate
    );
  }

  return item.dueDate === dateString;
}
function shouldShowTaskToday(item, dateString) {
  if (item.type !== "task") {
    return occursOnDate(item, dateString);
  }

  if (item.done) {
    return item.dueDate === dateString;
  }

  return item.dueDate <= dateString;
}
function eventBandClass(item, dateString) {
  if (item.type !== "event" || !item.endDate) return "";

  if (dateString === item.dueDate) return "event-band-start";
  if (dateString === item.endDate) return "event-band-end";

  return "event-band-middle";
}
function enabledExternalEvents() {
  return externalCalendars
    .filter(calendar => calendar.enabled)
    .flatMap(calendar =>
      (calendar.events || []).map(event => ({
        ...event,
        externalCalendarId: calendar.id,
        externalCalendarName: calendar.name,
        calendarColor: calendar.color || "purple",
        calendarSymbol: calendar.symbol || "📅"
      }))
    );
}
function showExternalCalendarEvent(item) {
  let dialog =
    document.getElementById(
      "externalCalendarEventDialog"
    );

  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "externalCalendarEventDialog";

    dialog.innerHTML = `
      <div class="external-event-popup">
        <button
          type="button"
          class="external-event-close"
          aria-label="Close"
        >
          ×
        </button>

        <h2 data-event-title></h2>

        <p data-event-date></p>
        <p data-event-time></p>
        <p data-event-calendar></p>

        <div data-event-description></div>

        <p data-event-location></p>
      </div>
    `;

    document.body.appendChild(dialog);

    dialog.querySelector(
      ".external-event-close"
    ).onclick = () => dialog.close();

    dialog.addEventListener("click", event => {
      if (event.target === dialog) {
        dialog.close();
      }
    });
  }

  dialog.querySelector(
    "[data-event-title]"
  ).textContent = item.title || "Untitled event";

  const date = new Date(
    `${item.dueDate}T00:00:00`
  );

  dialog.querySelector(
    "[data-event-date]"
  ).textContent =
    "📅 " +
    date.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });

  dialog.querySelector(
    "[data-event-time]"
  ).textContent =
    item.startTime
      ? `🕒 ${item.startTime}${
          item.endTime
            ? ` – ${item.endTime}`
            : ""
        }`
      : "🕒 All day";

  dialog.querySelector(
    "[data-event-calendar]"
  ).textContent =
    `${item.calendarSymbol || "📅"} ${
      item.externalCalendarName ||
      "External calendar"
    }`;

  const description =
    dialog.querySelector(
      "[data-event-description]"
    );

  if (item.description) {
    description.textContent =
      item.description;
    description.hidden = false;
  } else {
    description.hidden = true;
  }

  const location =
    dialog.querySelector(
      "[data-event-location]"
    );

  if (item.location) {
    location.textContent =
      `📍 ${item.location}`;
    location.hidden = false;
  } else {
    location.hidden = true;
  }

  dialog.showModal();
}
function renderCalendar() {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();

  const monthName = calendarDate.toLocaleString("default", {
    month: "long",
    year: "numeric"
  });

  $("calendarTitle").textContent = monthName;

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPadding = firstDay.getDay();

  const days = [
  `<div class="calendar-weekday">Sun</div>`,
  `<div class="calendar-weekday">Mon</div>`,
  `<div class="calendar-weekday">Tue</div>`,
  `<div class="calendar-weekday">Wed</div>`,
  `<div class="calendar-weekday">Thu</div>`,
  `<div class="calendar-weekday">Fri</div>`,
  `<div class="calendar-weekday">Sat</div>`
];

  for (let i = 0; i < startPadding; i++) {
    days.push(`<div class="calendar-day empty"></div>`);
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const dateString = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const todayString = new Date().toISOString().split("T")[0];
const isToday = dateString === todayString;

    const familyHubItems = nodes.filter(node =>
  (node.type === "task" || node.type === "event") &&
  occursOnDate(node, dateString)
);

const externalItems = enabledExternalEvents().filter(
  event => occursOnDate(event, dateString)
);

const tasksForDay = [
  ...familyHubItems,
  ...externalItems
];

    days.push(`
      <div class="calendar-day ${isToday ? "today" : ""}" data-calendar-date="${dateString}">
        <strong>${day}</strong>

  ${tasksForDay.map((task, index) => `
  <div
    class="calendar-task ${index >= 4 ? "calendar-extra hidden" : ""} ${task.done ? "done" : task.priority || ""} ${
      task.type === "event" ||
      task.type === "external-event"
        ? "calendar-event"
        : ""
    } ${
      task.type === "external-event"
        ? `external-calendar-${task.calendarColor}`
        : ""
    }"
    ${
      task.type === "external-event"
        ? `data-external-event-id="${encodeURIComponent(task.id)}"
           data-external-calendar-id="${encodeURIComponent(task.externalCalendarId)}"`
        : ""
    }
  >
    <span class="calendar-task-title">
      ${
        task.type === "external-event"
          ? `<span class="calendar-colour-dot"></span>${task.calendarSymbol} ${task.title}`
          : task.title
      }
    </span>
  </div>
`).join("")}

${
  tasksForDay.length > 4
    ? `<div class="calendar-more" data-calendar-date="${dateString}">
         +${tasksForDay.length - 4} more...
       </div>`
    : ""
}
      </div>
    `);
  }
while (days.length < 49) {
  days.push(`<div class="calendar-day empty"></div>`);
}
  $("calendarGrid").innerHTML = days.join("");
  document.querySelectorAll("[data-calendar-date]").forEach(dayCell => {
  dayCell.onclick = () => {
    showCalendarDay(dayCell.dataset.calendarDate);
  };
});
document
  .querySelectorAll("[data-external-event-id]")
  .forEach(card => {
    card.onclick = event => {
      event.stopPropagation();

      const eventId =
        decodeURIComponent(
          card.dataset.externalEventId
        );

      const calendarId =
        decodeURIComponent(
          card.dataset.externalCalendarId
        );

      const item =
        enabledExternalEvents().find(
          eventItem =>
            eventItem.id === eventId &&
            eventItem.externalCalendarId ===
              calendarId
        );

      if (!item) return;

      showExternalCalendarEvent(item);
    };
  });
document.querySelectorAll(".calendar-more").forEach(link => {
  link.onclick = event => {
    event.stopPropagation();

    const dayCell = link.closest(".calendar-day");
    const extras = dayCell.querySelectorAll(".calendar-extra");

    const isExpanded = link.dataset.expanded === "true";

    extras.forEach(item => {
      item.classList.toggle("hidden", isExpanded);
    });

    if (isExpanded) {
      link.textContent = `+${extras.length} more...`;
      link.dataset.expanded = "false";
    } else {
      link.textContent = "Show less";
      link.dataset.expanded = "true";
    }
  };
});
}

$("prevMonthBtn").onclick = () => {
  calendarDate.setMonth(calendarDate.getMonth() - 1);
  renderCalendar();
};

$("nextMonthBtn").onclick = () => {
  calendarDate.setMonth(calendarDate.getMonth() + 1);
  renderCalendar();
};
function showCalendarDay(dateString) {
  const panel = $("calendarDayPanel");
  const title = $("calendarDayTitle");
  const taskList = $("calendarDayTasks");

  const selectedDate = new Date(dateString + "T00:00:00");

  title.textContent = selectedDate.toLocaleDateString("default", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  const familyHubItems = nodes.filter(node =>
  (node.type === "task" || node.type === "event") &&
  occursOnDate(node, dateString)
);

const externalItems = enabledExternalEvents().filter(
  event => occursOnDate(event, dateString)
);

const itemsForDay = [
  ...familyHubItems,
  ...externalItems
];

  if (!itemsForDay.length) {
    taskList.innerHTML = `<p>No tasks or events due on this day.</p>`;
    panel.classList.remove("hidden");
    panel.scrollIntoView({ behavior: "smooth" });
    return;
  }

  taskList.innerHTML = itemsForDay.map(item => {
    

    return `
      <div class="calendar-day-task" data-calendar-task-id="${item.id}">
        <strong>
          ${
            item.type === "event" ||
item.type === "external-event"
  ? "📅"
              : item.done
              ? "✅"
              : item.priority === "high"
              ? "🔴"
              : item.priority === "medium"
              ? "🟡"
              : item.priority === "low"
              ? "🟢"
              : "📌"
          }
          ${item.title}
        </strong>

        <div class="meta-row">
          <span class="badge">
  ${
    item.type === "external-event"
      ? `📅 ${item.externalCalendarName || "External calendar"}`
      : item.type === "task" &&
        (item.sharedEnabled || item.rotationEnabled)
      ? `👥 Currently due: ${participantDisplay(item)}`
      : participantDisplay(item)
  }
</span>

          ${
            item.repeat && item.repeat !== "none"
              ? `<span class="badge">🔁 ${item.repeat}</span>`
              : ""
          }

          ${
            item.rotationEnabled
              ? `<span class="badge">🔄 Rotating</span>`
              : ""
          }
        </div>
      </div>
    `;
  }).join("");

  document.querySelectorAll("[data-calendar-task-id]").forEach(card => {
    card.onclick = () => {
      const item = nodes.find(node => node.id === card.dataset.calendarTaskId);
      if (!item) return;

      selectedMemberId = item.memberId;
      selectedNode = item;
      currentParentId = item.parentId || null;

      renderMembers();
      renderWorkspace();

      $("detailsTitle").value = item.title || "";
      $("detailsNotes").value = item.notes || "";
      $("detailsType").value = item.type || "";
      $("detailsDone").checked = item.done === true;
      $("detailsDueDate").value = item.dueDate || "";
      $("detailsEndDate").value = item.endDate || "";
      $("detailsPriority").value = item.priority || "";
      $("detailsRepeat").value = item.repeat || "none";
      $("detailsPoints").value = item.points ?? 1;
      $("detailsRepeatUntil").value = item.repeatUntil || "";
      $("detailsRotationEnabled").checked =
  item.rotationEnabled === true;

renderRotationMembers(item.rotationMembers || []);

$("detailsParticipantsPerOccurrence").value =
  item.participantsPerOccurrence || 1;

$("detailsSharedEnabled").checked =
  item.sharedEnabled === true;

if (item.opportunityTaskEnabled) {
  $("detailsAssignmentType").value = "opportunity";
} else if (item.rotationEnabled) {
  $("detailsAssignmentType").value = "rotating";
} else if (item.sharedEnabled) {
  $("detailsAssignmentType").value = "shared";
} else {
  $("detailsAssignmentType").value = "assigned";
}

renderSharedParticipants(item.participantIds || []);

updateAssignmentControls();

$("detailsPanel").classList.remove("hidden");
      $("detailsPanel").scrollIntoView({ behavior: "smooth" });
    };
  });

  panel.classList.remove("hidden");
  panel.scrollIntoView({ behavior: "smooth" });
}
function updateGreeting() {
  const hour = new Date().getHours();

  let greeting = "Good evening";

  if (hour < 12) {
    greeting = "Good morning";
  } else if (hour < 18) {
    greeting = "Good afternoon";
  }

  $("homeGreeting").textContent = `${greeting} 👋`;
}
function updateTodaySummary() {
  const today = new Date();
  const todayString = today.toISOString().split("T")[0];

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowString = tomorrow.toISOString().split("T")[0];

  const relevantItems = nodes.filter(node =>
    node.type === "task" || node.type === "event"
  );

  $("todayOverdue").textContent = relevantItems.filter(item =>
    !item.done &&
    item.dueDate &&
    item.dueDate < todayString
  ).length;

  $("todayDue").textContent = relevantItems.filter(item =>
    !item.done &&
    item.dueDate === todayString
  ).length;

  $("tomorrowDue").textContent = relevantItems.filter(item =>
    !item.done &&
    item.dueDate === tomorrowString
  ).length;

  const todayItems = relevantItems.filter(item =>
  !item.done &&
  shouldShowTaskToday(item, todayString)
);

  const list = $("todayItemsList");

  if (!todayItems.length) {
    list.innerHTML = `
      <p>🎉 Nothing due today. Enjoy your day!</p>
    `;
    return;
  }

  list.innerHTML = todayItems.map(item => {
    const member = members.find(m => m.id === item.memberId);

    return `
      <div class="today-item">
        <div>
          <div class="today-item-title">
            ${item.type === "event" ? "📅" : "📌"} ${item.title}
          </div>

          <div class="today-item-owner">
            ${member ? `${member.emoji || "👤"} ${member.name}` : ""}
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function runGlobalSearch() {
  const input = $("globalSearchInput");
  const results = $("searchResults");

  const query = input.value.trim().toLowerCase();

  if (!query) {
    results.classList.add("hidden");
    results.innerHTML = "";
    return;
  }

  const matches = nodes.filter(node => {
  const member = members.find(m => m.id === node.memberId);
  const parent = nodes.find(n => n.id === node.parentId);

  const searchableText = [
    node.title,
    node.type,
    node.priority,
    node.dueDate,
    member?.name,
    member?.emoji,
    parent?.title
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchableText.includes(query);
});

  if (!matches.length) {
    results.innerHTML = `
      <div class="search-result">
        No results found.
      </div>
    `;
    results.classList.remove("hidden");
    return;
  }

  results.innerHTML = matches.map(item => {
  const member = members.find(m => m.id === item.memberId);

  const parent =
    nodes.find(n => n.id === item.parentId);

  return `
    <div class="search-result" data-search-id="${item.id}">

      <div class="search-title">
        ${
          item.type === "folder"
            ? "📁"
            : item.type === "task"
            ? "📌"
            : item.type === "event"
            ? "📅"
            : item.type === "note"
            ? "📝"
            : "☑"
        }

        ${item.title}
      </div>

      <div class="search-meta">

        ${
          member
            ? `${member.emoji || "👤"} ${member.name}`
            : ""
        }

        ${
          parent
            ? ` • 📁 ${parent.title}`
            : ""
        }

        • ${item.type}

      </div>

    </div>
  `;
}).join("");

  results.classList.remove("hidden");
  document.querySelectorAll("[data-search-id]").forEach(card => {
  card.onclick = () => {
    const item = nodes.find(node => node.id === card.dataset.searchId);
    if (!item) return;

    selectedMemberId = item.memberId;
    selectedNode = item;
    currentParentId = item.parentId || null;

    renderMembers();
    renderWorkspace();

    $("detailsTitle").value = item.title || "";
    $("detailsNotes").value = item.notes || "";
    $("detailsType").value = item.type || "";
    $("detailsDone").checked = item.done === true;
    $("detailsDueDate").value = item.dueDate || "";
    $("detailsEndDate").value = item.endDate || "";
    $("detailsPriority").value = item.priority || "";
    $("detailsRepeat").value = item.repeat || "none";
    $("detailsPoints").value = item.points ?? 1;
    $("detailsRepeatUntil").value = item.repeatUntil || "";
   $("detailsRotationEnabled").checked =
  item.rotationEnabled === true;

renderRotationMembers(item.rotationMembers || []);

$("detailsParticipantsPerOccurrence").value =
  item.participantsPerOccurrence || 1;

$("detailsSharedEnabled").checked =
  item.sharedEnabled === true;

if (item.opportunityTaskEnabled) {
  $("detailsAssignmentType").value = "opportunity";
} else if (item.rotationEnabled) {
  $("detailsAssignmentType").value = "rotating";
} else if (item.sharedEnabled) {
  $("detailsAssignmentType").value = "shared";
} else {
  $("detailsAssignmentType").value = "assigned";
}

renderSharedParticipants(item.participantIds || []);

updateAssignmentControls();

$("detailsPanel").classList.remove("hidden");
    $("detailsPanel").scrollIntoView({ behavior: "smooth" });
  };
});
}
const searchInput = $("globalSearchInput");

if (searchInput) {
  searchInput.oninput = runGlobalSearch;
}
function updateParentModeButton() {
  $("parentModeBtn").textContent = parentMode
    ? "🔓 Parent mode on"
    : "🔒 Child mode on";

  $("parentDashboardPanel").classList.toggle(
    "hidden",
    !parentMode
  );

  // Redraw tasks so parent-only buttons appear or disappear
  if (selectedMemberId) {
    renderWorkspace();
  }
  renderMembers();
}

$("parentModeBtn").onclick = () => {
  if (parentMode) {
    parentMode = false;
    updateParentModeButton();
    return;
  }
  


  const enteredPin = prompt("Enter parent PIN");

  if (enteredPin === parentPin) {
    parentMode = true;
    updateParentModeButton();
  } else {
    alert("Incorrect PIN");
  }
};

updateParentModeButton();
function renderRotationMembers(selectedIds = []) {
  const list = $("rotationMembersList");

  list.innerHTML = members.map(member => `
    <label class="rotation-member">
      <input
        type="checkbox"
        value="${member.id}"
        ${selectedIds.includes(member.id) ? "checked" : ""}
      >
      ${member.emoji || "👤"} ${member.name}
    </label>
  `).join("");
}
function renderSharedParticipants(selectedIds = []) {
  const list = $("sharedParticipantsList");
  if (!list) return;

  list.innerHTML = members.map(member => `
    <label class="rotation-member">
      <input
        type="checkbox"
        value="${member.id}"
        ${selectedIds.includes(member.id) ? "checked" : ""}
      >
      ${member.emoji || "👤"} ${member.name}
    </label>
  `).join("");
}
function updateAssignmentControls() {
  const assignmentType =
    $("detailsAssignmentType").value;

  const fixedSharedSection =
    $("fixedSharedSection");

  const rotationSection =
    $("rotationMembersList")
      ?.closest(".details-section");

  if (fixedSharedSection) {
    fixedSharedSection.classList.toggle(
      "hidden",
      assignmentType !== "shared"
    );
  }

  if (rotationSection) {
    rotationSection.classList.toggle(
      "hidden",
      assignmentType !== "rotating"
    );
  }
}
function updateParentDashboard() {
  if (!$("parentIncompleteCount")) return;
  const today = new Date().toISOString().split("T")[0];

  const items = nodes.filter(node =>
    node.type === "task" || node.type === "event"
  );

  $("parentIncompleteCount").textContent =
    items.filter(item => !item.done).length;

  $("parentCompletedCount").textContent =
    items.filter(item => item.done).length;

  $("parentOverdueCount").textContent =
    items.filter(item =>
      !item.done &&
      item.dueDate &&
      item.dueDate < today
    ).length;

  $("parentRecurringCount").textContent =
    items.filter(item =>
      item.repeat &&
      item.repeat !== "none"
    ).length;

  $("parentRotatingCount").textContent =
    items.filter(item =>
      item.rotationEnabled
    ).length;
}
$("parentCompletedCard").onclick = () => {
  const list = $("parentCompletedList");

  const completedItems = nodes.filter(node =>
    (node.type === "task" || node.type === "event") &&
    node.done
  );

  if (!completedItems.length) {
    list.innerHTML = "<p>No completed tasks.</p>";
  } else {
    list.innerHTML = `
      <h3>Completed Tasks</h3>

      ${completedItems.map(item => {
        const member = members.find(m => m.id === item.memberId);

        return `
          <div class="card dashboard-result-card">
            <strong>✅ ${item.title}</strong>

            <div class="meta-row">
              <span class="badge">
                ${member ? `${member.emoji || "👤"} ${member.name}` : "Unknown"}
              </span>

              ${item.dueDate ? `<span class="badge date">📅 ${item.dueDate}</span>` : ""}

              ${
                item.completedAt
                  ? `<span class="badge">✅ Completed ${new Date(item.completedAt).toLocaleDateString()}</span>`
                  : ""
              }

              <span class="badge">${item.type}</span>
            </div>
          </div>
        `;
      }).join("")}
    `;
  }

  list.classList.toggle("hidden");
};
function renderPointsAdjustmentMembers() {
  const select = $("pointsAdjustmentMember");
  if (!select) return;

  const currentValue = select.value;

  select.innerHTML = `
    <option value="">Select member</option>

    ${members.map(member => `
      <option value="${member.id}">
        ${member.emoji || "👤"} ${member.name}
      </option>
    `).join("")}
  `;

  if (currentValue) {
    select.value = currentValue;
  }
}
function renderFamilyEconomy() {
  const leaderboard = $("pointsLeaderboard");
  const ledger = $("pointsLedger");

  if (!leaderboard || !ledger) return;

  const totals = {};

  pointsFromCurrentWeek().forEach(transaction => {
    const amount = Number(transaction.amount) || 0;

    totals[transaction.memberId] =
      (totals[transaction.memberId] || 0) + amount;
  });
  console.log(pointsFromCurrentWeek());
console.log(totals);

  const rankedMembers = members
    .map(member => ({
      ...member,
      totalPoints: totals[member.id] || 0
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints);

  leaderboard.innerHTML = `
    <h3>🏆 Leaderboard</h3>

    ${
      rankedMembers.length
        ? rankedMembers.map((member, index) => {
            const position =
              index === 0
                ? "🥇"
                : index === 1
                ? "🥈"
                : index === 2
                ? "🥉"
                : `${index + 1}.`;

            return `
              <div class="card dashboard-result-card">
                <strong>
                  ${position}
                  ${member.emoji || "👤"}
                  ${member.name}
                </strong>

                <span class="badge">
                  ⭐ ${member.totalPoints} points
                </span>
              </div>
            `;
          }).join("")
        : "<p>No family members found.</p>"
    }
  `;

  const recentTransactions =
  pointsFromCurrentWeek().slice(0, 10);

  ledger.innerHTML = "";
}
function updateParentActivity() {
  const activityList = $("parentActivityList");
  if (!activityList) return;

  const recentActivities = activities.slice(0, 10);

  if (!recentActivities.length) {
    activityList.innerHTML = `
      <h3>📜 Recent Activity</h3>
      <p>No activity yet.</p>
    `;
    return;
  }

  activityList.innerHTML = `
    <h3>📜 Recent Activity</h3>

    ${recentActivities.map(item => {
      const member = members.find(m => m.id === item.memberId);

      return `
        <div class="card dashboard-result-card">
          <strong>✅ ${item.title}</strong>

          <div class="meta-row">
            <span class="badge">
              ${member ? `${member.emoji || "👤"} ${member.name}` : "Unknown"}
            </span>

            <span class="badge">
              ${item.recurring ? "🔁 Recurring" : "📌 One-off"}
            </span>

            ${
              item.completedAt
                ? `<span class="badge">🕒 ${new Date(item.completedAt).toLocaleString()}</span>`
                : ""
            }
          </div>

          <button
            class="danger"
            data-delete-activity="${item.id}"
            type="button">
            🗑 Delete
          </button>
        </div>
      `;
    }).join("")}
  `;

  document.querySelectorAll("[data-delete-activity]").forEach(button => {
    button.onclick = async () => {
      if (!confirm("Delete this activity item?")) return;

      await deleteActivity(button.dataset.deleteActivity);
    };
  });
}

function showParentCentreResults(title, items) {
  const results = $("parentCentreResults");

  if (!items.length) {
    results.innerHTML = `<h3>${title}</h3><p>No matching items.</p>`;
    results.classList.remove("hidden");
    return;
  }

  results.innerHTML = `
    <h3>${title}</h3>
    ${items.map(item => {
      const member = members.find(m => m.id === item.memberId);

      return `
        <div class="card dashboard-result-card">
          <strong>${item.title}</strong>
          <div class="meta-row">
            <span class="badge">${member ? `${member.emoji || "👤"} ${member.name}` : "Unknown"}</span>
            ${item.dueDate ? `<span class="badge date">📅 ${item.dueDate}</span>` : ""}
            ${item.priority ? `<span class="badge priority-${item.priority}">${item.priority}</span>` : ""}
            ${item.repeat && item.repeat !== "none" ? `<span class="badge">🔁 ${item.repeat}</span>` : ""}
            ${item.rotationEnabled ? `<span class="badge">🔄 Rotating</span>` : ""}
          </div>
        </div>
      `;
    }).join("")}
  `;

  results.classList.remove("hidden");
}

$("parentIncompleteCard").onclick = () => {
  showParentCentreResults(
    "📌 Incomplete Items",
    nodes.filter(item =>
      (item.type === "task" || item.type === "event") &&
      !item.done
    )
  );
};

$("parentOverdueCard").onclick = () => {
  const today = new Date().toISOString().split("T")[0];

  showParentCentreResults(
    "🔴 Overdue Items",
    nodes.filter(item =>
      (item.type === "task" || item.type === "event") &&
      !item.done &&
      item.dueDate &&
      item.dueDate < today
    )
  );
};

$("parentRecurringCard").onclick = () => {
  showParentCentreResults(
    "🔁 Recurring Items",
    nodes.filter(item =>
      (item.type === "task" || item.type === "event") &&
      item.repeat &&
      item.repeat !== "none"
    )
  );
};

$("parentRotatingCard").onclick = () => {
  showParentCentreResults(
    "🔄 Rotating Items",
    nodes.filter(item =>
      (item.type === "task" || item.type === "event") &&
      item.rotationEnabled
    )
  );
};
function renderPendingMemberDropdown() {
  const select = $("pendingMemberSelect");
  if (!select) return;

  if (!members.length) {
    select.innerHTML = `<option value="">Members loading...</option>`;
    return;
  }

  const currentValue = select.value;

  select.innerHTML = `
    <option value="">Select member</option>
    ${members.map(member => `
      <option value="${member.id}">
        ${member.emoji || "👤"} ${member.name}
      </option>
    `).join("")}
  `;

  if (currentValue) {
    select.value = currentValue;
  }

  select.onchange = () => {
    renderPendingTasksForSelectedMember();
  };
}
function renderPendingTasksForSelectedMember() {
  const select = $("pendingMemberSelect");
  const list = $("pendingTasksList");

  if (!select || !list) return;

  const memberId = select.value;
  const today = new Date().toISOString().split("T")[0];

  if (!memberId) {
    list.innerHTML = "<p>Select a member to view pending tasks.</p>";
    return;
  }

  const allTasks = nodes
    .filter(node => {

  let belongsToMember;

  if (node.rotationEnabled && node.sharedEnabled) {

    belongsToMember =
      effectiveParticipantIds(node).includes(memberId);

  } else if (node.sharedEnabled) {

    belongsToMember =
      effectiveParticipantIds(node).includes(memberId);

  } else {

    belongsToMember =
      node.memberId === memberId;

  }

  return (
    belongsToMember &&
    node.type === "task" &&
    !node.done
  );

})
    .sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });

  const overdueTasks = allTasks.filter(task =>
    task.dueDate && task.dueDate < today
  );

  const pendingTasks = allTasks.filter(task =>
    !task.dueDate || task.dueDate >= today
  );

  if (!allTasks.length) {
    list.innerHTML = "<p>🎉 No pending or overdue tasks.</p>";
    return;
  }

  function taskCard(task) {
    return `
      <div class="card dashboard-result-card">
        <strong>
${
  task.priority === "high"
    ? "🔴"
    : task.priority === "medium"
    ? "🟡"
    : task.priority === "low"
    ? "🟢"
    : "⚫"
}
${task.title}
</strong>
${
  task.notes
    ? `<p class="task-notes">${task.notes}</p>`
    : ""
}
        <div class="meta-row">
          ${task.dueDate ? `<span class="badge date">📅 ${task.dueDate}</span>` : `<span class="badge">No date</span>`}
          ${task.priority ? `<span class="badge priority-${task.priority}">${task.priority}</span>` : ""}
          ${task.repeat && task.repeat !== "none" ? `<span class="badge">🔁 ${task.repeat}</span>` : ""}
          ${task.rotationEnabled ? `<span class="badge">🔄 Rotating</span>` : ""}
        </div>
      </div>
    `;
  }

  list.innerHTML = `
    ${overdueTasks.length ? `<h3>🔴 Overdue</h3>${overdueTasks.map(taskCard).join("")}` : ""}
    ${pendingTasks.length ? `<h3>📌 Pending</h3>${pendingTasks.map(taskCard).join("")}` : ""}
  `;
}

const manageCalendarsBtn =
  $("manageCalendarsBtn");

const manageCalendarsDialog =
  $("manageCalendarsDialog");

const closeCalendarsDialogBtn =
  $("closeCalendarsDialogBtn");

if (
  manageCalendarsBtn &&
  manageCalendarsDialog
) {
  manageCalendarsBtn.onclick = () => {
  renderExternalCalendars();
  manageCalendarsDialog.showModal();
};
}

if (
  closeCalendarsDialogBtn &&
  manageCalendarsDialog
) {
  closeCalendarsDialogBtn.onclick = () => {
    manageCalendarsDialog.close();
  };
}
const addExternalCalendarBtn =
  $("addExternalCalendarBtn");

const addCalendarDialog =
  $("addCalendarDialog");

const closeAddCalendarDialogBtn =
  $("closeAddCalendarDialogBtn");

const cancelAddCalendarBtn =
  $("cancelAddCalendarBtn");

if (
  addExternalCalendarBtn &&
  addCalendarDialog
) {
  addExternalCalendarBtn.onclick = () => {
    manageCalendarsDialog.close();
    addCalendarDialog.showModal();
  };
}

if (
  closeAddCalendarDialogBtn &&
  addCalendarDialog
) {
  closeAddCalendarDialogBtn.onclick = () => {
    addCalendarDialog.close();
    manageCalendarsDialog.showModal();
  };
}

if (
  cancelAddCalendarBtn &&
  addCalendarDialog
) {
  cancelAddCalendarBtn.onclick = () => {
    addCalendarDialog.close();
    manageCalendarsDialog.showModal();
  };
}
const externalCalendarsStorageKey =
  "familyHubExternalCalendars";

let externalCalendars = JSON.parse(
  localStorage.getItem(externalCalendarsStorageKey) || "[]"
);
externalCalendars = externalCalendars.map(calendar => {
  if (
    calendar.sourceType === "file" &&
    calendar.fileText
  ) {
    return {
      ...calendar,
      events: parseIcsEvents(calendar.fileText)
    };
  }

  return calendar;
});
function parseIcsDate(value) {
  if (!value) return "";

  const cleanValue = value.trim();

  // All-day date: 20260815
  if (/^\d{8}$/.test(cleanValue)) {
    return (
      `${cleanValue.slice(0, 4)}-` +
      `${cleanValue.slice(4, 6)}-` +
      `${cleanValue.slice(6, 8)}`
    );
  }


  // Date and time: 20260815T193000Z
  const match = cleanValue.match(
    /^(\d{4})(\d{2})(\d{2})T/
  );

  if (!match) return "";

  return `${match[1]}-${match[2]}-${match[3]}`;
}
function parseIcsTime(value) {
  if (!value) return "";

  const cleanValue = value.trim();

  // All-day event
  if (/^\d{8}$/.test(cleanValue)) {
    return "";
  }

  const match = cleanValue.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/
  );

  if (!match) return "";

  // UTC time - convert to UK local time
  if (cleanValue.endsWith("Z")) {
    const date = new Date(
      Date.UTC(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        Number(match[4]),
        Number(match[5])
      )
    );

    return date.toLocaleTimeString("en-GB", {
      timeZone: "Europe/London",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
  }

  // Local ICS time
  return `${match[4]}:${match[5]}`;
}
function addDaysToDateString(dateString, days) {
  const [year, month, day] = dateString
    .split("-")
    .map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}
function addMonthsToDateString(
  dateString,
  months
) {
  const [year, month, day] = dateString
    .split("-")
    .map(Number);

  const targetMonth =
    month - 1 + months;

  const targetYear =
    year + Math.floor(targetMonth / 12);

  const normalizedMonth =
    ((targetMonth % 12) + 12) % 12;

  const lastDayOfMonth =
    new Date(
      Date.UTC(
        targetYear,
        normalizedMonth + 1,
        0
      )
    ).getUTCDate();

  const safeDay = Math.min(
    day,
    lastDayOfMonth
  );

  const date = new Date(
    Date.UTC(
      targetYear,
      normalizedMonth,
      safeDay
    )
  );

  return date.toISOString().slice(0, 10);
}
function getIcsWeekdayCode(dateString) {
  const [year, month, day] = dateString
    .split("-")
    .map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  const weekdayCodes = [
    "SU",
    "MO",
    "TU",
    "WE",
    "TH",
    "FR",
    "SA"
  ];

  return weekdayCodes[
    date.getUTCDay()
  ];
}
function parseIcsRRule(rrule) {
  if (!rrule) return null;

  const rule = {};

  rrule.split(";").forEach(part => {
    const [key, value] = part.split("=");

    if (key && value) {
      rule[key] = value;
    }
  });

  return rule;
}
function expandRecurringEvent(event) {
  const rule = parseIcsRRule(event.rrule);

  if (!rule) {
    return [event];
  }

  const interval = Math.max(
    parseInt(rule.INTERVAL || "1", 10),
    1
  );

  const count = parseInt(rule.COUNT || "0", 10);

  const until = rule.UNTIL
    ? parseIcsDate(rule.UNTIL)
    : addDaysToDateString(
        new Date().toISOString().slice(0, 10),
        730
      );

 let recurrenceType;
let stepSize;

if (rule.FREQ === "DAILY") {
  recurrenceType = "days";
  stepSize = interval;
} else if (rule.FREQ === "WEEKLY") {
  recurrenceType = "days";
  stepSize = 7 * interval;
} else if (rule.FREQ === "MONTHLY") {
  recurrenceType = "months";
  stepSize = interval;
} else if (rule.FREQ === "YEARLY") {
  recurrenceType = "months";
  stepSize = 12 * interval;
} else {
  return [event];
}

  let durationDays = 0;

  if (
    event.endDate &&
    event.endDate > event.dueDate
  ) {
    const start = new Date(
      `${event.dueDate}T00:00:00Z`
    );

    const end = new Date(
      `${event.endDate}T00:00:00Z`
    );

    durationDays = Math.round(
      (end - start) / 86400000
    );
  }

  const occurrences = [];
  if (
  rule.FREQ === "WEEKLY" &&
  rule.BYDAY
) {
  const allowedDays = rule.BYDAY
    .split(",")
    .map(day =>
      day.replace(/^[+-]?\d+/, "")
    );

  let currentDate = event.dueDate;
  let occurrenceNumber = 0;
  let scannedDays = 0;

  while (
    currentDate &&
    currentDate <= until &&
    occurrenceNumber < 10000 &&
    scannedDays < 50000
  ) {
    const start = new Date(
      `${event.dueDate}T00:00:00Z`
    );

    const current = new Date(
      `${currentDate}T00:00:00Z`
    );

    const daysSinceStart = Math.floor(
      (current - start) / 86400000
    );

    const weekNumber = Math.floor(
      daysSinceStart / 7
    );

    const isActiveWeek =
      weekNumber % interval === 0;

    const weekday =
      getIcsWeekdayCode(currentDate);

    if (
      isActiveWeek &&
      allowedDays.includes(weekday)
    ) {
      occurrences.push({
        ...event,
        id: `${event.id}-${occurrenceNumber}`,
        dueDate: currentDate,
        endDate:
          durationDays > 0
            ? addDaysToDateString(
                currentDate,
                durationDays
              )
            : event.endDate
      });

      occurrenceNumber++;

      if (
        count &&
        occurrenceNumber >= count
      ) {
        break;
      }
    }

    currentDate = addDaysToDateString(
      currentDate,
      1
    );

    scannedDays++;
  }

  return occurrences;
}

  let currentDate = event.dueDate;
  let occurrenceNumber = 0;

  while (
    currentDate &&
    currentDate <= until &&
    occurrenceNumber < 10000
  ) {
    occurrences.push({
      ...event,
      id: `${event.id}-${occurrenceNumber}`,
      dueDate: currentDate,
      endDate:
        durationDays > 0
          ? addDaysToDateString(
              currentDate,
              durationDays
            )
          : event.endDate
    });

    occurrenceNumber++;

    if (
      count &&
      occurrenceNumber >= count
    ) {
      break;
    }

    currentDate =
  recurrenceType === "months"
    ? addMonthsToDateString(
        currentDate,
        stepSize
      )
    : addDaysToDateString(
        currentDate,
        stepSize
      );
  }

  return occurrences;
}
function parseIcsEvents(icsText) {
  if (!icsText) return [];

  // Join folded lines used by some ICS files
  const unfoldedText = icsText.replace(
    /\r?\n[ \t]/g,
    ""
  );

  const eventBlocks = unfoldedText.match(
    /BEGIN:VEVENT[\s\S]*?END:VEVENT/g
  ) || [];
console.log("Found VEVENT blocks:", eventBlocks.length);
  const parsedEvents = eventBlocks
    .map((block, index) => {
      function readField(fieldName) {
        const line = block
          .split(/\r?\n/)
          .find(line =>
            line.startsWith(`${fieldName}:`) ||
            line.startsWith(`${fieldName};`)
          );

        if (!line) return "";

        const separatorIndex = line.indexOf(":");

        return separatorIndex >= 0
          ? line.slice(separatorIndex + 1).trim()
          : "";
      }

      const title =
  readField("SUMMARY") ||
  readField("DESCRIPTION") ||
  "Untitled event";

      const startValue = readField("DTSTART");
const endValue = readField("DTEND");

const startDate =
  parseIcsDate(startValue);

const endDate =
  parseIcsDate(endValue);

const startTime =
  parseIcsTime(startValue);

const endTime =
  parseIcsTime(endValue);

      if (!startDate) return null;

      return {
        id:
          readField("UID") ||
          `external-event-${index}-${startDate}`,

        title: title
          .replace(/\\,/g, ",")
          .replace(/\\n/g, " ")
          .replace(/\\\\/g, "\\"),

        dueDate: startDate,
        endDate,
        startTime,
endTime,
        description: readField("DESCRIPTION")
          .replace(/\\n/g, "\n")
          .replace(/\\,/g, ","),

        location: readField("LOCATION")
  .replace(/\\,/g, ","),
  rrule: readField("RRULE"),

type: "external-event"
      };
    })
    .filter(Boolean);
 return parsedEvents.flatMap(
  expandRecurringEvent
);
}
function saveExternalCalendars() {
  localStorage.setItem(
    externalCalendarsStorageKey,
    JSON.stringify(externalCalendars)
  );
}

function renderExternalCalendars() {
  const list = $("externalCalendarsList");

  if (!list) return;

  if (!externalCalendars.length) {
    list.innerHTML = `
      <p class="empty">
        No external calendars added yet.
      </p>
    `;
    return;
  }

  list.innerHTML = externalCalendars
    .map(calendar => `
      <div class="calendar-source-row">
      <div class="calendar-source-main">
        <label>
          <input
  type="checkbox"
  data-toggle-calendar="${calendar.id}"
  ${calendar.enabled ? "checked" : ""}
>

          <strong>
  ${calendar.symbol || "📅"} ${calendar.name}
</strong>
        </label>

        <small>
  ${
    calendar.sourceType === "url"
      ? calendar.url
      : `Uploaded file: ${calendar.fileName}`
  }
</small>

<small>
  📅 ${calendar.events?.length || 0} events found
</small>
</div>
<button
  type="button"
  class="danger"
  data-remove-calendar="${calendar.id}"
>
  Remove
</button>
      </div>
    `)
    .join("");
    document
  .querySelectorAll("[data-toggle-calendar]")
  .forEach(checkbox => {
    checkbox.onchange = () => {
      const calendar = externalCalendars.find(
        item => item.id === checkbox.dataset.toggleCalendar
      );

      if (!calendar) return;

      calendar.enabled = checkbox.checked;

      saveExternalCalendars();
      renderCalendar();
    };
  });
document
  .querySelectorAll("[data-remove-calendar]")
  .forEach(button => {
    button.onclick = () => {
      const calendar = externalCalendars.find(
        item => item.id === button.dataset.removeCalendar
      );

      if (!calendar) return;

      if (!confirm(`Remove "${calendar.name}" calendar?`)) {
        return;
      }

      externalCalendars = externalCalendars.filter(
        item => item.id !== calendar.id
      );

      saveExternalCalendars();
      renderExternalCalendars();
      renderCalendar();
    };
  });
}

const saveExternalCalendarBtn =
  $("saveExternalCalendarBtn");

if (saveExternalCalendarBtn) {
  saveExternalCalendarBtn.onclick = async () => {
    const name =
      $("externalCalendarName").value.trim();
      const selectedSymbol =
  $("externalCalendarSymbol").value || "📅";
  const selectedColour =
  $("externalCalendarColour").value;

    const url =
      $("externalCalendarUrl").value.trim();

    const file =
      $("externalCalendarFile").files[0];

    if (!name) {
      alert("Please enter a calendar name.");
      return;
    }

    if (!url && !file) {
      alert(
        "Please enter a calendar URL or choose an .ics file."
      );
      return;
    }

    if (url && file) {
      alert(
        "Please use either a URL or a file, not both."
      );
      return;
    }

    let newCalendar;

    if (file) {
      if (
        !file.name.toLowerCase().endsWith(".ics")
      ) {
        alert("Please choose an .ics calendar file.");
        return;
      }

      const fileText = await file.text();

      newCalendar = {
  id: crypto.randomUUID(),
  name,
  symbol: selectedSymbol,
color:
  selectedColour === "auto"
    ? nextCalendarColour()
    : selectedColour,
  sourceType: "file",
  fileName: file.name,
  fileText,
  events: parseIcsEvents(fileText),
  enabled: true,
  addedAt: new Date().toISOString()
};
   } else {
  try {
    new URL(url);
  } catch {
    alert("Please enter a valid calendar URL.");
    return;
  }

  let events;

  try {
    events = await fetchExternalCalendarEvents(url);
  } catch (error) {
    console.error(
      "Calendar URL could not be loaded:",
      error
    );

    alert(
      "Family Hub could not load this calendar URL."
    );

    return;
  }

  newCalendar = {
    id: crypto.randomUUID(),
    name,
    symbol: selectedSymbol,
    color:
      selectedColour === "auto"
        ? nextCalendarColour()
        : selectedColour,
    sourceType: "url",
    url,
    events,
    enabled: true,
    addedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString()
  };
}
    renderExternalCalendars();
const alreadyExists = externalCalendars.some(calendar =>
  calendar.name.toLowerCase() === name.toLowerCase() ||
  (
    file &&
    calendar.sourceType === "file" &&
    calendar.fileName === file.name
  )
);

if (alreadyExists) {
  alert("This calendar has already been added.");
  return;
}

    externalCalendars.push(newCalendar);

saveExternalCalendars();
renderExternalCalendars();
renderCalendar();

    $("externalCalendarName").value = "";
    $("externalCalendarUrl").value = "";
    $("externalCalendarFile").value = "";

    addCalendarDialog.close();
    manageCalendarsDialog.showModal();
  };
}
const FAMILY_CALENDAR_FUNCTION_URL =
  "https://us-central1-family-hub-9b455.cloudfunctions.net/getFamilyCalendar";
  const EXTERNAL_CALENDAR_FUNCTION_URL =
  "https://us-central1-family-hub-9b455.cloudfunctions.net/fetchExternalCalendar";

async function fetchExternalCalendarEvents(calendarUrl) {
  const proxyUrl =
    `${EXTERNAL_CALENDAR_FUNCTION_URL}?url=` +
    encodeURIComponent(calendarUrl) +
    `&t=${Date.now()}`;

  const response = await fetch(proxyUrl, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(
      `Calendar request failed: ${response.status}`
    );
  }

  const icsText = await response.text();

  return parseIcsEvents(icsText);
}
async function refreshUrlCalendars() {
  const urlCalendars = externalCalendars.filter(
    calendar => calendar.sourceType === "url"
  );

  if (!urlCalendars.length) return;

  let updated = false;

  for (const calendar of urlCalendars) {
    try {
      calendar.events =
        await fetchExternalCalendarEvents(
          calendar.url
        );

      calendar.lastUpdated =
        new Date().toISOString();

      updated = true;

      console.log(
        `${calendar.name} synced: ${calendar.events.length} events`
      );
    } catch (error) {
      console.error(
        `Could not refresh ${calendar.name}:`,
        error
      );
    }
  }

  if (updated) {
    saveExternalCalendars();
    renderExternalCalendars();
    renderCalendar();
  }
}
async function refreshFamilyGoogleCalendar() {
  try {
   const response = await fetch(
  `${FAMILY_CALENDAR_FUNCTION_URL}?t=${Date.now()}`,
  {
    cache: "no-store"
  }
);

    if (!response.ok) {
      throw new Error(
        `Calendar request failed: ${response.status}`
      );
    }

    const icsText = await response.text();
    const events = parseIcsEvents(icsText);

    let calendar = externalCalendars.find(
      item => item.id === "google-family-calendar"
    );

    if (calendar) {
      calendar.events = events;
      calendar.lastUpdated = new Date().toISOString();
    } else {
      calendar = {
        id: "google-family-calendar",
        name: "Family",
        symbol: "👨‍👩‍👧‍👦",
        color: "blue",
        sourceType: "google-live",
        enabled: true,
        events,
        addedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };

      externalCalendars.push(calendar);
    }

    saveExternalCalendars();
    renderExternalCalendars();
    renderCalendar();

    console.log(
      `Family Google Calendar synced: ${events.length} events`
    );
  } catch (error) {
    console.error(
      "Family Google Calendar sync failed:",
      error
    );
  }
}
const refreshCalendarsBtn =
  $("refreshCalendarsBtn");

if (refreshCalendarsBtn) {
  refreshCalendarsBtn.onclick = async () => {
    refreshCalendarsBtn.disabled = true;
    refreshCalendarsBtn.textContent =
      "Refreshing…";

    await Promise.all([
      refreshFamilyGoogleCalendar(),
      refreshUrlCalendars()
    ]);

    refreshCalendarsBtn.textContent =
      "✓ Refreshed";

    setTimeout(() => {
      refreshCalendarsBtn.textContent =
        "Refresh all";
      refreshCalendarsBtn.disabled = false;
    }, 1200);
  };
}
refreshFamilyGoogleCalendar();
// Refresh Google Family calendar every 5 minutes
setInterval(
  refreshFamilyGoogleCalendar,
  5 * 60 * 1000
);
refreshUrlCalendars();

setInterval(
  refreshUrlCalendars,
  5 * 60 * 1000
);

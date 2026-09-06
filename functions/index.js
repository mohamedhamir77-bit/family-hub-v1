const {onRequest} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");

const familyCalendarUrl = defineSecret("FAMILY_CALENDAR_ICS_URL");

exports.getFamilyCalendar = onRequest(
  {
    secrets: [familyCalendarUrl],
    cors: true,
    maxInstances: 2,
  },
  async (request, response) => {
    try {
      const calendarUrl = familyCalendarUrl.value();

      const calendarResponse = await fetch(calendarUrl);

      if (!calendarResponse.ok) {
        throw new Error(
          `Google Calendar returned ${calendarResponse.status}`
        );
      }

      const icsText = await calendarResponse.text();

      if (!icsText.includes("BEGIN:VCALENDAR")) {
        throw new Error("Response was not a valid calendar feed");
      }

      response.set(
        "Content-Type",
        "text/calendar; charset=utf-8"
      );

      response.set(
        "Cache-Control",
        "public, max-age=300"
      );

      response.status(200).send(icsText);
    } catch (error) {
      console.error("Family calendar fetch failed:", error);

      response.status(500).json({
        error: "Unable to load family calendar",
      });
    }
  }
);
exports.fetchExternalCalendar = onRequest(
  {
    cors: true,
    maxInstances: 2,
  },
  async (request, response) => {
    try {
      const calendarUrl = String(
        request.query.url || ""
      );

      if (!calendarUrl) {
        return response.status(400).json({
          error: "Calendar URL is required",
        });
      }

      let parsedUrl;

      try {
        parsedUrl = new URL(calendarUrl);
      } catch {
        return response.status(400).json({
          error: "Invalid calendar URL",
        });
      }

      if (parsedUrl.protocol !== "https:") {
        return response.status(400).json({
          error: "Only HTTPS calendar URLs are allowed",
        });
      }

      const calendarResponse = await fetch(
        calendarUrl
      );

      if (!calendarResponse.ok) {
        throw new Error(
          `Calendar returned ${calendarResponse.status}`
        );
      }

      const icsText =
        await calendarResponse.text();

      if (!icsText.includes("BEGIN:VCALENDAR")) {
        throw new Error(
          "Response was not a valid calendar feed"
        );
      }

      if (
        Buffer.byteLength(icsText, "utf8") >
        5_000_000
      ) {
        return response.status(413).json({
          error: "Calendar file is too large",
        });
      }

      response.set(
        "Content-Type",
        "text/calendar; charset=utf-8"
      );

      response.set(
        "Cache-Control",
        "public, max-age=300"
      );

      response.status(200).send(icsText);
    } catch (error) {
      console.error(
        "External calendar fetch failed:",
        error
      );

      response.status(500).json({
        error: "Unable to load calendar",
      });
    }
  }
);
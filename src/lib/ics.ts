/** Gera arquivos .ics (iCalendar, RFC 5545) — padrão universal que Google Calendar, Outlook e Apple Calendar entendem via "assinar por URL". */

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function formatIcsDateTime(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

function formatIcsDate(isoDate: string): string {
  return isoDate.replace(/-/g, "");
}

function nextDayIso(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export type IcsEvent =
  | { uid: string; title: string; description?: string; start: Date; end: Date; allDay?: false }
  | { uid: string; title: string; description?: string; date: string; allDay: true };

export function buildIcsCalendar(events: Array<IcsEvent>, calendarName: string): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Seminário Huguenotes//Agenda//PT-BR",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
    "X-PUBLISHED-TTL:PT12H",
  ];

  for (const event of events) {
    lines.push("BEGIN:VEVENT", `UID:${event.uid}`, `DTSTAMP:${formatIcsDateTime(new Date())}`);
    if (event.allDay) {
      lines.push(
        `DTSTART;VALUE=DATE:${formatIcsDate(event.date)}`,
        `DTEND;VALUE=DATE:${formatIcsDate(nextDayIso(event.date))}`,
      );
    } else {
      lines.push(
        `DTSTART:${formatIcsDateTime(event.start)}`,
        `DTEND:${formatIcsDateTime(event.end)}`,
      );
    }
    lines.push(`SUMMARY:${escapeIcsText(event.title)}`);
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

// A messy event tracker system
// Difficulty: 2 - Multiple issues to fix

type Event = {
  id: number;
  name: string;
  date: Date;
  attendees: string[];
  location?: string;
  category?: "meeting" | "conference" | "workshop" | "other";
};

// Global event store
let events: Event[] = [];
let nextEventId = 1;

// Add event
function add_event(
  eventName: string,
  eventDate: Date,
  attendees: string[],
  location?: string,
  category?: "meeting" | "conference" | "workshop" | "other",
) {
  const event: Event = {
    id: nextEventId++,
    name: eventName,
    date: eventDate,
    attendees: attendees,
    location: location,
    category: category,
  };

  events.push(event);
  return event.id;
}

// Remove event
function removeEvent(eventId: number) {
  let idx = -1;
  for (let i = 0; i < events.length; i++) {
    if (events[i].id === eventId) {
      idx = i;
      break;
    }
  }

  if (idx >= 0) {
    events.splice(idx, 1);
    return true;
  }
  return false;
}

// Update event
function updateEvent(
  eventId: number,
  name?: string,
  date?: Date,
  attendees?: string[],
  location?: string,
  category?: "meeting" | "conference" | "workshop" | "other",
) {
  for (let i = 0; i < events.length; i++) {
    if (events[i].id === eventId) {
      if (name !== undefined) events[i].name = name;
      if (date !== undefined) events[i].date = date;
      if (attendees !== undefined) events[i].attendees = attendees;
      if (location !== undefined) events[i].location = location;
      if (category !== undefined) events[i].category = category;
      return true;
    }
  }
  return false;
}

// Add attendee to event
function addAttendeeToEvent(eventId: number, attendeeName: string) {
  for (let i = 0; i < events.length; i++) {
    if (events[i].id === eventId) {
      // Check if attendee already exists
      let exists = false;
      for (let j = 0; j < events[i].attendees.length; j++) {
        if (events[i].attendees[j] === attendeeName) {
          exists = true;
          break;
        }
      }

      if (!exists) {
        events[i].attendees.push(attendeeName);
      }
      return !exists;
    }
  }
  return false;
}

// Remove attendee from event
function removeAttendeeFromEvent(eventId: number, attendeeName: string) {
  for (let i = 0; i < events.length; i++) {
    if (events[i].id === eventId) {
      const initialLength = events[i].attendees.length;
      events[i].attendees = events[i].attendees.filter(
        (a) => a !== attendeeName,
      );
      return events[i].attendees.length !== initialLength;
    }
  }
  return false;
}

// Get events by date range
function getEventsByDateRange(startDate: Date, endDate: Date) {
  const result = [];
  for (let i = 0; i < events.length; i++) {
    if (events[i].date >= startDate && events[i].date <= endDate) {
      result.push(events[i]);
    }
  }
  return result;
}

// Get events by category
function getEventsByCategory(
  category: "meeting" | "conference" | "workshop" | "other",
) {
  return events.filter((e) => e.category === category);
}

// Example usage
add_event(
  "Team Meeting",
  new Date("2023-06-15T10:00:00"),
  ["Alice", "Bob", "Charlie"],
  "Conference Room A",
  "meeting",
);

add_event(
  "JavaScript Workshop",
  new Date("2023-06-20T14:00:00"),
  ["David", "Eve"],
  "Training Center",
  "workshop",
);

console.log("All events:", events);
addAttendeeToEvent(1, "Frank");
console.log("Events after adding Frank:", events);

export {
  add_event,
  addAttendeeToEvent,
  events,
  getEventsByCategory,
  getEventsByDateRange,
  removeAttendeeFromEvent,
  removeEvent,
  updateEvent,
};

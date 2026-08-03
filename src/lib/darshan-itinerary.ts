/**
 * Suggested darshan itinerary shown to guests from the room QR page.
 *
 * Plain data rather than markup so the same content can be reused elsewhere
 * (a printed card, WhatsApp message) without duplicating it.
 */
export type ItineraryDay = {
  title: string;
  stops: { time: string; detail: string }[];
};

export const DARSHAN_ITINERARY: ItineraryDay[] = [
  {
    title: "Day 1 — Arrival & Heart of Ujjain",
    stops: [
      {
        time: "8:00 AM – 11:00 AM",
        detail:
          "Arrive, check into your hotel, and head straight to the Shri Mahakaleshwar Jyotirlinga Temple for your main darshan. Book a Sheeghra Darshan (quick-entry) pass online or at the gate to save hours.",
      },
      {
        time: "1:00 PM – 3:00 PM",
        detail: "Visit the nearby Bade Ganeshji ka Mandir and Harsiddhi Mata Shaktipeeth Temple.",
      },
      {
        time: "5:30 PM – 8:00 PM",
        detail:
          "Head to Ram Ghat on the Shipra River for the evening sunset aarti, then walk through the illuminated Mahakal Lok Corridor.",
      },
    ],
  },
  {
    title: "Day 2 — Heritage & Guardian Temples",
    stops: [
      {
        time: "6:00 AM – 8:00 AM",
        detail:
          "Visit the powerful Shri Kaal Bhairav Mandir, traditionally visited to complete the Ujjain pilgrimage.",
      },
      {
        time: "9:00 AM – 12:00 PM",
        detail:
          "Take an auto-rickshaw to cover Mangalnath Temple, Sandipani Ashram and Gadhkalika Mata Temple.",
      },
      {
        time: "Afternoon",
        detail: "Relax, pick up local sweets, and depart for your return journey.",
      },
    ],
  },
  {
    title: "Day 3 — Day Trip to Omkareshwar",
    stops: [
      {
        time: "6:00 AM – 7:00 PM",
        detail:
          "Omkareshwar Jyotirlinga — take a cab or bus (approx. 80–110 km, around 3 hours each way) to visit the sacred island shrine on the Narmada River.",
      },
    ],
  },
  {
    title: "Day 4 — Return",
    stops: [{ time: "9:00 AM – 10:00 AM", detail: "Check-out." }],
  },
];

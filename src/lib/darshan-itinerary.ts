/**
 * Suggested darshan itinerary shown to guests from the room QR page.
 *
 * Plain data rather than markup so the same content can be reused elsewhere
 * (a printed card, WhatsApp message) without duplicating it.
 *
 * Offered in English, Hindi and Gujarati: most pilgrims arriving in Ujjain
 * read one of those far more comfortably than English. The translations are
 * written to read naturally rather than word-for-word, and temple names are
 * transliterated into each script so they still match the signage guests will
 * actually see (श्री महाकालेश्वर, શ્રી મહાકાલેશ્વર).
 */

export type ItineraryLanguage = "en" | "hi" | "gu";

export type ItineraryDay = {
  title: string;
  stops: { time: string; detail: string }[];
};

export const ITINERARY_LANGUAGES: {
  code: ItineraryLanguage;
  /** Shown on the switcher — in the language itself, not translated. */
  label: string;
}[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "gu", label: "ગુજરાતી" },
];

/** Dialog heading per language. */
export const ITINERARY_TITLE: Record<ItineraryLanguage, string> = {
  en: "Temple Darshan Information",
  hi: "मंदिर दर्शन जानकारी",
  gu: "મંદિર દર્શન માહિતી",
};

/** Closing note under the itinerary. */
export const ITINERARY_FOOTNOTE: Record<ItineraryLanguage, string> = {
  en: "Timings are a suggestion and may vary. Please call reception if you would like help arranging a taxi.",
  hi: "समय केवल सुझाव है और इसमें बदलाव हो सकता है। टैक्सी की व्यवस्था में सहायता चाहिए तो कृपया रिसेप्शन पर संपर्क करें।",
  gu: "સમય માત્ર સૂચન છે અને તેમાં ફેરફાર થઈ શકે છે. ટેક્સીની વ્યવસ્થામાં મદદ જોઈતી હોય તો કૃપા કરીને રિસેપ્શનનો સંપર્ક કરો.",
};

export const DARSHAN_ITINERARY_BY_LANGUAGE: Record<ItineraryLanguage, ItineraryDay[]> = {
  en: [
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
  ],

  hi: [
    {
      title: "दिन 1 — आगमन और उज्जैन का हृदय",
      stops: [
        {
          time: "सुबह 8:00 – 11:00",
          detail:
            "पहुँचकर होटल में चेक-इन करें और सीधे श्री महाकालेश्वर ज्योतिर्लिंग मंदिर में मुख्य दर्शन के लिए जाएँ। घंटों की प्रतीक्षा से बचने के लिए शीघ्र दर्शन पास ऑनलाइन या गेट पर बुक कर लें।",
        },
        {
          time: "दोपहर 1:00 – 3:00",
          detail: "पास ही स्थित बड़े गणेशजी का मंदिर और हरसिद्धि माता शक्तिपीठ मंदिर के दर्शन करें।",
        },
        {
          time: "शाम 5:30 – 8:00",
          detail:
            "शिप्रा नदी के राम घाट पर संध्या आरती में सम्मिलित हों, फिर जगमगाते महाकाल लोक कॉरिडोर में टहलें।",
        },
      ],
    },
    {
      title: "दिन 2 — विरासत और रक्षक मंदिर",
      stops: [
        {
          time: "सुबह 6:00 – 8:00",
          detail:
            "श्री काल भैरव मंदिर के दर्शन करें — उज्जैन यात्रा पूर्ण मानने के लिए परंपरा से यहाँ अवश्य जाया जाता है।",
        },
        {
          time: "सुबह 9:00 – दोपहर 12:00",
          detail:
            "ऑटो-रिक्शा से मंगलनाथ मंदिर, सांदीपनि आश्रम और गढ़कालिका माता मंदिर के दर्शन करें।",
        },
        {
          time: "दोपहर बाद",
          detail: "आराम करें, स्थानीय मिठाइयाँ लें और वापसी की यात्रा के लिए प्रस्थान करें।",
        },
      ],
    },
    {
      title: "दिन 3 — ओंकारेश्वर की एक दिवसीय यात्रा",
      stops: [
        {
          time: "सुबह 6:00 – शाम 7:00",
          detail:
            "ओंकारेश्वर ज्योतिर्लिंग — नर्मदा नदी के पवित्र द्वीप स्थित मंदिर के दर्शन हेतु कैब या बस लें (लगभग 80–110 किमी, एक ओर से लगभग 3 घंटे)।",
        },
      ],
    },
    {
      title: "दिन 4 — प्रस्थान",
      stops: [{ time: "सुबह 9:00 – 10:00", detail: "चेक-आउट।" }],
    },
  ],

  gu: [
    {
      title: "દિવસ 1 — આગમન અને ઉજ્જૈનનું હૃદય",
      stops: [
        {
          time: "સવારે 8:00 – 11:00",
          detail:
            "પહોંચીને હોટેલમાં ચેક-ઇન કરો અને સીધા શ્રી મહાકાલેશ્વર જ્યોતિર્લિંગ મંદિરમાં મુખ્ય દર્શન માટે જાઓ. કલાકોની રાહ ટાળવા માટે શીઘ્ર દર્શન પાસ ઓનલાઇન અથવા ગેટ પર બુક કરી લો.",
        },
        {
          time: "બપોરે 1:00 – 3:00",
          detail: "નજીકમાં આવેલા બડે ગણેશજી કા મંદિર અને હરસિદ્ધિ માતા શક્તિપીઠ મંદિરના દર્શન કરો.",
        },
        {
          time: "સાંજે 5:30 – 8:00",
          detail:
            "શિપ્રા નદીના રામ ઘાટ પર સંધ્યા આરતીમાં જોડાઓ, પછી ઝગમગતા મહાકાલ લોક કોરિડોરમાં ફરો.",
        },
      ],
    },
    {
      title: "દિવસ 2 — વારસો અને રક્ષક મંદિરો",
      stops: [
        {
          time: "સવારે 6:00 – 8:00",
          detail:
            "શ્રી કાલ ભૈરવ મંદિરના દર્શન કરો — ઉજ્જૈન યાત્રા પૂર્ણ ગણવા માટે પરંપરાગત રીતે અહીં અવશ્ય જવાય છે.",
        },
        {
          time: "સવારે 9:00 – બપોરે 12:00",
          detail:
            "ઓટો-રિક્ષા લઈને મંગલનાથ મંદિર, સાંદીપનિ આશ્રમ અને ગઢકાલિકા માતા મંદિરના દર્શન કરો.",
        },
        {
          time: "બપોર પછી",
          detail: "આરામ કરો, સ્થાનિક મીઠાઈઓ ખરીદો અને પરત યાત્રા માટે પ્રસ્થાન કરો.",
        },
      ],
    },
    {
      title: "દિવસ 3 — ઓંકારેશ્વરની એક દિવસની યાત્રા",
      stops: [
        {
          time: "સવારે 6:00 – સાંજે 7:00",
          detail:
            "ઓંકારેશ્વર જ્યોતિર્લિંગ — નર્મદા નદીના પવિત્ર ટાપુ પર આવેલા મંદિરના દર્શન માટે કેબ અથવા બસ લો (આશરે 80–110 કિમી, એક તરફ લગભગ 3 કલાક).",
        },
      ],
    },
    {
      title: "દિવસ 4 — પ્રસ્થાન",
      stops: [{ time: "સવારે 9:00 – 10:00", detail: "ચેક-આઉટ." }],
    },
  ],
};

/** Kept so any existing import of the English itinerary keeps working. */
export const DARSHAN_ITINERARY: ItineraryDay[] = DARSHAN_ITINERARY_BY_LANGUAGE.en;

// Everything a customer can click on the AskBo page.
//
// Every option links to its AirAsia support page. `ask: true` means the airasia-gen knowledge
// base covers it (checked against the enabled English articles and a live probe of the agent),
// so a click sends the option's title to Bo instead. Options without `ask` only open the page.

export const HANDLE = "airasia-gen";

const S = "https://support.airasia.com";

export const HERO = {
  title: "Hi, I’m Bo",
  lead: "Ask me anything about your AirAsia flights, bookings and travel. I’m here 24/7.",
};

// "Popular Articles" on support.airasia.com. All five are enabled articles in Bo's knowledge.
export const POPULAR = [
  { title: "AirAsia Flights: Things you need to know about our checked baggage policy", url: `${S}/s/article/What-I-need-to-know-about-checked-baggage?language=en_GB`, ask: true },
  { title: "AirAsia Flights: All you need to know about our cabin baggage policy", url: `${S}/s/article/What-are-the-rules-for-cabin-baggage-on-board?language=en_GB`, ask: true },
  { title: "AirAsia Flights: How do I change my flight date or time?", url: `${S}/s/article/How-do-I-perform-flight-change?language=en_GB`, ask: true },
  { title: "AirAsia Flights: What items are prohibited from being carried in my baggage for other carrier code?", url: `${S}/s/article/What-items-are-prohibited-en?language=en_GB`, ask: true },
  { title: "AirAsia Flights: Upgrading Your Baggage Allowance", url: `${S}/s/article/How-do-I-upgrade-my-baggage-allowance-en?language=en_GB`, ask: true },
];

// The service tiles on the support home page, in the same order.
export const SERVICES = [
  { title: "Flights", icon: "Flights.png", url: `${S}/s/topiccatalog?language=en_GB`, ask: true },
  { title: "Hotels", icon: "Hotel.png", url: `${S}/s/topic/0TO7F000000TQYDWA4/hotel?language=en_GB` },
  { title: "SNAP", icon: "snap.png", url: `${S}/s/topic/0TO2u0000004EkHGAU/snap?language=en_GB`, ask: true },
  { title: "Gifts", icon: "Gifts.png", url: `${S}/s/topic/0TO2u0000004Er1GAE/gift?language=en_GB` },
  { title: "Ride", icon: "ride.png", url: `${S}/s/topic/0TO2u0000004FH3GAM/ride?language=en_GB`, ask: true },
  { title: "Asean Pass", icon: "SuperApp.png", url: "https://www.airasia.com/unlimited/en/gb/faq", ask: true },
  { title: "bigpay", icon: "Bigpay.png", url: `${S}/s/topic/0TO2u000000U7jRGAS/bigpay?language=en_GB`, ask: true },
  { title: "bigpay pocket", icon: "Pocket.png", url: `${S}/s/topic/0TO7F000000TQYNWA4/pocket?language=en_GB`, ask: true },
  { title: "Duty Free", icon: "travelmall.png", url: `${S}/s/topic/0TO2u0000004Er2GAE/dutyfree?language=en_GB`, ask: true },
  { title: "Rewards", icon: "big.png", url: `${S}/s/topic/0TO2u0000004Er3GAE/rewards?language=en_GB`, ask: true },
  { title: "Xchange", icon: "BigXchange.png", url: `${S}/s/article/Rewards-Malaysia-Earn-airasia-points?language=en_GB#AirAsia-Xchange`, ask: true },
  { title: "Ikhlas", icon: "Iklas.png", url: "https://api.whatsapp.com/send/?phone=60105246864" },
  { title: "Insurance", icon: "Insurance.png", url: `${S}/s/topic/0TO2u0000004EmjGAE/insurance?language=en_GB`, ask: true },
  { title: "ZoneUp", icon: "ZoneUp.png", url: "https://upgrade.plusgrade.com/offer/AirAsia", ask: true },
];

// The "Topics" menu on the support site.
const T = (id, slug) => `${S}/s/topic/${id}/${slug}?language=en_GB`;
export const TOPICS = [
  { title: "About AirAsia", url: T("0TO2u000000CuPDGA0", "about-airasia") },
  { title: "Any Airlines", url: T("0TO7F000000TQYSWA4", "any-airlines"), ask: true },
  { title: "Asean Pass", url: T("0TO2u000000CusPGAS", "asean-pass"), ask: true },
  { title: "Baggage", url: T("0TO2u000000CuPXGA0", "baggage"), ask: true },
  { title: "BigPay", url: T("0TO2u000000U7jRGAS", "bigpay"), ask: true },
  { title: "BigPay Pocket", url: T("0TO7F000000TQYNWA4", "bigpay-pocket"), ask: true },
  { title: "Booking", url: T("0TO7F000000TQY3WAO", "booking"), ask: true },
  { title: "Check-in", url: T("0TO7F000000TQY8WAO", "checkin"), ask: true },
  { title: "Duty-Free", url: T("0TO2u0000004Er2GAE", "dutyfree"), ask: true },
  { title: "Gifts", url: T("0TO2u0000004Er1GAE", "gifts") },
  { title: "Hotels", url: T("0TO7F000000TQYDWA4", "hotels") },
  { title: "Inflights", url: T("0TO2u000000CuPrGAK", "inflights"), ask: true },
  { title: "Insurance", url: T("0TO2u0000004EmjGAE", "insurance"), ask: true },
  { title: "Member Account", url: T("0TO2u000000CuQ6GAK", "member-account"), ask: true },
  { title: "Payment And Fees", url: T("0TO7F000000TQYIWA4", "payment-and-fees"), ask: true },
  { title: "Products & Services", url: T("0TO2u000000CuQLGA0", "products-services") },
  { title: "Promotions", url: T("0TO2u000000CuPRGA0", "promotions"), ask: true },
  { title: "Rewards", url: T("0TO2u0000004Er3GAE", "rewards"), ask: true },
  { title: "Ride", url: T("0TO2u0000004FH3GAM", "ride"), ask: true },
  { title: "Seat", url: T("0TO2u000000CuQVGA0", "seat"), ask: true },
  { title: "SNAP", url: T("0TO2u0000004EkHGAU", "snap"), ask: true },
  { title: "Special Guests", url: T("0TO2u000000CuQMGA0", "special-guests"), ask: true },
  { title: "Travel Guidance", url: T("0TO2u000000CuQWGA0", "travel-guidance"), ask: true },
  { title: "Wheelchair", url: T("0TO2u000000CuQaGAK", "wheelchair"), ask: true },
  { title: "More Topics…", url: `${S}/s/topiccatalog?language=en_GB` },
];

export const LINKS = {
  home: `${S}/s/?language=en_GB`,
  myCases: "https://www.airasia.com/member/mycases/?s=csm",
  search: (q) => `${S}/s/global-search/${encodeURIComponent(q)}?language=en_GB`,
  airasia: "https://www.airasia.com/en/gb",
  terms: "https://www.airasia.com/my/en/about-us/terms-of-use.page",
  privacy: "https://www.airasia.com/my/en/about-us/privacy-policy.page",
};

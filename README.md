# AskBo AI Mode

A mockup of AirAsia support with a full-page chat with **Bo**, driven by the `airasia-gen` Ada AI
agent through Ada's **headless Embed SDK** (`embed2.js`).

Live: https://jiapengchua.github.io/askbo/

## How it talks to Bo

- `embed2.js` auto-starts in headless mode (`headless: true`, `enableProgrammaticControl: true`,
  `<script id="__ada" data-handle>`). The page draws everything itself.
- **The conversation opens on page load**, before the customer clicks anything. The page sends a
  throwaway opener (`Hi`) and polls `getMessages()` until Bo's welcome has arrived and gone quiet
  (~8–12 s after the SDK is ready). By the time someone asks, the chat is already warm.
  The opener has to come first because after a `reset()` Ada creates the chatter on the first send
  and drops that message.
- Questions go out with `sendMessage(text)` (a plain string, 500-character limit, at least 4 s apart
  because Ada rate-limits faster sends; `RATE_LIMITED` is retried).
- Replies come from `ada:message:received` **and** a `getMessages()` poll while a reply is due, de-duplicated by id.
- A question asked before the conversation is ready is queued and sent when it is.
- The welcome is never shown: anything Bo sends before the customer's first question is held back.
- **New chat** calls `reset()` and opens a fresh conversation the same way.

### Quirks found while building it (all live on airasia-gen)

- `sendMessage()` resolves to `{ id: <client uuid> }`. `getMessages()` then lists that message first
  under the client id and later under the server id. User bubbles are therefore drawn by the page,
  never from Ada's copy.
- `getMessages()` returns a reply while it is still streaming ("I", then half the answer, then all of
  it). The streamed copy and the final message have **different ids**, so a message whose text extends
  the previous bubble updates that bubble instead of adding a new one.
- `airasia-gen` has `persistence: private`, so each page load gets a new chatter and there's no earlier
  chat to resume. The page resumes from `getMessages()` on bots that do persist.
- **Rich messages render.** On this bot the SDK delivers buttons and images in full:
  - `quick_replies` (`data.quickReplies` = label/value/buttonType) are drawn as buttons and answered with
    `adaEmbed.selectQuickReply(messageId, index)`, falling back to sending the label as text. Older
    buttons are disabled once the customer moves on. Replies with a `card` render as image cards.
  - `picture` (`data.picUrl`), e.g. the travel-notice "Disrupted flights" cards. Back-to-back pictures share
    one swipeable carousel, and an image that fails to load becomes a link card.
  - `link`, `video`, file, `widget`, `options_message` and `surfaceable_list_selection` have renderers too.
    Any other row with a URL in it shows as a link or image, so nothing is silently dropped.
- Markdown tables (Bo sends them for disruption lists) render as real tables, with status pills
  (Suspend / Moved / On time). On a phone each row becomes a card.

## Quick options

The options are AirAsia's own, from https://support.airasia.com/s/?language=en_GB: the five
**Popular articles**, the fourteen **service tiles** and the **Topics** menu. They're listed in
[content.js](content.js).

Every option has its AirAsia URL. If Bo's knowledge supports the option (`ask: true`), a click
sends its title to Bo (tiles, panel chips and the header Topics menu alike), and the ↗ icon still opens the page. Otherwise the click only opens the page in a
new tab.

Support was checked two ways: against the enabled English articles in airasia-gen's knowledge base
(7,408 articles, 320 from the support site), and by sending each title to the live agent.

| Opens the page only | Why |
| --- | --- |
| Hotels, Gifts | No support-site articles. Only scraped listing and product pages. |
| Ikhlas | No knowledge. Bo deflects. The tile goes to WhatsApp, as on the live site. |
| About AirAsia, Products & Services | Too broad. Bo only asks a clarifying question. |
| More Topics…, My Cases | Navigation. |

Single-word titles ("Ride", "Baggage") usually get a clarifying question from Bo. That's expected:
the title is what gets sent.

## Requirements

- The page's origin must be on airasia-gen's **iframe allow list** (Settings → Security → Chat), as a
  bare origin with no trailing slash. The list currently holds only `http://*.airasia.com`, so
  `https://jiapengchua.github.io` must be added before the GitHub Pages copy can connect. Without it
  the status reads "Bo is unavailable on this page" after 20 s.
- Local testing without touching the allow list: serve the folder on `127.0.0.1:8765` and start Chrome
  with `--host-resolver-rules="MAP askbo-test.airasia.com:80 127.0.0.1:8765"`, then open
  `http://askbo-test.airasia.com/`.

## Query flags

- `?debug` logs SDK events to the console. `window.__askbo` holds the state and a trace in every mode.
- `?reset` forces a fresh conversation on load.

## Notes

- Images (logo, header, Bo avatar, service icons) are from support.airasia.com. Fonts are Maven Pro
  and Roboto, as on the support site.
- Ada demo mockup, not an official AirAsia page.

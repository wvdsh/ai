# Publishing

Canonical docs:

- Upload a build: https://docs.wavedash.com/publishing/upload
- Publish a build: https://docs.wavedash.com/publishing/publish
- Embedding a game: https://docs.wavedash.com/publishing/embed
- Metadata: https://docs.wavedash.com/publishing/metadata
- Monetization: https://docs.wavedash.com/publishing/monetization
- Content guidelines: https://docs.wavedash.com/publishing/content-guidelines

## Upload versus publish

Uploading creates an immutable build. Publishing makes one uploaded build live
for players. Do not publish unless the user explicitly asks to make the build
live.

CLI flow:

```bash
wavedash build push
wavedash publish BUILD_ID --yes   # --yes is required without a terminal
```

Developer Portal flow:

1. Open the game in Developer Portal.
2. Go to Builds.
3. Upload a build folder or zip.
4. Publish the selected build when ready.

## Store page

Before launch, guide the user to prepare:

- clear title
- description of at least 80 characters, opening with a one-sentence hook
  (required)
- 16:9 cover art (at least 250×140) that shows the title and no other text
  (required)
- a preview video: 16:9 MP4/WebM/MOV, 5 s–5 min, up to 200 MB (required)
- at least one tag, input method, and supported language (required)
- monetization (optional Paid Content)

There are no screenshot or trailer fields on the store listing.

## Content rules

Games must not include or promote:

- cryptocurrency, NFT, or blockchain features
- real-money gambling
- hateful targeting based on protected characteristics
- impersonation of other games
- browser-crashing behavior

Games using Paid Content must offer free gameplay before any paywall. Every
game's title must be primarily in Latin script.

Also check:

- game loads reliably
- browser tab does not crash
- expected progress is saved
- cover art is 16:9, includes the game title, and does not include extra text

## Final launch check

- Correct game ID and build ID.
- Production build uploaded, not a dev artifact.
- SDK init and requested SDK features work.
- Game tested on Wavedash in a fresh browser.
- Metadata, monetization, and content guidelines reviewed.

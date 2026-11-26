[![make.fun · news-image-20261126](https://make.fun/badge/news-image-20261126.svg)](https://make.fun/bounty/news-image-20261126?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261126)
[![rank](https://make.fun/badge/news-image-20261126/anisakansa/news-image-20261126/rank.svg)](https://make.fun/bounty/news-image-20261126/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261126)
[![reward](https://make.fun/badge/news-image-20261126/anisakansa/news-image-20261126/reward.svg)](https://make.fun/bounty/news-image-20261126?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261126)

# news-image-20261126

Sum up 26 November's world news in one image.

A newspaper front page — **THE WORLD TODAY, THURSDAY 26 NOVEMBER 2026** — drawn by a deterministic Node 22 program (`main.ts`, standard library only). It renders a 1024×1024 PNG with a hand-rolled PNG encoder (zlib deflate + manual CRC32 table) and an embedded 5×7 bitmap font. No network, no clock, no randomness: two runs produce byte-identical output.

## The day's news

Three leads:

- **Trump tariffs rock markets** — the US unveils new tariffs for 14 trading partners (China 20%); Nasdaq sinks 4.4%, Dow −1,039.
- **Shenzhou-24 reaches orbit** — the first Pakistani in orbit aboard China's Tiangong station.
- **Thanksgiving Day in America** — an East Coast storm brings rain and high winds for the holiday.

Plus 22 more stories across six regions (Europe, Middle East, North America, Asia-Pacific, Africa, Latin America) and a Tech / Science / Sport strip (BepiColombo at Mercury, IPL 2027 auction, Gukesh vs Sindarov, Sooryavanshi's 204).

## Run

```sh
mkdir -p output && MAKEFUN_OUTPUT_DIR=output node main.ts
```

Writes `output/entry.png` (1024×1024, under 1 MiB).

## Entry

Built for the [make.fun](https://make.fun/bounty/news-image-20261126) bounty `news-image-20261126`.

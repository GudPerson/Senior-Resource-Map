# CareAround SG performance review, 20 November 2026

The local candidate reduces the initial download on Discover, Help, My Directory, Care Maps and Admin. It also reduces repeated work while searching, selecting addresses and formatting schedules. Cold page load time improved most clearly on Admin. The other measured landing times stayed close to the baseline.

The comparison uses commit `0edfd09fddc7eb736672d3b1c4067e706ce1f0a1` and the uncommitted `codex/app-performance-20261120` worktree. All measurements use local builds and fictional records. Deployment is pending a separate release decision.

## What a user would notice

| Workflow | Before | After | What was measured |
| --- | ---: | ---: | --- |
| Open Discover | 753 KB | 490 KB | Cold app download |
| Open My Directory | 777 KB | 514 KB | Cold app download |
| Open an owner Care Map | 1,053 KB | 790 KB | Cold app download |
| Open a shared Care Map | 890 KB | 627 KB | Cold app download |
| Open Help | 794 KB | 505 KB | Cold app download |
| Open Admin | 999 KB | 573 KB | Cold app download |
| Open Admin and choose the first Excel workbook | 999 KB | 736 KB | Cumulative download through workbook validation |
| Type in Discover with 3,300 resources | 32.74 ms | 3.25 ms | Repeated search calculation |
| Update the master checkbox with 52,911 matching addresses and a sparse selection | 10.94 ms | 0.42 ms | Selection-state calculation |
| Group 300 calendar events, build the day's timeline and format its labels | 9.4 ms | 0.7 ms | Browser CPU |
| Preview 24 programme schedule entries | 7.4 ms | 0.5 ms | Browser CPU |

KB are decimal. Download measurements count each distinct local app file once on a cold visit, using gzip level 6 for text and the actual image size. Map tiles, API payloads, response headers and external assets are outside these counts. The standalone regional directory embed held steady at about 348 KB.

In seven alternating before/after pairs per route on the final build, a local HTTP/2 connection simulated 30 ms latency, 1.5 MB/s downlink and double CPU slowdown. The median time until the Admin heading appeared fell from 935 to 799 ms. Discover’s first visible result took 564 vs 562 ms, sign-in 501 vs 501 ms, Help 785 vs 786 ms and Calendar 800 vs 797 ms. Two earlier build comparisons also recorded a shorter Admin wait. Changes of a few milliseconds should be read within the variation of this local benchmark.

For large-list calculations, the displayed Node measurements are medians across three interleaved processes per version. Competing local jobs affected absolute timings. A lighter repeat also favoured the candidate. Deterministic work counts give a second check. Sorting the 3,300-resource catalogue took 3,300 date conversions, down from 68,380. The area picker went from 4,245,660 to 4,120 key constructions when checking whether 2,060 selected resources were visible. The selection and address metrics cover work after results arrive. Whole-region network scan duration remains unmeasured.

## Changes and trade-offs

- The app header can use a 192-pixel logo. Chromium used it at 1×, 2× and 3× screen densities. It selected the original 640-pixel image at 4× and in print preview at all four densities on both 320px and 1440px layouts. The two map print layouts explicitly request the original. A mobile check caught a 4px overflow when the image sources sat directly in the navbar flex layout. Grouping them as one item restored the 320px width.
- Help loads the editor only after an authorized owner opens the management view. Admin fetches the Excel reader when someone chooses a workbook. CSV opens directly. If the reader download fails, the interface explains how to recover by refreshing and choosing the same file.
- Discover prepares searchable catalogue text and sort dates once per catalogue update. Location, favourites and region filters still run against current state. The index used about 41–379 KiB of additional retained heap in the 3,300-record Node fixture, depending on the active filter.
- The resource picker indexes visible keys. Address selection checks the smaller of the two sets of IDs. Filtering, paging, selecting all matches, copy and full/selected/filtered CSV keep their existing scope.
- The client and server reuse fixed Singapore date/time formatters. Locale-dependent output still uses the requested locale. The server also prepares its location membership sets once per badge calculation. On Node, 1,000 resource badges took 2.23 vs 0.75 ms and a 32-session schedule summary took 4.19 vs 0.21 ms.

Two experiments were dropped. Loading Discover and sign-in later reduced some downloads but delayed the first useful screen in the throttled browser. Both routes retained their original startup path. A proposed server lookup change touched the source bound to the regional directory's historical fixtures. It was removed after regeneration changed 11 of 12 fixture responses. The reference source and fixture files are preserved.

## Acceptance and coverage

| Check | Result |
| --- | --- |
| Repository quality suite | 1,529 server tests, 1,435 client tests, five environment checks, 54 address snapshot checks, 73 Help CMS checks, static validation and production-configured client build passed. The existing optional Wrangler Pages matcher test was skipped. |
| User journeys | 22 scenarios passed three times on each build in fresh Chromium profiles. All 66 pairs matched by API method, path and call count, with 555 calls per build, zero uncaught errors and zero unexpected writes. They cover Discover and its filters, phones at emulated sizes, sign-in, access denial, Help and Guide, My Directory, owner/shared maps, regional embed, Admin, Calendar, resources and CSV/Excel validation. |
| Directory, selection and exports | 24 full ranked-result comparisons and 16 mounted search states across desktop and phone-sized viewports. All 53 area-picker checks passed on the final source, covering filtering, select-all scope, off-screen selection, interrupted queries, pagination and the actual CSV outputs. All nine short-screen combinations passed the viewport and map-position assertions. |
| Map and Help | 116 map lockdown checks. The default and Gray map zoom and export runs each passed 70 checks, including PNG/PDF. The Help reader passed 10 browser cases and the owner editor passed 18. |
| API and dates | Eight real route handlers against a disposable PGlite database. All 64 paired requests matched by response body and SQL statement count. Another 400 randomized badge/schedule comparisons matched. Calendar output checks included four app languages and date rollovers. |
| Workbook errors | Blocking the Excel reader left CSV usable. Reloading and choosing the same workbook succeeded. A corrupt workbook still showed its distinct parser error. The check observed zero API writes. |

Five assertions in the existing owner Help browser test failed on the unmodified release because it expected the stored wording “My Maps” where the product displays “Care Maps”. The display assertions now follow the established display terminology. The authored and saved content assertions were retained. The map zoom test sometimes found no decoded background tile at its fixed 650 ms observation point. The same assertion failed on the unmodified baseline and on the candidate when other local checks were running. The assertion and timing threshold were kept. This is an existing intermittent result. Its exact cause is undetermined.

These checks used local Chromium, fictional accounts and datasets, emulated mobile viewports and a local database. Physical phones, Safari, production database load, third-party services and real signed-in sessions remain unmeasured.

## Repeating the checks

From the performance worktree, install the lockfile dependencies with `npm ci`, then run `npm run verify:quality`. For the address and resource chooser, run `node tests/browser/care-map-area-resources.mjs`. For the map/export check, run `node tests/browser/care-map-export-zoom.mjs --rounds=2`. Browser tests need a local Chromium installation and permission to listen on loopback.

The local evidence directory contains the browser scripts, individual measurements, before/after reports, source hashes and reproduction notes for the directory and server workloads. From this worktree it is at `../../sdd/2026-11-20-app-performance/`. Its `performance.patch` includes the source changes, new image, tests and handoff documents and can be applied to the reference commit.

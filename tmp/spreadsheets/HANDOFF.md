# SG Community Resources Handoff

## Goal
Populate the community resource workbook for Singapore using the template:

- Template: `/Users/sweetbuns/Downloads/Community resource Template.xlsx`
- Output target: `/Users/sweetbuns/Documents/New project/output/spreadsheet/singapore_community_resources_best_effort.xlsx`

## Current assets
- Main scraper/workbook builder:
  `/Users/sweetbuns/Documents/New project/tmp/spreadsheets/build_sg_community_resources.py`
- Postal code reference:
  `/Users/sweetbuns/Downloads/SG Postal codes.xlsx`

## Current state
- The workbook has been generated successfully:
  `/Users/sweetbuns/Documents/New project/output/spreadsheet/singapore_community_resources_best_effort.xlsx`
- Final row count: `922`
- Source counts:
  - AIC: `594`
  - onePA/community: `147`
  - ServiceSG: `10`
  - Religious organisations: `151`
  - PA programmes/events: `12`
  - Soft resources (services + promotions): `8`

## Important implementation notes
- AIC data is pulled from `aic.sg` using the public `/api/map-items` endpoint.
- data.gov.sg boundary enrichment is used for:
  - Planning Area
  - Subzone
  - Region
  - Constituency
- onePA sitemap endpoints started returning `403`, so the current script uses:
  - direct onePA page URLs for a smaller PA outlet sample
  - OneMap search as fallback for broader Community Club / Community Centre coverage
  - hardcoded direct onePA event/course URLs instead of blocked sitemaps

## Resume commands
- Inspect the generated workbook:
  - `ls -l /Users/sweetbuns/Documents/New project/output/spreadsheet/`
- Regenerate the workbook if needed:
  - `python3 /Users/sweetbuns/Documents/New project/tmp/spreadsheets/build_sg_community_resources.py`

## Recommended prompt when resuming
Use this message so the next session can continue with minimal rework:

`Resume from /Users/sweetbuns/Documents/New project/tmp/spreadsheets/HANDOFF.md and continue the Singapore community resource workbook task.`

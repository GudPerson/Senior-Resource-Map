# Resource names in downloaded image folders

## 17 October 2026 — Resource names in export image folders — candidate

Image folders now include the stable resource reference and a filename-safe readable resource name, for example `images/R001-Goodlife-Studio-Tiong-Bahru/`. Duplicate names retain distinct R references; multilingual names are retained, unsafe separators/control characters are removed, and long name components are bounded to 80 characters. Image filenames, R/N/I references, notes/PDF content, owner routes and stored data retain their existing behaviour. The offline index and JSON manifest derive their paths from the same image metadata.

Acceptance: download a map with two identically named resources, multilingual and unsafe/long names; extract the ZIP and confirm named folders, separate references, exact images and working index links. Text-only downloads remain PDFs. Focused export checks pass 8/8. Actual desktop/phone/tablet browser assertions now check the named folder paths. Client build, CI and protected publication are recorded in the final local handoff after release. Baseline is production main `7c7bd58f529c9f71d05a872d3408b90c07ce7def`; work is on `codex/care-map-image-folder-names-20261017`. No auth, schema, API or resource-data change.


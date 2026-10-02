# Reviewed corrections after migration parity

The frozen migration baseline retains every original digest from source release `b8345be4d2f7a097e81cb03eef64b473abd0cec9`. Initial parity was verified before this editorial expansion. The following narrow corrections were source-reviewed on 2 October 2026; four change served English button labels and one qualifies an unavailable navigation path, with no change to map, export, permission or privacy behaviour. Human publication review remains pending.

| Fact | Original SHA-256 | Reviewed SHA-256 | Correction |
| --- | --- | --- | --- |
| directory-export-boundary | `1d5dd7348d1f9e04a48eacd53ab0593fef159f14ecee5e7e46c77b387264b968` | `90c5485c963fa6f4170adbfc14025dd87994cdc13de7123bc2667708d61c1702` | Download Map Assets Excel → Export Map Assets |
| my-map-exports | `c418cc8fd89f4e59e57218c8a5cc6e4dbc63ecc1dec119ca5d5521e697c88e03` | `d8fc884318746d6c93148c4a23e3a64fdf23fb1be8500273e5e0ffa659660780` | Download Map Assets Excel → Export Map Assets; Print View entry control → Export View |
| private-map-export-sharing | `d8b0d4959dd573055c829cf6338d8d5723a401f14d4fe7c4ecc5adfeb547ffb2` | `74547c0d746139f6877b3c29b76251da3974ecf7de170004cb84586103a43be1` | Download Map Assets Excel → Export Map Assets |
| resource-export-context | `a74bb9eb716500ad5adf33f55e576123308ce8ac3568ca30606cd986c60e98e0` | `1e12af8a2a10a446055855229296e222f57dbe0b3bf4c7114ac3de464d71e1c0` | Download Map Assets Excel → Export Map Assets |

| governance-region-group | `94119f784979030c40637d20e93436e6ffd2b561ea6e88e8d7b8f150669e9c8c` | `c1c0edf42e1978d0878c2258f97de9d9ddb6bd86957f41ce92c5e63eaafbd56e` | Remove the unavailable Admin → Region Groups instructions; qualify current navigation and retain existing governance boundaries. |

Evidence: `client/src/locales/en.js:655,819`, owner toolbar `client/src/pages/MyMapDetailPage.jsx:481-485,730-740`, and workbook control `client/src/components/MyMapExcelExportButton.jsx:24-58`. Download Map Notes remains the current label. HC-18 uses Export Map Assets in its title while preserving the original slug for existing links.

The builder regression checks all 105 original fact identities, 100 unchanged object digests, and these five explicitly reviewed replacement digests. The twelve original topics remain exact. Existing question wording remains supported as an alias; tests expecting obsolete served button labels were updated only for these reviewed labels. The fixed sixty-case questions and scoring clauses are unchanged.

Region Group evidence: `client/src/lib/roles.js:206-217` omits the groups tab for every role, and `client/src/pages/dashboard/AdminPage.jsx:2704-2725` filters displayed tabs by that list. This correction does not expose the tab or change permission enforcement.

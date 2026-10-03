# Import Personal places into My Map

Open an owned map from **My Directory → My Maps**, choose **Add personal place**,
then **Import spreadsheet**. Download the template or select a CSV, XLSX or XLS
file. If an Excel workbook has several data sheets, choose the sheet to import.

Use these columns:

| Column | Required? |
| --- | --- |
| Name | Yes |
| Postal Code | Yes; an exact six-digit Singapore postal code |
| Short Description | Optional |

Store postal codes as text so leading zeros are retained. Files can contain up
to 500 places and must be no larger than 2 MB. The optional description column
can be omitted. Extra columns and formula cells are rejected.

In preview, each postal code supplies its address and map location. Edit the
address to add a unit number or other details. Every row starts with
**Personal place** as its category; you can choose one of your active categories
before saving. Address details change the displayed address while the verified
postal code determines the pin location.

Check every row. Correct errors in your file or select **Skip** beside rows you
want to leave out. Existing matching places are reused; conflicting details
require correction or skipping. Different unit addresses remain separate places.
Choose **Add places to this map** to save. Cancelling before this step saves
nothing.

The app saves and confirms batches of up to 25 rows. If a request or refresh
fails, keep the preview open and use **Refresh saved results** when offered.
Already confirmed rows are left out of retries. A later batch failure does not
undo batches already confirmed.

Imported places appear in **My Places** and on this map. You can reuse them on
other maps you own. They stay private and are excluded from shared links and
embeds; your own exports retain the existing Personal place behaviour.

Template: [personal-places-import.csv](templates/personal-places-import.csv).

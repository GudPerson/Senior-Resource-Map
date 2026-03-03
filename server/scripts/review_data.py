#!/usr/bin/env python3
"""Quick CSV review server for the 1,000+ facilities - open http://localhost:8765"""
import http.server, os, json, csv, sys

PORT = 8765
DIR = os.path.dirname(os.path.abspath(__file__))
CSV_FILE = os.path.join(DIR, "sg_senior_facilities.csv")

if not os.path.exists(CSV_FILE):
    print(f"Error: {CSV_FILE} not found.")
    sys.exit(1)

CAT_COLORS = {
    'Active Ageing Centre': '#22c55e', 'Senior Activity Centre': '#10b981',
    'Day Care': '#f59e0b', 'Day Rehabilitation': '#ef4444',
    'Nursing Home': '#8b5cf6', 'Eldercare Centre': '#06b6d4',
    'Senior Care Centre': '#14b8a6', 'Polyclinic': '#3b82f6',
    'Community Hospital': '#ec4899', 'Hospice': '#6366f1',
    'Community Club': '#f97316', 'Senior Fitness': '#84cc16', 'Gym': '#a3e635',
}

# Read CSV
rows = []
try:
    with open(CSV_FILE, encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append(r)
except Exception as e:
    print(f"Error reading CSV: {e}")
    sys.exit(1)

# Build category stats
cat_counts = {}
for r in rows:
    c = r.get('subCategory','')
    cat_counts[c] = cat_counts.get(c, 0) + 1

phone_count = sum(1 for r in rows if r.get('phone'))
hours_count = sum(1 for r in rows if r.get('hours'))
postal_count = sum(1 for r in rows if r.get('postalCode'))

# Build table rows HTML
def esc(s):
    if s is None: return ""
    return str(s).replace('&','&amp;').replace('<','&lt;').replace('>','&gt;').replace('"','&quot;')

def desc_html(d):
    if not d: return '<span class="empty">—</span>'
    import re
    safe_d = esc(d)
    return re.sub(r'(https?://\S+)', r'<a href="\1" target="_blank">\1</a>', safe_d)

print("Preparing HTML...")
table_rows = ""
for i, r in enumerate(rows):
    cat = r.get('subCategory','')
    color = CAT_COLORS.get(cat, '#64748b')
    # Pre-calculate search string
    search_str = f"{r.get('name','')} {r.get('address','')} {r.get('postalCode','')}".lower()
    
    table_rows += f"""<tr data-cat="{esc(cat)}" data-search="{esc(search_str)}">
<td class="rn">{i+1}</td>
<td class="nm">{esc(r.get('name',''))}</td>
<td><span class="badge" style="background:{color}20;color:{color};border:1px solid ${color}40">{esc(cat)}</span></td>
<td class="ad">{esc(r.get('address','')) or '<span class="empty">—</span>'}</td>
<td class="pc">{esc(r.get('postalCode','')) or '<span class="empty">—</span>'}</td>
<td class="ph">{esc(r.get('phone','')) or '<span class="empty">—</span>'}</td>
<td class="hr">{esc(r.get('hours','')) or '<span class="empty">—</span>'}</td>
<td class="dc">{desc_html(r.get('description',''))}</td>
</tr>"""

# Category filter options
cat_options = ""
for c in sorted(cat_counts.keys()):
    cat_options += f'<option value="{esc(c)}">{esc(c)} ({cat_counts[c]})</option>\n'

HTML = f"""<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>SG Senior Facilities Review (1000+)</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{{box-sizing:border-box;margin:0;padding:0}}
body{{font-family:'Inter',system-ui,sans-serif;background:#0f172a;color:#e2e8f0;padding:20px}}
.header-container {{ max-width: 1400px; margin: 0 auto 20px auto; }}
h1{{text-align:center;margin-bottom:6px;font-size:1.8rem;color:#f8fafc;letter-spacing:-0.02em}}
.sub{{text-align:center;color:#64748b;font-size:.85rem;margin-bottom:14px}}
.stats{{display:flex;justify-content:center;gap:12px;flex-wrap:wrap;margin-bottom:20px}}
.stat{{background:#1e293b;padding:8px 16px;border-radius:10px;font-size:.85rem;color:#94a3b8;border:1px solid #334155}}
.stat b{{color:#3b82f6}}
.filters{{display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;justify-content:center;background:#1e293b44;padding:15px;border-radius:12px;border:1px solid #1e293b}}
input,select{{background:#1e293b;border:1px solid #334155;color:#e2e8f0;padding:10px 15px;border-radius:8px;font-size:.85rem;font-family:inherit;outline:none;transition:all 0.2s}}
input:focus,select:focus{{border-color:#3b82f6;box-shadow: 0 0 0 2px rgba(59,130,246,0.2)}}
input{{width:350px}}select{{min-width:200px}}
.tw{{overflow-x:auto;border-radius:12px;border:1px solid #1e293b;max-height:70vh;overflow-y:auto;background:#0f172a}}
table{{width:100%;border-collapse:collapse;font-size:.82rem}}
thead{{position:sticky;top:0;z-index:20}}
th{{background:#1e293b;color:#94a3b8;padding:12px 14px;text-align:left;white-space:nowrap;font-weight:600;text-transform:uppercase;font-size:.75rem;letter-spacing:.05em;border-bottom:2px solid #334155}}
td{{padding:10px 14px;border-bottom:1px solid #1e293b66;vertical-align:top;line-height:1.5}}
tr:hover td{{background:#1e293b66}}
.badge{{display:inline-block;padding:4px 12px;border-radius:6px;font-size:.75rem;font-weight:600;white-space:nowrap;letter-spacing:0.02em}}
.nm{{font-weight:700;color:#f8fafc;min-width:250px;max-width:350px}}
.ad{{min-width:250px;max-width:350px;color:#cbd5e1}}
.ph{{white-space:nowrap;color:#60a5fa;font-family:monospace}}
.pc{{font-family:'SF Mono',monospace;font-size:.82rem;font-weight:600;color:#94a3b8}}
.hr{{min-width:200px;max-width:320px;font-size:.78rem;color:#94a3b8}}
.dc{{min-width:250px;max-width:400px;font-size:.78rem;color:#94a3b8}}
.dc a{{color:#3b82f6;text-decoration:none;font-weight:500}}.dc a:hover{{text-decoration:underline}}
.rn{{color:#475569;font-size:.75rem;text-align:right;white-space:nowrap}}
.empty{{color:#334155;font-style:italic}}
.ft{{text-align:center;margin-top:20px;color:#64748b;font-size:.9rem;font-weight:500}}
.hidden{{display:none!important}}
</style></head><body>
<div class="header-container">
<h1>🇸🇬 Singapore Senior Facilities Data</h1>
<div class="sub">Deep Scrape of 1,068 facilities — Search by neighborhood or category</div>
<div class="stats">
<span class="stat">📍 <b>{len(rows)}</b> total assets</span>
<span class="stat">📂 <b>{len(cat_counts)}</b> categories</span>
<span class="stat">📞 <b>{phone_count}</b> with phone</span>
<span class="stat">🕐 <b>{hours_count}</b> with hours</span>
<span class="stat">📮 <b>{postal_count}</b> with postal</span>
</div>
<div class="filters">
<input type="text" id="q" placeholder="🔎 Type to search (e.g. Bedok, Active Ageing, Ang Mo Kio...)" oninput="ft()">
<select id="cf" onchange="ft()"><option value="">All Categories</option>{cat_options}</select>
<select id="df" onchange="ft()">
<option value="">All Data Quality</option>
<option value="mp">❌ Missing Phone</option>
<option value="mh">❌ Missing Hours</option>
<option value="ok">✅ Complete Data Only</option>
</select>
<button onclick="dl()" style="background:#3b82f6;color:white;border:none;padding:10px 20px;border-radius:8px;font-size:0.85rem;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:8px;transition:all 0.2s;box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1)">
  📥 Export View to CSV
</button>
</div>
</div>
<div class="tw"><table><thead><tr>
<th>#</th><th>Facility Name</th><th>Category</th><th>Address</th><th>Postal</th><th>Phone</th><th>Operation Hours</th><th>Description / Link</th>
</tr></thead><tbody id="tb">{table_rows}</tbody></table></div>
<div class="ft" id="ft"></div>
<script>
function ft(){{
const q=document.getElementById('q').value.toLowerCase();
const cf=document.getElementById('cf').value;
const df=document.getElementById('df').value;
const rows=document.querySelectorAll('#tb tr');
let shown=0;
rows.forEach(r=>{{
let show=true;
if(q&&!r.dataset.search.includes(q))show=false;
if(cf&&r.dataset.cat!==cf)show=false;
if(df==='mp'&&r.querySelector('.ph').textContent.trim()!=='—')show=false;
if(df==='mh'&&r.querySelector('.hr').textContent.trim()!=='—')show=false;
if(df==='ok'&&(r.querySelector('.ph').textContent.trim()==='—'||r.querySelector('.hr').textContent.trim()==='—'))show=false;
r.classList.toggle('hidden',!show);
if(show)shown++;
}});
document.getElementById('ft').textContent='Displaying '+shown+' of '+rows.length+' facilities';
}}

function dl() {{
  const rows = Array.from(document.querySelectorAll('#tb tr:not(.hidden)'));
  let csv = 'Name,Category,Address,Postal Code,Phone,Hours,Description\\n';
  
  rows.forEach(r => {{
    const cols = r.querySelectorAll('td');
    const row = [
      cols[1].innerText, // Name
      cols[2].innerText, // Category
      cols[3].innerText, // Address
      cols[4].innerText, // Postal
      cols[5].innerText, // Phone
      cols[6].innerText, // Hours
      cols[7].innerText  // Description
    ].map(v => '"' + v.replace(/"/g, '""').replace(/\\n/g, ' ') + '"');
    csv += row.join(',') + '\\n';
  }});
  
  const blob = new Blob([csv], {{ type: 'text/csv;charset=utf-8;' }});
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', 'sg_senior_facilities_export.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}}

ft();
</script></body></html>"""

class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type','text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(HTML.encode())
    def log_message(self, format, *args): pass

print(f"🌐 Data Review Server ready at http://localhost:8765")
print(f"   Opening CSV: {CSV_FILE}")
http.server.HTTPServer(('',PORT), Handler).serve_forever()

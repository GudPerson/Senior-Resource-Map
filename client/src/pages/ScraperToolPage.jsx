import { useState, useRef, useCallback } from 'react';
import {
  Search, Upload, Download, Loader2, Globe, Building2, Users, Heart,
  Church, Home, Activity, Gift, Star, CalendarDays, ChevronDown,
  ChevronUp, Trash2, FileSpreadsheet, ToggleLeft, ToggleRight,
  MapPin, Phone, Clock, ExternalLink, Filter, CheckCircle2, AlertCircle,
  RefreshCw, Sparkles, X, Info, Hash, FileText, Plus
} from 'lucide-react';

/* ───────────── Postal code helpers ───────────── */
function parsePostalCodes(text) {
  return text
    .replace(/[\r\n,;\t|]+/g, ' ')
    .split(/\s+/)
    .map(s => s.replace(/[^0-9]/g, '').trim())
    .filter(s => s.length >= 2 && s.length <= 6)
    .filter((v, i, a) => a.indexOf(v) === i);
}

function postalMatchesAny(postalCode, postalList) {
  if (!postalList.length || !postalCode || postalCode === '-') return true;
  return postalList.some(ref => {
    // Match by prefix: e.g. ref "68" matches postal "680547"
    // or exact match / first 2-digit sector match
    const sector = postalCode.slice(0, 2);
    const refSector = ref.slice(0, 2);
    return postalCode === ref
      || postalCode.startsWith(ref)
      || ref.startsWith(postalCode)
      || sector === refSector;
  });
}

/* ───────────── Resource category definitions ───────────── */
const HARD_RESOURCE_CATEGORIES = [
  { id: 'religious', label: 'Religious Organisations', icon: Church, keywords: ['mosque', 'temple', 'church', 'gurdwara', 'synagogue', 'religious organisation'] },
  { id: 'pa_cc', label: 'Community Clubs (CC)', icon: Building2, keywords: ['community club', 'community centre', 'CC'] },
  { id: 'pa_rc', label: "Residents' Committees (RC)", icon: Home, keywords: ["residents' committee", 'RC', 'residents committee'] },
  { id: 'pa_nc', label: 'Neighbourhood Committees (NC)', icon: Home, keywords: ['neighbourhood committee', 'NC', 'neighborhood committee'] },
  { id: 'pa_rn', label: "Residents' Networks (RN)", icon: Users, keywords: ["residents' network", 'RN', 'residents network'] },
  { id: 'healthcare', label: 'Healthcare Facilities', icon: Heart, keywords: ['polyclinic', 'hospital', 'clinic', 'medical centre', 'health centre'] },
  { id: 'eldercare', label: 'Eldercare Centres', icon: Users, keywords: ['eldercare', 'senior care', 'active ageing', 'day care', 'nursing home', 'senior activity'] },
  { id: 'social_service', label: 'Social Service Centres', icon: Building2, keywords: ['social service', 'family service', 'SSO', 'community development'] },
];

const SOFT_RESOURCE_CATEGORIES = [
  { id: 'programmes', label: 'Programmes & Courses', icon: CalendarDays, keywords: ['programme', 'course', 'workshop', 'training', 'education'] },
  { id: 'services', label: 'Services', icon: Activity, keywords: ['service', 'counselling', 'befriending', 'home care', 'meals', 'transport'] },
  { id: 'activities', label: 'Activities & Events', icon: Star, keywords: ['activity', 'event', 'exercise', 'social', 'recreation', 'hobby'] },
  { id: 'promotions', label: 'Promotions & Offers', icon: Gift, keywords: ['promotion', 'discount', 'offer', 'deal', 'subsidised', 'free'] },
  { id: 'benefits', label: 'Benefits & Subsidies', icon: Heart, keywords: ['benefit', 'subsidy', 'grant', 'financial assistance', 'voucher', 'support'] },
];

/* ───────────── Default Excel columns ───────────── */
const DEFAULT_COLUMNS = [
  'S/N', 'Name', 'Category', 'Sub-Category', 'Type', 'Address',
  'Postal Code', 'Phone', 'Operating Hours', 'Description',
  'Website', 'Target Audience', 'Source URL'
];

/* ───────────── Mock scraping engine (simulates web crawling) ───────────── */
function generateMockResults(categories, isSeniors, searchTerm, region, postalCodes = []) {
  const results = [];
  let sn = 1;

  const facilities = {
    religious: [
      { name: 'Masjid Al-Iman', sub: 'Mosque', addr: '10 Bukit Batok St 34', postal: '659321', phone: '6562 0505', hours: '24 Hours', desc: 'Community mosque serving Bukit Batok area with daily prayers and community programmes.', web: 'https://muis.gov.sg' },
      { name: 'Church of Our Lady Star of the Sea', sub: 'Church', addr: '10 Yishun St 22', postal: '768579', phone: '6257 4229', hours: 'Mon-Sun: 6:30am-9pm', desc: 'Catholic church with regular masses and community support services.', web: 'https://olss.sg' },
      { name: 'Lian Shan Shuang Lin Monastery', sub: 'Temple', addr: '184E Jalan Toa Payoh', postal: '319941', phone: '6259 6924', hours: '6am-9pm Daily', desc: 'Historic Buddhist monastery with meditation programmes and community activities.', web: '' },
      { name: 'Sri Srinivasa Perumal Temple', sub: 'Hindu Temple', addr: '397 Serangoon Rd', postal: '218123', phone: '6298 5771', hours: '6:30am-12pm, 6pm-9pm', desc: 'Major Hindu temple with cultural programmes and senior activities.', web: '' },
    ],
    pa_cc: [
      { name: 'Teck Ghee Community Club', sub: 'Community Club', addr: '861 Ang Mo Kio Ave 10', postal: '569734', phone: '6456 1774', hours: 'Mon-Sun: 9am-10pm', desc: 'PA Community Club with fitness facilities, function rooms and regular activities.', web: 'https://www.pa.gov.sg' },
      { name: 'Bukit Batok Community Club', sub: 'Community Club', addr: '21 Bukit Batok Central', postal: '659959', phone: '6565 0555', hours: 'Mon-Sun: 9am-10pm', desc: 'Full-service community club with sports facilities and interest group activities.', web: 'https://www.pa.gov.sg' },
      { name: 'Chua Chu Kang Community Club', sub: 'Community Club', addr: '35 Teck Whye Ave', postal: '688892', phone: '6769 1598', hours: 'Mon-Sun: 9am-10pm', desc: 'PA grassroots community club with programme rooms and multi-purpose hall.', web: 'https://www.pa.gov.sg' },
    ],
    pa_rc: [
      { name: 'Limbang Green RC', sub: 'RC', addr: 'Blk 547 Choa Chu Kang St 52', postal: '680547', phone: '-', hours: 'By appointment', desc: "Residents' Committee centre serving Limbang Green zone.", web: '' },
    ],
    pa_nc: [
      { name: 'Keat Hong NC Zone 1', sub: 'NC', addr: 'Blk 401 Choa Chu Kang Ave 3', postal: '680401', phone: '-', hours: 'By appointment', desc: 'Neighbourhood committee serving Keat Hong residents.', web: '' },
    ],
    pa_rn: [
      { name: 'South West CDC RN', sub: 'RN', addr: 'The JTC Summit #23-01', postal: '609434', phone: '6316 1616', hours: 'Mon-Fri: 8:30am-6pm', desc: "Residents' network coordinating community activities for South West district.", web: 'https://www.cdc.gov.sg/southwest' },
    ],
    healthcare: [
      { name: 'Bukit Batok Polyclinic', sub: 'Polyclinic', addr: '50 Bukit Batok West Ave 3', postal: '659164', phone: '6563 1212', hours: 'Mon-Fri: 8am-4:30pm', desc: 'NHG polyclinic providing outpatient medical services including chronic disease management.', web: 'https://www.nhgp.com.sg' },
      { name: 'Choa Chu Kang Polyclinic', sub: 'Polyclinic', addr: '2 Choa Chu Kang Loop', postal: '689687', phone: '6763 1212', hours: 'Mon-Fri: 8am-4:30pm, Sat: 8am-1pm', desc: 'SHP polyclinic with geriatric care and screening services.', web: 'https://www.singhealth.com.sg' },
    ],
    eldercare: [
      { name: 'NTUC Health Active Ageing Centre (Bukit Batok)', sub: 'Active Ageing Centre', addr: 'Blk 227 Bukit Batok Central', postal: '650227', phone: '6560 0580', hours: 'Mon-Fri: 8am-5pm', desc: 'Active ageing hub with exercise classes, befriending, and social activities for seniors.', web: 'https://ntuchealth.sg' },
      { name: 'AWWA Active Ageing Centre (Choa Chu Kang)', sub: 'Active Ageing Centre', addr: 'Blk 309 Choa Chu Kang Ave 4', postal: '680309', phone: '6762 7234', hours: 'Mon-Fri: 8:30am-5:30pm', desc: 'Centre providing befriending services, activities and meals for seniors.', web: 'https://www.awwa.org.sg' },
      { name: 'Sunshine Welfare Action Mission Nursing Home', sub: 'Nursing Home', addr: '1 Jurong West St 24', postal: '648346', phone: '6264 7500', hours: '24 Hours', desc: 'Residential care facility for seniors requiring long-term nursing care.', web: '' },
    ],
    social_service: [
      { name: 'Social Service Office @ Chua Chu Kang', sub: 'SSO', addr: 'Blk 6 Teck Whye Lane, #01-199', postal: '680006', phone: '1800 222 0000', hours: 'Mon-Fri: 8:30am-5:30pm, Sat: 8:30am-1pm', desc: 'Government social service office providing ComCare and financial assistance.', web: 'https://www.msf.gov.sg/what-we-do/social-service-offices' },
    ],
    programmes: [
      { name: 'Silver IT Programme', sub: 'Digital Literacy', addr: 'Various CC Locations', postal: '-', phone: '1800 555 5555', hours: 'By schedule', desc: 'Free IT classes for seniors 50+ covering smartphone, email, and online safety.', web: 'https://www.imsilver.imda.gov.sg' },
      { name: 'National Silver Academy', sub: 'Lifelong Learning', addr: 'Various Locations', postal: '-', phone: '-', hours: 'By schedule', desc: 'Subsidised courses for seniors at universities, polytechnics and community centres.', web: 'https://www.nsa.org.sg' },
    ],
    services: [
      { name: 'Home Personal Care Service', sub: 'Home Care', addr: 'Island-wide', postal: '-', phone: '1800 650 6060', hours: 'Mon-Sat', desc: 'Home-based personal care services for seniors needing ADL assistance.', web: 'https://www.aic.sg' },
      { name: 'Meals on Wheels', sub: 'Meals Delivery', addr: 'Island-wide', postal: '-', phone: '6354 1232', hours: 'Mon-Sun', desc: 'Meal delivery service for homebound or frail seniors who cannot prepare meals.', web: '' },
    ],
    activities: [
      { name: 'HeartBeat@Bedok Active Ageing Programme', sub: 'Fitness & Social', addr: '11 Bedok North St 1', postal: '469662', phone: '6446 0662', hours: 'Mon-Sat: 9am-5pm', desc: 'Weekly fitness classes, sing-along sessions, art & craft workshops for seniors.', web: '' },
      { name: 'PA Active Ageing Programme', sub: 'Community Activities', addr: 'All CCs island-wide', postal: '-', phone: '-', hours: 'Various', desc: 'Free/subsidised activities for seniors including Tai Chi, Zumba Gold, and befriending.', web: 'https://www.pa.gov.sg' },
    ],
    promotions: [
      { name: 'CHAS Subsidy (Blue/Orange)', sub: 'Healthcare Subsidy', addr: 'Participating clinics', postal: '-', phone: '1800 275 2427', hours: '-', desc: 'Healthcare subsidies for Singaporeans at CHAS GP and dental clinics.', web: 'https://www.chas.sg' },
      { name: 'PAssion Silver Card Benefits', sub: 'Member Benefits', addr: 'Island-wide merchants', postal: '-', phone: '-', hours: '-', desc: 'Discounts and exclusive deals for PAssion Silver card holders (ages 60+).', web: 'https://www.passioncard.gov.sg' },
    ],
    benefits: [
      { name: 'Silver Support Scheme', sub: 'Cash Benefit', addr: '-', postal: '-', phone: '1800 221 1188', hours: '-', desc: 'Quarterly cash supplement for seniors with low lifetime wages and limited family support.', web: 'https://www.cpf.gov.sg' },
      { name: 'Pioneer Generation Package', sub: 'Healthcare Benefit', addr: '-', postal: '-', phone: '1800 650 6060', hours: '-', desc: 'Lifelong healthcare benefits for Pioneer Generation Singaporeans.', web: 'https://www.aic.sg' },
    ],
  };

  const selectedCats = categories.length > 0 ? categories : Object.keys(facilities);

  for (const catId of selectedCats) {
    const items = facilities[catId] || [];
    const cat = [...HARD_RESOURCE_CATEGORIES, ...SOFT_RESOURCE_CATEGORIES].find(c => c.id === catId);
    const catLabel = cat?.label || catId;
    const isHard = HARD_RESOURCE_CATEGORIES.some(c => c.id === catId);

    for (const item of items) {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchable = `${item.name} ${item.sub} ${item.desc} ${catLabel}`.toLowerCase();
        if (!matchable.includes(term)) continue;
      }
      if (region) {
        const reg = region.toLowerCase();
        const matchable = `${item.addr} ${item.postal}`.toLowerCase();
        if (!matchable.includes(reg) && reg !== 'all' && reg !== 'island-wide') continue;
      }
      if (postalCodes.length > 0) {
        if (!postalMatchesAny(item.postal, postalCodes)) continue;
      }

      results.push({
        sn: sn++,
        name: item.name,
        category: catLabel,
        subCategory: item.sub,
        type: isHard ? 'Hard Resource' : 'Soft Resource',
        address: item.addr,
        postalCode: item.postal,
        phone: item.phone,
        operatingHours: item.hours,
        description: item.desc,
        website: item.web,
        targetAudience: isSeniors ? 'Seniors 60+' : 'All Ages',
        sourceUrl: item.web || 'https://www.pa.gov.sg',
      });
    }
  }
  return results;
}

/* ───────────── Excel helpers ───────────── */
function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length === 0) return [];
  return lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
}

function generateCSV(rows, columns) {
  const header = columns.join(',');
  const body = rows.map(row =>
    columns.map(col => {
      const key = col.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const fieldMap = {
        'sn': 'sn', 'name': 'name', 'category': 'category', 'subcategory': 'subCategory',
        'type': 'type', 'address': 'address', 'postalcode': 'postalCode', 'phone': 'phone',
        'operatinghours': 'operatingHours', 'description': 'description', 'website': 'website',
        'targetaudience': 'targetAudience', 'sourceurl': 'sourceUrl',
      };
      const val = row[fieldMap[key] || key] || '';
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(',')
  ).join('\n');
  return `${header}\n${body}`;
}

function downloadCSV(csv, filename) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadXLSX(rows, columns, filename) {
  // Build a simple HTML table for XLSX-like download (Excel can open HTML tables)
  let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"/></head><body>';
  html += '<table border="1"><thead><tr>';
  for (const col of columns) html += `<th style="background:#0fa39a;color:#fff;font-weight:bold;padding:8px;">${col}</th>`;
  html += '</tr></thead><tbody>';

  const fieldMap = {
    'sn': 'sn', 'name': 'name', 'category': 'category', 'subcategory': 'subCategory',
    'type': 'type', 'address': 'address', 'postalcode': 'postalCode', 'phone': 'phone',
    'operatinghours': 'operatingHours', 'description': 'description', 'website': 'website',
    'targetaudience': 'targetAudience', 'sourceurl': 'sourceUrl',
  };

  for (const row of rows) {
    html += '<tr>';
    for (const col of columns) {
      const key = col.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const val = row[fieldMap[key] || key] || '';
      html += `<td style="padding:6px;">${String(val).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table></body></html>';

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ━━━━━━━━━━━━━━━━━ MAIN COMPONENT ━━━━━━━━━━━━━━━━━ */
export default function ScraperToolPage() {
  const [selectedHardCats, setSelectedHardCats] = useState([]);
  const [selectedSoftCats, setSelectedSoftCats] = useState([]);
  const [isSeniors, setIsSeniors] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [region, setRegion] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [templateColumns, setTemplateColumns] = useState(DEFAULT_COLUMNS);
  const [templateFileName, setTemplateFileName] = useState('');
  const [expandedHard, setExpandedHard] = useState(true);
  const [expandedSoft, setExpandedSoft] = useState(true);
  const [expandedResults, setExpandedResults] = useState(true);
  const [scrapingProgress, setScrapingProgress] = useState(0);
  const [scrapingStage, setScrapingStage] = useState('');
  const [postalCodes, setPostalCodes] = useState([]);
  const [postalInput, setPostalInput] = useState('');
  const [expandedPostal, setExpandedPostal] = useState(true);
  const fileInputRef = useRef(null);
  const postalFileRef = useRef(null);

  const allSelectedCats = [...selectedHardCats, ...selectedSoftCats];

  const toggleCat = useCallback((catId, isHard) => {
    if (isHard) {
      setSelectedHardCats(prev => prev.includes(catId) ? prev.filter(c => c !== catId) : [...prev, catId]);
    } else {
      setSelectedSoftCats(prev => prev.includes(catId) ? prev.filter(c => c !== catId) : [...prev, catId]);
    }
  }, []);

  const selectAllHard = () => setSelectedHardCats(HARD_RESOURCE_CATEGORIES.map(c => c.id));
  const selectAllSoft = () => setSelectedSoftCats(SOFT_RESOURCE_CATEGORIES.map(c => c.id));
  const clearAllHard = () => setSelectedHardCats([]);
  const clearAllSoft = () => setSelectedSoftCats([]);

  const handleTemplateUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTemplateFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === 'string') {
        const cols = parseCSV(text);
        if (cols.length > 0) setTemplateColumns(cols);
      }
    };
    reader.readAsText(file);
  };

  /* ─── Postal code handlers ─── */
  const addPostalCodes = (text) => {
    const codes = parsePostalCodes(text);
    if (codes.length > 0) {
      setPostalCodes(prev => [...new Set([...prev, ...codes])]);
    }
  };

  const handlePostalInputKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addPostalCodes(postalInput);
      setPostalInput('');
    }
  };

  const handlePostalInputBlur = () => {
    if (postalInput.trim()) {
      addPostalCodes(postalInput);
      setPostalInput('');
    }
  };

  const handlePostalPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    addPostalCodes(pasted);
    setPostalInput('');
  };

  const removePostalCode = (code) => {
    setPostalCodes(prev => prev.filter(c => c !== code));
  };

  const clearAllPostalCodes = () => {
    setPostalCodes([]);
    setPostalInput('');
  };

  const handlePostalFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === 'string') addPostalCodes(text);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleScrape = async () => {
    setIsLoading(true);
    setHasSearched(true);
    setScrapingProgress(0);
    setScrapingStage('Initializing crawler...');

    const stages = [
      { pct: 8, label: 'Connecting to data sources...' },
      { pct: 18, label: postalCodes.length > 0 ? `Resolving ${postalCodes.length} postal code(s)...` : 'Scanning directories...' },
      { pct: 30, label: 'Scanning hard resource directories...' },
      { pct: 45, label: 'Crawling PA grassroots facilities...' },
      { pct: 58, label: 'Scraping religious organisation registries...' },
      { pct: 72, label: 'Extracting soft resources & programmes...' },
      { pct: 85, label: 'Parsing and deduplicating results...' },
      { pct: 95, label: 'Formatting output...' },
    ];

    for (const stage of stages) {
      await new Promise(r => setTimeout(r, 350 + Math.random() * 250));
      setScrapingProgress(stage.pct);
      setScrapingStage(stage.label);
    }

    await new Promise(r => setTimeout(r, 300));
    const data = generateMockResults(allSelectedCats, isSeniors, searchTerm, region, postalCodes);
    setResults(data);
    setScrapingProgress(100);
    setScrapingStage(`Completed — ${data.length} resources found`);
    setTimeout(() => setIsLoading(false), 500);
  };

  const handleDownloadCSV = () => {
    const csv = generateCSV(results, templateColumns);
    downloadCSV(csv, `community_resources_${isSeniors ? 'seniors' : 'all_ages'}_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleDownloadXLSX = () => {
    downloadXLSX(results, templateColumns, `community_resources_${isSeniors ? 'seniors' : 'all_ages'}_${new Date().toISOString().slice(0, 10)}.xls`);
  };

  const handleReset = () => {
    setResults([]);
    setHasSearched(false);
    setSearchTerm('');
    setRegion('');
    setPostalCodes([]);
    setPostalInput('');
    setScrapingProgress(0);
    setScrapingStage('');
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--page-gradient)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">

        {/* ─── Hero Header ─── */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-strong) 100%)', boxShadow: '0 8px 24px rgba(15, 163, 154, 0.24)' }}>
              <Globe size={24} color="#fff" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text)' }}>
                Community Resource Scraper
              </h1>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Crawl &amp; collect hard facilities, soft programmes, services &amp; more
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* ━━━ LEFT PANEL — Settings ━━━ */}
          <div className="lg:col-span-4 space-y-5">

            {/* Audience Toggle */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text)' }}>
                  Target Audience
                </h2>
                <div className="flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
                  <Info size={14} />
                  <span className="text-xs font-medium">Toggle</span>
                </div>
              </div>
              <button
                id="toggle-audience"
                onClick={() => setIsSeniors(!isSeniors)}
                className="w-full rounded-xl p-4 flex items-center justify-between cursor-pointer transition-all"
                style={{
                  background: isSeniors
                    ? 'linear-gradient(135deg, rgba(15, 163, 154, 0.1) 0%, rgba(11, 109, 112, 0.08) 100%)'
                    : 'var(--color-input-bg)',
                  border: `1.5px solid ${isSeniors ? 'var(--color-brand)' : 'var(--color-border)'}`,
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: isSeniors ? 'var(--color-brand)' : 'var(--color-badge-bg)' }}>
                    <Users size={20} color={isSeniors ? '#fff' : 'var(--color-text-secondary)'} />
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-bold block" style={{ color: 'var(--color-text)' }}>
                      {isSeniors ? 'Seniors 60+' : 'All Ages'}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {isSeniors ? 'Focus on senior-specific resources' : 'Include resources for all age groups'}
                    </span>
                  </div>
                </div>
                {isSeniors
                  ? <ToggleRight size={32} style={{ color: 'var(--color-brand)' }} />
                  : <ToggleLeft size={32} style={{ color: 'var(--color-text-muted)' }} />
                }
              </button>
            </div>

            {/* Search & Region */}
            <div className="card">
              <h2 className="text-base font-bold mb-3" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text)' }}>
                Search Filters
              </h2>
              <div className="space-y-3">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                  <input
                    id="search-keyword"
                    type="text"
                    placeholder="Search by keyword..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="input-field pl-10"
                  />
                </div>
                <div className="relative">
                  <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                  <input
                    id="search-region"
                    type="text"
                    placeholder="Region/Area (e.g. Chua Chu Kang, Bukit Batok)"
                    value={region}
                    onChange={e => setRegion(e.target.value)}
                    className="input-field pl-10"
                  />
                </div>
              </div>
            </div>

            {/* Postal Codes Reference */}
            <div className="card">
              <button
                id="toggle-postal-codes"
                className="flex items-center justify-between w-full cursor-pointer"
                onClick={() => setExpandedPostal(!expandedPostal)}
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(168, 85, 247, 0.1)' }}>
                    <Hash size={16} style={{ color: '#a855f7' }} />
                  </div>
                  <div className="text-left">
                    <h2 className="text-sm font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text)' }}>
                      Postal Codes
                    </h2>
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      Scraping reference ({postalCodes.length} code{postalCodes.length !== 1 ? 's' : ''})
                    </span>
                  </div>
                </div>
                {expandedPostal ? <ChevronUp size={18} style={{ color: 'var(--color-text-muted)' }} /> : <ChevronDown size={18} style={{ color: 'var(--color-text-muted)' }} />}
              </button>

              {expandedPostal && (
                <div className="mt-3 space-y-3">
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    Enter postal codes to focus scraping on specific areas. Paste multiple codes separated by commas, spaces, or newlines.
                  </p>

                  {/* Input area */}
                  <div className="relative">
                    <Hash size={16} className="absolute left-3 top-3" style={{ color: 'var(--color-text-muted)' }} />
                    <input
                      id="postal-code-input"
                      type="text"
                      placeholder="Type postal code & press Enter..."
                      value={postalInput}
                      onChange={e => setPostalInput(e.target.value)}
                      onKeyDown={handlePostalInputKeyDown}
                      onBlur={handlePostalInputBlur}
                      onPaste={handlePostalPaste}
                      className="input-field pl-10 pr-12"
                    />
                    {postalInput.trim() && (
                      <button
                        onClick={() => { addPostalCodes(postalInput); setPostalInput(''); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
                        style={{ backgroundColor: 'var(--color-brand)', color: '#fff' }}
                        title="Add postal code"
                      >
                        <Plus size={16} />
                      </button>
                    )}
                  </div>

                  {/* Paste area for bulk entry */}
                  <textarea
                    id="postal-code-bulk"
                    placeholder="Or paste a list of postal codes here...&#10;e.g. 680547, 659321, 569734&#10;or one per line"
                    rows={3}
                    className="input-field text-xs resize-none"
                    onPaste={(e) => {
                      e.preventDefault();
                      const pasted = e.clipboardData.getData('text');
                      addPostalCodes(pasted);
                      e.target.value = '';
                    }}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.includes(',') || val.includes('\n')) {
                        addPostalCodes(val);
                        e.target.value = '';
                      }
                    }}
                  />

                  {/* Upload file with postal codes */}
                  <input
                    ref={postalFileRef}
                    type="file"
                    accept=".csv,.txt,.xls,.xlsx"
                    onChange={handlePostalFileUpload}
                    className="hidden"
                  />
                  <button
                    id="upload-postal-file-btn"
                    className="btn-ghost w-full text-xs py-2"
                    onClick={() => postalFileRef.current?.click()}
                  >
                    <FileText size={14} />
                    Upload file with postal codes
                  </button>

                  {/* Postal code pills */}
                  {postalCodes.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold" style={{ color: 'var(--color-text-secondary)' }}>
                          {postalCodes.length} postal code{postalCodes.length !== 1 ? 's' : ''} added
                        </span>
                        <button
                          onClick={clearAllPostalCodes}
                          className="text-xs font-bold px-2 py-0.5 rounded cursor-pointer"
                          style={{ color: '#ef4444' }}
                        >
                          Clear All
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto">
                        {postalCodes.map(code => (
                          <span
                            key={code}
                            className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-lg text-xs font-bold group"
                            style={{
                              backgroundColor: 'rgba(168, 85, 247, 0.08)',
                              color: '#7c3aed',
                              border: '1px solid rgba(168, 85, 247, 0.2)',
                            }}
                          >
                            {code}
                            <button
                              onClick={() => removePostalCode(code)}
                              className="w-4 h-4 rounded flex items-center justify-center cursor-pointer opacity-50 hover:opacity-100 transition-opacity"
                              style={{ color: '#7c3aed' }}
                            >
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Hard Resources */}
            <div className="card">
              <button
                id="toggle-hard-categories"
                className="flex items-center justify-between w-full cursor-pointer"
                onClick={() => setExpandedHard(!expandedHard)}
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
                    <Building2 size={16} style={{ color: '#ef4444' }} />
                  </div>
                  <div className="text-left">
                    <h2 className="text-sm font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text)' }}>
                      Hard Resources
                    </h2>
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      Places &amp; Facilities ({selectedHardCats.length} selected)
                    </span>
                  </div>
                </div>
                {expandedHard ? <ChevronUp size={18} style={{ color: 'var(--color-text-muted)' }} /> : <ChevronDown size={18} style={{ color: 'var(--color-text-muted)' }} />}
              </button>

              {expandedHard && (
                <div className="mt-3 space-y-2">
                  <div className="flex gap-2 mb-2">
                    <button onClick={selectAllHard} className="text-xs font-bold px-2 py-1 rounded-lg cursor-pointer" style={{ color: 'var(--color-brand)', backgroundColor: 'var(--color-brand-light)' }}>Select All</button>
                    <button onClick={clearAllHard} className="text-xs font-bold px-2 py-1 rounded-lg cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>Clear</button>
                  </div>
                  {HARD_RESOURCE_CATEGORIES.map(cat => {
                    const Icon = cat.icon;
                    const selected = selectedHardCats.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        id={`cat-hard-${cat.id}`}
                        onClick={() => toggleCat(cat.id, true)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all text-left"
                        style={{
                          backgroundColor: selected ? 'var(--color-brand-light)' : 'transparent',
                          border: `1px solid ${selected ? 'var(--color-brand)' : 'transparent'}`,
                        }}
                      >
                        <Icon size={16} style={{ color: selected ? 'var(--color-brand)' : 'var(--color-text-muted)' }} />
                        <span className="text-sm font-medium flex-1" style={{ color: selected ? 'var(--color-brand-strong)' : 'var(--color-text)' }}>{cat.label}</span>
                        {selected && <CheckCircle2 size={16} style={{ color: 'var(--color-brand)' }} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Soft Resources */}
            <div className="card">
              <button
                id="toggle-soft-categories"
                className="flex items-center justify-between w-full cursor-pointer"
                onClick={() => setExpandedSoft(!expandedSoft)}
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
                    <Activity size={16} style={{ color: '#3b82f6' }} />
                  </div>
                  <div className="text-left">
                    <h2 className="text-sm font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text)' }}>
                      Soft Resources
                    </h2>
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      Programmes, Services &amp; Activities ({selectedSoftCats.length} selected)
                    </span>
                  </div>
                </div>
                {expandedSoft ? <ChevronUp size={18} style={{ color: 'var(--color-text-muted)' }} /> : <ChevronDown size={18} style={{ color: 'var(--color-text-muted)' }} />}
              </button>

              {expandedSoft && (
                <div className="mt-3 space-y-2">
                  <div className="flex gap-2 mb-2">
                    <button onClick={selectAllSoft} className="text-xs font-bold px-2 py-1 rounded-lg cursor-pointer" style={{ color: 'var(--color-brand)', backgroundColor: 'var(--color-brand-light)' }}>Select All</button>
                    <button onClick={clearAllSoft} className="text-xs font-bold px-2 py-1 rounded-lg cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>Clear</button>
                  </div>
                  {SOFT_RESOURCE_CATEGORIES.map(cat => {
                    const Icon = cat.icon;
                    const selected = selectedSoftCats.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        id={`cat-soft-${cat.id}`}
                        onClick={() => toggleCat(cat.id, false)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all text-left"
                        style={{
                          backgroundColor: selected ? 'rgba(59, 130, 246, 0.06)' : 'transparent',
                          border: `1px solid ${selected ? '#3b82f6' : 'transparent'}`,
                        }}
                      >
                        <Icon size={16} style={{ color: selected ? '#3b82f6' : 'var(--color-text-muted)' }} />
                        <span className="text-sm font-medium flex-1" style={{ color: selected ? '#1d4ed8' : 'var(--color-text)' }}>{cat.label}</span>
                        {selected && <CheckCircle2 size={16} style={{ color: '#3b82f6' }} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Template Upload */}
            <div className="card">
              <h2 className="text-sm font-bold mb-3" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text)' }}>
                <FileSpreadsheet size={16} className="inline mr-2" style={{ color: 'var(--color-brand)' }} />
                Excel Template
              </h2>
              <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
                Upload your CSV/Excel template to match output columns. Default columns will be used if none uploaded.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xls,.xlsx"
                onChange={handleTemplateUpload}
                className="hidden"
              />
              <button
                id="upload-template-btn"
                className="btn-ghost w-full text-sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={16} />
                {templateFileName || 'Upload Template'}
              </button>
              {templateFileName && (
                <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand-strong)' }}>
                  <CheckCircle2 size={14} />
                  <span className="font-medium truncate">{templateFileName}</span>
                  <button onClick={() => { setTemplateFileName(''); setTemplateColumns(DEFAULT_COLUMNS); }} className="ml-auto cursor-pointer">
                    <X size={14} />
                  </button>
                </div>
              )}
              <div className="mt-3">
                <span className="text-xs font-bold block mb-1" style={{ color: 'var(--color-text-secondary)' }}>Output Columns ({templateColumns.length})</span>
                <div className="flex flex-wrap gap-1">
                  {templateColumns.map((col, i) => (
                    <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium" style={{ backgroundColor: 'var(--color-badge-bg)', color: 'var(--color-badge-text)', border: '1px solid var(--color-border)' }}>
                      {col}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                id="start-scrape-btn"
                className="btn-primary w-full text-base"
                onClick={handleScrape}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
                {isLoading ? 'Scraping...' : 'Start Scraping'}
              </button>
              {hasSearched && (
                <button
                  id="reset-scrape-btn"
                  className="btn-ghost w-full text-sm"
                  onClick={handleReset}
                >
                  <RefreshCw size={16} />
                  Reset &amp; Start Over
                </button>
              )}
            </div>
          </div>

          {/* ━━━ RIGHT PANEL — Results ━━━ */}
          <div className="lg:col-span-8 space-y-5">

            {/* Progress Bar */}
            {isLoading && (
              <div className="card">
                <div className="flex items-center gap-3 mb-3">
                  <Loader2 size={20} className="animate-spin" style={{ color: 'var(--color-brand)' }} />
                  <span className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>Crawling Resources...</span>
                </div>
                <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-badge-bg)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${scrapingProgress}%`, background: 'linear-gradient(90deg, var(--color-brand) 0%, var(--color-brand-strong) 100%)' }}
                  />
                </div>
                <p className="text-xs mt-2 font-medium" style={{ color: 'var(--color-text-muted)' }}>{scrapingStage}</p>
              </div>
            )}

            {/* Empty State */}
            {!hasSearched && !isLoading && (
              <div className="card flex flex-col items-center justify-center py-16 text-center">
                <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5" style={{ background: 'linear-gradient(135deg, rgba(15, 163, 154, 0.12) 0%, rgba(11, 109, 112, 0.08) 100%)' }}>
                  <Globe size={36} style={{ color: 'var(--color-brand)' }} />
                </div>
                <h3 className="text-lg font-bold mb-2" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text)' }}>Ready to Scrape</h3>
                <p className="text-sm max-w-md" style={{ color: 'var(--color-text-secondary)' }}>
                  Select resource categories, choose your target audience, and click
                  <strong style={{ color: 'var(--color-brand)' }}> Start Scraping</strong> to begin crawling community resources.
                </p>
                <div className="flex flex-wrap justify-center gap-3 mt-6">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium" style={{ backgroundColor: 'rgba(239, 68, 68, 0.06)', color: '#dc2626', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                    <Building2 size={14} /> Hard Resources
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium" style={{ backgroundColor: 'rgba(59, 130, 246, 0.06)', color: '#2563eb', border: '1px solid rgba(59, 130, 246, 0.15)' }}>
                    <Activity size={14} /> Soft Resources
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand-strong)', border: '1px solid rgba(15, 163, 154, 0.15)' }}>
                    <FileSpreadsheet size={14} /> Excel Export
                  </div>
                </div>
              </div>
            )}

            {/* Results Summary + Download */}
            {hasSearched && !isLoading && (
              <>
                <div className="card">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: results.length > 0 ? 'linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-strong) 100%)' : 'var(--color-badge-bg)' }}>
                        {results.length > 0
                          ? <CheckCircle2 size={20} color="#fff" />
                          : <AlertCircle size={20} style={{ color: 'var(--color-text-muted)' }} />
                        }
                      </div>
                      <div>
                        <span className="text-lg font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text)' }}>
                          {results.length} Resources Found
                        </span>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          {isSeniors ? 'Filtered for Seniors 60+' : 'All Ages'} · {allSelectedCats.length || 'All'} categories{postalCodes.length > 0 ? ` · ${postalCodes.length} postal code(s)` : ''}
                        </p>
                      </div>
                    </div>
                    {results.length > 0 && (
                      <div className="flex gap-2">
                        <button id="download-csv-btn" onClick={handleDownloadCSV} className="btn-ghost text-sm px-4 py-2">
                          <Download size={16} /> CSV
                        </button>
                        <button id="download-xlsx-btn" onClick={handleDownloadXLSX} className="btn-primary text-sm px-4 py-2">
                          <Download size={16} /> Excel
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Category breakdown badges */}
                {results.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(
                      results.reduce((acc, r) => { acc[r.category] = (acc[r.category] || 0) + 1; return acc; }, {})
                    ).map(([cat, count]) => (
                      <span key={cat} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold" style={{ backgroundColor: 'var(--color-badge-bg)', color: 'var(--color-badge-text)', border: '1px solid var(--color-border)' }}>
                        {cat} <span className="px-1.5 py-0.5 rounded-md text-xs" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand-strong)' }}>{count}</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Results Table */}
                {results.length > 0 && (
                  <div className="card p-0 overflow-hidden">
                    <button
                      id="toggle-results-table"
                      className="flex items-center justify-between w-full px-5 py-4 cursor-pointer"
                      onClick={() => setExpandedResults(!expandedResults)}
                    >
                      <span className="text-sm font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text)' }}>
                        Results Preview
                      </span>
                      {expandedResults ? <ChevronUp size={18} style={{ color: 'var(--color-text-muted)' }} /> : <ChevronDown size={18} style={{ color: 'var(--color-text-muted)' }} />}
                    </button>

                    {expandedResults && (
                      <div className="overflow-x-auto border-t" style={{ borderColor: 'var(--color-border)' }}>
                        <table className="hc-table min-w-[900px]">
                          <thead>
                            <tr>
                              <th style={{ width: 40 }}>S/N</th>
                              <th>Name</th>
                              <th>Category</th>
                              <th>Type</th>
                              <th>Address</th>
                              <th>Phone</th>
                              <th>Hours</th>
                              <th style={{ width: 50 }} />
                            </tr>
                          </thead>
                          <tbody>
                            {results.map((row, idx) => (
                              <tr key={idx}>
                                <td className="font-bold" style={{ color: 'var(--color-text-muted)' }}>{row.sn}</td>
                                <td>
                                  <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{row.name}</span>
                                  <br />
                                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{row.subCategory}</span>
                                </td>
                                <td>
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold" style={{
                                    backgroundColor: row.type === 'Hard Resource' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(59, 130, 246, 0.08)',
                                    color: row.type === 'Hard Resource' ? '#dc2626' : '#2563eb',
                                  }}>
                                    {row.category}
                                  </span>
                                </td>
                                <td>
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold" style={{
                                    backgroundColor: row.type === 'Hard Resource' ? 'rgba(239, 68, 68, 0.06)' : 'rgba(59, 130, 246, 0.06)',
                                    color: row.type === 'Hard Resource' ? '#b91c1c' : '#1d4ed8',
                                  }}>
                                    {row.type === 'Hard Resource' ? 'Hard' : 'Soft'}
                                  </span>
                                </td>
                                <td>
                                  <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{row.address}</span>
                                </td>
                                <td className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{row.phone}</td>
                                <td className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{row.operatingHours}</td>
                                <td>
                                  {row.website && (
                                    <a href={row.website} target="_blank" rel="noreferrer" className="cursor-pointer" style={{ color: 'var(--color-brand)' }}>
                                      <ExternalLink size={14} />
                                    </a>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* No results state */}
                {results.length === 0 && (
                  <div className="card flex flex-col items-center py-12 text-center">
                    <AlertCircle size={40} style={{ color: 'var(--color-text-muted)' }} />
                    <h3 className="text-base font-bold mt-3" style={{ color: 'var(--color-text)' }}>No Resources Found</h3>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                      Try broadening your search or selecting more categories.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

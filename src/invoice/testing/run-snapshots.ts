import { renderInvoice as renderLegacy, RenderInput } from '../../templates';
import { renderLegacyInput as renderNew } from '../renderer/adapter';

declare const require: any;
declare const __dirname: string;
declare const process: any;

const fs = require('fs');
const path = require('path');

// ─── Test Fixtures ───────────────────────────────────────────────────────────

const mockBusiness: any = {
  id: 'biz_123',
  name: 'YourCompany Solutions Ltd',
  type: 'other',
  brandColor: '#F97316',
  address: '101 Tech Hub, Block 4\nBengaluru, Karnataka - 560001',
  city: 'Bengaluru',
  stateName: 'Karnataka',
  phone: '+91 9876543210',
  email: 'billing@yourcompany.io',
  gstin: '29AAAAA1111A1Z1',
  licenseNumber: 'L-12345',
  upiId: 'yourcompany@ybl',
  bankName: 'ICICI Bank',
  accountNumber: '123456789012',
  ifsc: 'ICIC0001234',
  invoicePrefix: 'INV-',
  invoiceStartNumber: 42,
  customBusinessType: null,
  footerMessage: 'Thank you for choosing us!',
  logo: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH5gYDA'
};

const mockRecord: any = {
  id: 'rec_999',
  documentTypeId: 'doc_type_123',
  number: 'INV-2026-0042',
  data: '{}',
  createdAt: '2026-06-29T01:30:00.000Z'
};

// Fixture 1: Standard Classic Invoice (no GST, flat pricing)
const fixtureClassic: RenderInput = {
  record: mockRecord,
  docName: 'Invoice',
  business: mockBusiness,
  data: {
    'Customer Name': 'Jane Doe Services',
    'Customer State': 'Karnataka',
    'Item Table': [
      { name: 'Software Development Consulting', qty: 10, price: 5000 },
      { name: 'Server Deployment & Setup', qty: 1, price: 15000 }
    ],
    'Project Ref': 'PRJ-ANTIGRAV-09',
    'Due Date': '15 July 2026'
  }
};

// Fixture 2: GST-Compliant Modern Invoice (tax rate applied, Intra-State CGST/SGST split)
const fixtureModernGst: RenderInput = {
  record: mockRecord,
  docName: 'Tax Invoice',
  business: mockBusiness,
  data: {
    'Customer Name': 'Acme Corporation',
    'Customer State': 'Karnataka', // Intra-state (matching business state)
    'Item Table': [
      { name: 'Consulting Services', qty: 2.5, price: 4000, hsn: '998311', unit: 'HRS', gstPct: 18 },
      { name: 'Support Package (Silver)', qty: 1, price: 8000, hsn: '998713', unit: 'NOS', gstPct: 18 }
    ],
    'PO Number': 'PO-98765'
  }
};

// Fixture 3: GST-Compliant Modern Invoice with Inter-State Tax (IGST split)
const fixtureModernInterState: RenderInput = {
  record: mockRecord,
  docName: 'Tax Invoice',
  business: mockBusiness,
  data: {
    'Customer Name': 'Delhi Logistics Co',
    'Customer State': 'Delhi', // Inter-state (business is in Karnataka)
    'Item Table': [
      { name: 'API Integration Consulting', qty: 8, price: 6000, hsn: '998311', unit: 'HRS', gstPct: 18 }
    ],
    'PO Number': 'PO-98766'
  }
};

// Fixture 4: Minimalist Black & White Invoice
const fixtureMinimal: RenderInput = {
  record: mockRecord,
  docName: 'Invoice',
  business: mockBusiness,
  data: {
    'Customer Name': 'Eco Farms Organic',
    'Customer State': 'Maharashtra',
    'Item Table': [
      { name: 'Organic Fertilizers', qty: 50, price: 350, hsn: '3101', unit: 'BAG', gstPct: 5 }
    ]
  }
};

const FIXTURES = [
  { name: 'classic_standard', designId: 'classic', input: fixtureClassic },
  { name: 'modern_gst_intrastate', designId: 'modern', input: fixtureModernGst },
  { name: 'modern_gst_interstate', designId: 'modern', input: fixtureModernInterState },
  { name: 'minimal_standard', designId: 'minimal', input: fixtureMinimal }
];

// ─── Regression Assertion ───────────────────────────────────────────────────

function cleanHtml(html: string): string {
  return html
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n');
}

function runSnapshots() {
  console.log('📸 RUNNING RENDERER SNAPSHOT COMPARISON TESTS');
  
  const snapshotsDir = path.join(__dirname, 'snapshots');
  if (!fs.existsSync(snapshotsDir)) {
    fs.mkdirSync(snapshotsDir, { recursive: true });
  }

  let failedTests = 0;

  for (const f of FIXTURES) {
    console.log(`\nEvaluating: ${f.name} (Design: ${f.designId})`);

    const startTimeLegacy = Date.now();
    const htmlLegacy = renderLegacy(f.designId, f.input);
    const timeLegacy = Date.now() - startTimeLegacy;

    const startTimeNew = Date.now();
    const htmlNew = renderNew(f.designId, f.input);
    const timeNew = Date.now() - startTimeNew;

    // Save baseline files
    fs.writeFileSync(path.join(snapshotsDir, `${f.name}_legacy.html`), htmlLegacy, 'utf8');
    fs.writeFileSync(path.join(snapshotsDir, `${f.name}_new.html`), htmlNew, 'utf8');

    const cleanLegacy = cleanHtml(htmlLegacy);
    const cleanNew = cleanHtml(htmlNew);

    const isMatch = cleanLegacy === cleanNew;

    if (isMatch) {
      console.log(`✅ MATCH: ${f.name} outputs are identical.`);
      console.log(`   └─ Performance: Legacy: ${timeLegacy}ms | New: ${timeNew}ms`);
    } else {
      failedTests++;
      console.error(`❌ REGRESSION MISMATCH: ${f.name} output differs!`);
      
      const legacyLines = cleanLegacy.split('\n');
      const newLines = cleanNew.split('\n');
      
      console.log(`   Legacy Lines Count: ${legacyLines.length} | New Lines Count: ${newLines.length}`);
      
      for (let i = 0; i < Math.min(legacyLines.length, newLines.length); i++) {
        if (legacyLines[i] !== newLines[i]) {
          console.log(`   Mismatch at line ${i + 1}:`);
          console.log(`     Old: "${legacyLines[i].slice(0, 100)}"`);
          console.log(`     New: "${newLines[i].slice(0, 100)}"`);
          break;
        }
      }
    }
  }

  if (failedTests > 0) {
    console.error(`\n💥 SNAPSHOT SUITE FAILED with ${failedTests} mismatches!`);
    throw new Error(`Regression test suite failed with ${failedTests} differences.`);
  } else {
    console.log('\n🎉 ALL SNAPSHOTS MATCH AND PARITY IS SECURED!\n');
  }
}

runSnapshots();

export interface InvoiceItemData {
  readonly name: string;
  readonly qty: number;
  readonly price: number;
  readonly hsn?: string;
  readonly unit?: string;
  readonly gstPct?: number;
  readonly discount?: number;
  readonly taxableValue?: number;
}

export interface InvoiceData {
  readonly recordNumber: string;
  readonly recordCreatedAt: string; // ISO timestamp string
  readonly documentTypeName: string; // e.g., "Tax Invoice", "Estimate"
  readonly customerName: string;
  readonly customerState?: string;
  readonly items: readonly InvoiceItemData[];
  readonly extraFields: readonly { readonly label: string; readonly value: any }[];
  
  // Seller details passed dynamically (avoids global SQLite lookups inside renderer)
  readonly sellerName: string;
  readonly sellerAddress?: string;
  readonly sellerGstin?: string;
  readonly sellerState?: string;
  readonly sellerPhone?: string;
  readonly sellerEmail?: string;
  readonly sellerUpiId?: string;
  readonly sellerBankName?: string;
  readonly sellerAccountNumber?: string;
  readonly sellerIfsc?: string;
}

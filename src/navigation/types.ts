export type RootStackParamList = {
  Main: undefined;
  CreateDocumentType: undefined;
  SuggestedFields: { documentTypeId: string; documentTypeName: string; templateType: string };
  SimpleTemplateEditor: { documentTypeId: string; documentTypeName: string; initialFields: string[] };
  FormDesigner: { documentTypeId: string; documentTypeName: string };
  FillRecord: { documentTypeId: string; documentTypeName: string };
  CreateGstInvoice: { documentTypeId: string; documentTypeName: string };
  PreviewRecord: { recordId: string; documentTypeName: string };
  TemplatePicker: { documentTypeId: string; documentTypeName: string };
  StyleStudio: { documentTypeId: string; documentTypeName: string };
  DocumentDashboard: { documentTypeId: string; documentTypeName: string };
  RecordList: { documentTypeId: string; documentTypeName: string };
  MoreDocuments: undefined;
  GlobalSearch: undefined;
  CustomerHistory: { customerId: string };
  CustomerEdit: { customerId?: string };
};

export type MainTabParamList = {
  Home: undefined;
  Records: undefined;
  Settings: undefined;
};

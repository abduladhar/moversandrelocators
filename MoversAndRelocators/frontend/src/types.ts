export type Tenant = {
  serialNo: number
  id: string
  name: string
  slug: string
  contactEmail: string | null
  phone: string | null
  address: string | null
  isActive: boolean
  createdAtUtc: string
  updatedAtUtc: string
}

export type TenantInput = {
  name: string
  slug: string
  contactEmail: string
  phone: string
  address: string
}

export type Role = {
  id: string
  serialNo: number
  name: string
  code: string
  isSystemRole: boolean
  permissions: string[]
}

export type Permission = { id: string; serialNo: number; code: string; name: string; module: string }

export type User = {
  id: string
  serialNo: number
  fullName: string
  email: string
  isActive: boolean
  lastLoginAtUtc: string | null
  employeeId: string | null
  employeeName: string | null
  roles: Role[]
  /** Null: a tenant user who can switch between the tenant's companies. */
  companyId: string | null
  companyName: string | null
}

export type AuditLog = {
  serialNo: number
  id: string
  actorEmail: string
  action: string
  entityType: string
  entityId: string | null
  changes: string
  ipAddress: string | null
  createdAtUtc: string
}

export type AuthSession = {
  accessToken: string
  expiresAtUtc: string
  user: {
    id: string
    fullName: string
    email: string
    tenantId: string | null
    employeeId: string | null
    isSystemAdmin: boolean
    roles: string[]
    permissions: string[]
  }
  tenantId: string | null
  tenantName: string | null
  /** The company the session works in (inside the tenant). */
  companyId?: string | null
  companyName?: string | null
  /** Companies the user can switch to (only their own for company users). */
  companies?: CompanyOption[]
  /** Tenant users and system administrators can switch companies; company users cannot. */
  canSwitchCompany?: boolean
}

export type CompanyOption = { id: string; code: string; name: string; isDefault: boolean }

export type Company = {
  id: string
  serialNo: number
  code: string
  name: string
  legalName: string | null
  taxNumber: string | null
  address: string | null
  phone: string | null
  email: string | null
  website: string | null
  numberCode: string | null
  isDefault: boolean
  isActive: boolean
  userCount: number
}

export type CompanyInput = Omit<Company, 'id' | 'serialNo' | 'isDefault' | 'isActive' | 'userCount'>

export type Designation = {
  serialNo: number
  id: string
  code: string
  name: string
  level: number
  description: string | null
  isSalesman: boolean
  isActive: boolean
  createdAtUtc: string
  updatedAtUtc: string
}

export type DesignationInput = { code: string; name: string; level: number; description: string; isSalesman: boolean }

export type Employee = {
  serialNo: number
  id: string
  employeeNumber: string
  firstName: string
  lastName: string
  fullName: string
  workEmail: string | null
  phone: string | null
  joiningDate: string
  designationId: string
  designationName: string
  designationLevel: number
  reportsToEmployeeId: string | null
  reportsToName: string | null
  isActive: boolean
  createdAtUtc: string
  updatedAtUtc: string
}

export type EmployeeInput = {
  employeeNumber: string
  firstName: string
  lastName: string
  workEmail: string
  phone: string
  joiningDate: string
  designationId: string
  reportsToEmployeeId: string | null
}

export type EmployeeHierarchyNode = {
  id: string
  employeeNumber: string
  fullName: string
  designation: string
  directReports: EmployeeHierarchyNode[]
}

export type LeadStatus = { serialNo: number; id: string; code: string; name: string; displayOrder: number; color: string | null; isClosed: boolean; isActive: boolean }
export type FollowUpStatus = { serialNo: number; id: string; code: string; name: string; displayOrder: number; color: string | null; isCompleted: boolean; isActive: boolean }
export type MoveType = { serialNo: number; id: string; code: string; name: string; displayOrder: number; description: string | null; isActive: boolean }
export type SalesLead = { serialNo: number; id: string; leadNumber: string; customerName: string; phone: string; email: string | null; source: string | null; moveTypeId: string; moveTypeName: string; origin: string; destination: string; expectedMoveDate: string | null; statusId: string; statusName: string; statusColor: string | null; statusIsClosed: boolean; assignedEmployeeId: string | null; assignedEmployeeName: string | null; notes: string | null; isActive: boolean; createdAtUtc: string; updatedAtUtc: string ; expectedCbm: number; fragileItems: number }
export type SalesLeadInput = { leadNumber: string; customerName: string; phone: string; email: string; source: string; moveTypeId: string; origin: string; destination: string; expectedMoveDate: string | null; statusId: string; assignedEmployeeId: string | null; notes: string }
export type LeadFollowUp = { serialNo: number; id: string; salesLeadId: string; scheduledAtUtc: string; statusId: string; statusName: string; statusColor: string | null; statusIsCompleted: boolean; notes: string; nextFollowUpAtUtc: string | null; createdAtUtc: string; updatedAtUtc: string }
export type FollowUpInput = { scheduledAtUtc: string; statusId: string; notes: string; nextFollowUpAtUtc: string | null }
export type MyTask = { id: string; type: string; module: string; title: string; description: string; dueAtUtc: string; isOverdue: boolean; entityId: string; navigationTarget: string }
export type AwsConfiguration = { serialNo: number; id: string; region: string; bucketName: string; maskedAccessKey: string; hasAccessKey: boolean; hasSecretKey: boolean; createdAtUtc: string; updatedAtUtc: string }
export type AwsConfigurationInput = { region: string; bucketName: string; accessKey: string | null; secretKey: string | null }
export type OpenAiConfiguration = { serialNo: number; id: string; maskedApiKey: string; hasApiKey: boolean; extractionModel: string; transcriptionModel: string; createdAtUtc: string; updatedAtUtc: string; inputPricePerMillion?: number | null; cachedInputPricePerMillion?: number | null; outputPricePerMillion?: number | null; transcriptionPricePerMinute?: number | null }
export type OpenAiConfigurationInput = { apiKey: string | null; extractionModel: string; transcriptionModel: string; inputPricePerMillion?: number | null; cachedInputPricePerMillion?: number | null; outputPricePerMillion?: number | null; transcriptionPricePerMinute?: number | null }
export type ClaudeConfiguration = { serialNo: number; id: string; maskedApiKey: string; hasApiKey: boolean; extractionModel: string; effort: string; createdAtUtc: string; updatedAtUtc: string; inputPricePerMillion?: number | null; cachedInputPricePerMillion?: number | null; outputPricePerMillion?: number | null }
export type ClaudeConfigurationInput = { apiKey: string | null; extractionModel: string; effort: string; inputPricePerMillion?: number | null; cachedInputPricePerMillion?: number | null; outputPricePerMillion?: number | null }
/** AIs the tenant configured for item extraction (first = default); transcription = OpenAI speech-to-text is available. */
export type ExtractionProviders = { providers: { key: 'openai' | 'claude'; name: string; model: string }[]; transcription: boolean }
export type AiUsageTotals = { runs: number; inputTokens: number; outputTokens: number; audioMinutes: number; cost: number | null }
export type AiUsageSummary = { currency: string; pricesConfigured: boolean; thisMonth: AiUsageTotals; allTime: AiUsageTotals; recent: { createdAtUtc: string; feature: string; salesLeadId: string | null; leadNumber: string | null; customerName: string | null; model: string; inputTokens: number; outputTokens: number; audioSeconds: number; cost: number | null; createdBy: string }[] }
export type LeadUploadLink = { requestedItems?: string; description?: string; customerItems?: string; customerDescription?: string; serialNo: number; id: string; salesLeadId: string; expiresAtUtc: string; isActive: boolean; createdAtUtc: string }
export type LeadAttachment = { extractionJson?: string; serialNo: number; id: string; salesLeadId: string; originalFileName: string; contentType: string; declaredSizeBytes: number; storedSizeBytes: number | null; isUploaded: boolean; createdAtUtc: string; uploadedAtUtc: string | null }
export type PublicUploadInfo = { requestedItems?: string; description?: string; customerItems?: string; customerDescription?: string; tenantName: string; leadNumber: string; customerName: string; expiresAtUtc: string }
export type PresignedUpload = { attachmentId: string; uploadUrl: string; urlExpiresAtUtc: string }
export type HouseholdItem = { serialNo: number; id: string; code: string; name: string; volumeCbm: number; description: string | null; isActive: boolean }
export type PackingMaterial = { serialNo: number; id: string; code: string; name: string; unit: string; currentUnitCost: number; description: string | null; isActive: boolean }
export type BoxMaterial = { materialId: string; materialName: string; unit: string; quantity: number; unitCost: number; cost: number }
export type BoxType = { serialNo: number; id: string; code: string; name: string; capacityCbm: number; description: string | null; isActive: boolean; materials: BoxMaterial[]; buildCost: number }
export type Survey = { serialNo: number; id: string; surveyNumber: string; salesLeadId: string | null; customerName: string; phone: string; email: string | null; assignedEmployeeId: string; assignedEmployeeName: string; scheduledAtUtc: string; address: string; latitude: number | null; longitude: number | null; status: string; startedAtUtc: string | null; endedAtUtc: string | null; scheduleConfirmedAtUtc: string | null; itemsConfirmedAtUtc: string | null; notes: string | null; createdAtUtc: string; updatedAtUtc: string }
export type SurveyInput = { surveyNumber: string; salesLeadId: string | null; customerName: string; phone: string; email: string; assignedEmployeeId: string; scheduledAtUtc: string; address: string; notes: string }
export type SurveyItem = { serialNo: number; id: string; householdItemId: string; itemName: string; quantity: number; volumePerUnitCbm: number; totalVolumeCbm: number; notes: string | null }
export type SurveyRoom = { serialNo: number; id: string; name: string; displayOrder: number; items: SurveyItem[]; totalVolumeCbm: number }
export type PlannedBox = { number: number; boxTypeId: string; boxTypeName: string; capacityCbm: number; usedCbm: number; remainingCbm: number; buildCost: number; contents: { roomName: string; itemName: string; volumeCbm: number }[] }
export type MaterialCost = { materialId: string; materialName: string; unit: string; quantity: number; unitCost: number; cost: number }
/** One Claude or OpenAI run charged to the sales lead, reported on the survey and quotation that lead became. */
export type AiSpendLine = { id: string; incurredAtUtc: string; provider: 'Claude' | 'OpenAI'; model: string; feature: string; cost: number | null; currency: string; createdBy: string }
export type AiSpend = { runs: number; cost: number | null; currency: string; lines: AiSpendLine[] }
export type SurveyDetail = { survey: Survey; rooms: SurveyRoom[]; extraMaterials: MaterialCost[]; packingPlan: { boxes: PlannedBox[]; unboxedItems: { roomName: string; itemName: string; volumeCbm: number }[]; materials: MaterialCost[]; itemsVolumeCbm: number; boxCapacityCbm: number; estimatedMaterialCost: number }; customerChanges: CustomerChangeRequest | null; trip: SurveyTrip; leadAiSpend: AiSpend | null }
export type SurveyDetailsInput = { rooms: { name: string; displayOrder: number; items: { householdItemId: string; quantity: number; volumePerUnitCbm: number | null; notes: string }[] }[]; extraMaterials: { materialId: string; quantity: number }[] }
export type PublicSurvey = { id: string; tenantName: string; surveyNumber: string; customerName: string; scheduledAtUtc: string; address: string; status: string; expiresAtUtc: string; scheduleConfirmed: boolean; itemsConfirmed: boolean; rooms: SurveyRoom[]; totalVolumeCbm: number; customerChanges: CustomerChangeRequest | null }
export type ChargeMaster = { serialNo: number; id: string; code: string; name: string; unit: string; defaultRate: number; taxPercent: number; description: string | null; isActive: boolean; createdAtUtc: string; updatedAtUtc: string }
export type TaxMaster = { serialNo: number; id: string; code: string; name: string; kind: 'TAX' | 'CESS'; calculationBasis: 'TAXABLE_AMOUNT' | 'TAX_AMOUNT' | 'QUANTITY'; rate: number; isDefault: boolean; description: string | null; isActive: boolean; createdAtUtc: string; updatedAtUtc: string }
export type Quotation = { revisedFromNumber?: string | null; revisionReason?: string | null; serialNo: number; id: string; quotationNumber: string; surveyId: string | null; surveyNumber: string | null; salesLeadId: string | null; leadNumber: string | null; customerName: string; phone: string; email: string | null; origin: string; destination: string; assignedEmployeeId: string; assignedEmployeeName: string; currency: string; validUntil: string; terms: string | null; notes: string | null; includeSurveyItems: boolean; status: string; subtotal: number; discountTotal: number; taxTotal: number; grandTotal: number; sentAtUtc: string | null; respondedAtUtc: string | null; rejectionReason: string | null; createdAtUtc: string; updatedAtUtc: string }
export type QuotationInput = { quotationNumber: string; surveyId: string | null; salesLeadId: string | null; customerName: string; phone: string; email: string; origin: string; destination: string; assignedEmployeeId: string; currency: string; validUntil: string; terms: string; notes: string; includeSurveyItems: boolean }
export type QuotationLineTax = { taxMasterId: string; code: string; name: string; kind: 'TAX' | 'CESS'; calculationBasis: string; rate: number; taxableBase: number; amount: number }
export type QuotationLine = { serialNo: number; id: string; chargeMasterId: string; chargeName: string; description: string; quantity: number; unit: string; rate: number; discountPercent: number; discountAmount: number; taxPercent: number; taxAmount: number; lineTotal: number; displayOrder: number; taxes: QuotationLineTax[] }
export type QuotationLineInput = { chargeMasterId: string; description: string; quantity: number; rate: number | null; discountPercent: number; taxIds: string[]; displayOrder: number }
export type QuotationSurveyItem = { surveyItemId: string; itemName: string; quantity: number; volumePerUnitCbm: number; totalVolumeCbm: number; notes: string | null }
export type QuotationSurveyRoom = { roomId: string; roomName: string; displayOrder: number; items: QuotationSurveyItem[]; totalVolumeCbm: number }
export type QuotationItem = { serialNo: number; id: string; householdItemId: string; roomName: string; itemName: string; quantity: number; volumePerUnitCbm: number; totalVolumeCbm: number; notes: string | null; displayOrder: number }
export type QuotationItemInput = { householdItemId: string; roomName: string; quantity: number; volumePerUnitCbm: number | null; notes: string; displayOrder: number }
export type RequoteRequest = { serialNo: number; id: string; customerNotes: string | null; createdAtUtc: string; appliedAtUtc: string | null; items: { surveyItemId: string; roomName: string; itemName: string; originalQuantity: number; requestedQuantity: number; notes: string | null }[] }
export type QuotationDetail = { quotation: Quotation; lines: QuotationLine[]; surveyVolumeCbm: number | null; surveyMaterialCost: number | null; surveyRooms: QuotationSurveyRoom[]; quotationItems: QuotationItem[]; requoteRequests: RequoteRequest[]; leadAiSpend: AiSpend | null }
export type PublicQuotation = { tenantName: string; quotation: Quotation; lines: QuotationLine[]; surveyRooms: QuotationSurveyRoom[]; quotationItems: QuotationItem[] }
export type PickupStatus = { serialNo:number; id:string; code:string; name:string; displayOrder:number; color:string|null; isCompleted:boolean; isActive:boolean }
export type Vehicle = { serialNo:number; id:string; registrationNumber:string; name:string; type:string; capacityCbm:number; driverName:string|null; driverPhone:string|null; isActive:boolean }
export type Pickup = { serialNo:number; id:string; pickupNumber:string; quotationId:string|null; customerName:string; phone:string; email:string|null; address:string; latitude:number|null; longitude:number|null; scheduledAtUtc:string; confirmedAtUtc:string|null; statusId:string; statusName:string; statusColor:string|null; vehicleId:string|null; vehicleNumber:string|null; notes:string|null; createdAtUtc:string; quotationNumber:string|null; salesLeadId:string|null; leadNumber:string|null; startedAtUtc:string|null; endedAtUtc:string|null; isPaused:boolean; distanceKm:number|null }
export type PickupPackageItem = { itemName:string; quantity:number; notes:string|null; roomName:string|null; householdItemId:string|null }
export type PickupPackage = { serialNo:number; id:string; boxTypeId:string; boxTypeName:string; trackingNumber:string; notes:string|null; items:PickupPackageItem[]; roomName:string|null; isFragile:boolean }
export type PickupDetail = { pickup:Pickup; assignments:{employeeId:string;employeeName:string;role:string}[]; packages:PickupPackage[]; materials:{materialId:string;materialName:string;unit:string;quantity:number;unitCost:number;totalCost:number;isBoxRecipe:boolean}[]; transactions:{currency?:string;baseAmount?:number;serialNo:number;id:string;transactionNumber:string;type:string;category:string;amount:number;paymentMethod:string;notes:string|null;createdAtUtc:string}[]; income:number; expense:number }
export type PublicPickup = { tenantName:string; pickup:Pickup }
export type CustomerChangeRequest = { requestedAtUtc: string; notes: string | null; removedItems: { surveyItemId: string; roomName: string; itemName: string; quantity: number; reason: string | null }[]; addedItems: { roomName: string; householdItemId: string; itemName: string; quantity: number; volumePerUnitCbm: number; notes: string | null }[] }
export type CustomerChangesInput = { removedItems: { surveyItemId: string; reason: string }[]; addedItems: { roomName: string; householdItemId: string; quantity: number; notes: string }[]; notes: string }
export type CatalogItem = { id: string; name: string; volumeCbm: number }
export type SurveyAttachment = { serialNo: number; id: string; surveyId: string; source: 'CUSTOMER' | 'STAFF'; uploadedBy: string; originalFileName: string; contentType: string; sizeBytes: number; uploadedAtUtc: string | null }
export type SurveyTimeEvent = { id: string; type: 'STARTED' | 'PAUSED' | 'RESUMED' | 'COMPLETED'; occurredAtUtc: string; reason: string | null; recordedBy: string }
export type SurveyExpense = { exchangeRate?:number; serialNo: number; id: string; category: string; amount: number; currency: string; incurredAtUtc: string; paidByEmployeeId: string | null; paidByName: string | null; notes: string | null }
export type SurveyTrip = { conductedByEmployeeId: string | null; conductedByName: string | null; distanceKm: number | null; isPaused: boolean; activeSeconds: number; pausedSeconds: number; events: SurveyTimeEvent[]; expenses: SurveyExpense[]; expenseTotals: { currency: string; amount: number }[] }
export type SurveyExpenseInput = { exchangeRate?:number; category: string; amount: number; currency: string; incurredAtUtc: string; paidByEmployeeId: string | null; notes: string }
export type PickupAttachment = { serialNo: number; id: string; stage: 'BEFORE_PACKING' | 'AFTER_PACKING' | 'OTHER'; roomName: string | null; uploadedBy: string; originalFileName: string; contentType: string; sizeBytes: number; uploadedAtUtc: string | null }
export type PickupSignoff = { id: string; party: 'EMPLOYEE' | 'CUSTOMER'; signerName: string; employeeId: string | null; statement: string; remarks: string | null; signaturePng: string; signedAtUtc: string; recordedBy: string }
export type PackageStorage = { packageId: string; status: string; location: string | null; warehouseId: string | null; warehouseName: string | null; updatedAtUtc: string | null }
export type ExpectedItem = { roomName: string; householdItemId: string | null; itemName: string; quantity: number }
export type PickupWork = { trip: { distanceKm: number | null; isPaused: boolean; activeSeconds: number; pausedSeconds: number; events: SurveyTimeEvent[] }; expenses: SurveyExpense[]; expenseTotals: { currency: string; amount: number }[]; attachments: PickupAttachment[]; signoffs: PickupSignoff[]; storage: PackageStorage[]; expectedInventory: ExpectedItem[]; inventorySource: 'QUOTATION' | 'SURVEY' | null }
export type Warehouse = { serialNo: number; id: string; code: string; name: string; address: string | null; isActive: boolean }



/** The customer side of a record's shared links (see CustomerReplyTag). */
export type CustomerReplyRecordType = 'SALES_LEAD' | 'QUOTATION' | 'SURVEY' | 'PICKUP' | 'PACKING_JOB' | 'DELIVERY_JOB'
export type CustomerReplyState = 'PENDING' | 'EXPIRED' | 'REPLIED' | 'ACTION_TAKEN'
export type CustomerReply = { recordType: CustomerReplyRecordType; recordId: string; state: CustomerReplyState; sharedAtUtc?: string | null; expiresAtUtc?: string | null; repliedAtUtc?: string | null; replyKind?: string | null; replyNote?: string | null; handledAtUtc?: string | null; handledBy?: string | null; handledAction?: string | null; handledNote?: string | null }
/** One step of a record's customer history. actor is the staff member's name, or CUSTOMER. */
export type CustomerReplyEvent = { event: 'SHARED' | 'REPLIED' | 'ACTION_TAKEN' | 'WITHDRAWN'; detail?: string | null; note?: string | null; actor: string; atUtc: string; expiresAtUtc?: string | null }


export interface Vehicle {
  id: string;
  plateNumber: string;
  vin: string;
  brand: string;
  model: string;
  year: number;
  fuelType: "Gasolina" | "Diesel" | "Eléctrico" | "Híbrido" | "Otro";
  currentMileage: number;
  nextPreventiveMaintenanceMileage: number;
  nextPreventiveMaintenanceDate: string; // YYYY-MM-DD
  status: "Activo" | "En Taller" | "Inactivo";
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  imageUrl?: string;
  // Auditoría
  createdByUserId?: string;
  updatedByUserId?: string;
  createdByUsername?: string;
  updatedByUsername?: string;
}

export interface AttachedDocument {
  id: string;
  maintenanceLogId: string;
  fileName: string;
  fileType: string;
  fileContent: string; // Base64 Data URI
  createdAt: string;
}

export interface MaintenanceLog {
  id: string;
  vehicleId: string;
  vehiclePlateNumber?: string; // For display purposes
  maintenanceType: "Preventivo" | "Correctivo";
  executionDate: string; // YYYY-MM-DD
  mileageAtService: number;
  activitiesPerformed: string;
  cost: number;
  provider: string;
  nextMaintenanceDateScheduled: string; // YYYY-MM-DD
  nextMaintenanceMileageScheduled: number;
  createdAt: string; // ISO date string
  updatedAt?: string; // ISO date string
  attachments?: AttachedDocument[];
  // Auditoría
  createdByUserId?: string;
  updatedByUserId?: string;
  createdByUsername?: string;
  updatedByUsername?: string;
}

export interface FuelingLog {
  id: string;
  vehicleId: string;
  vehiclePlateNumber?: string; // For display purposes
  fuelingDate: string; // YYYY-MM-DD
  mileageAtFueling: number;
  quantityLiters: number;
  costPerLiter: number;
  totalCost: number;
  fuelEfficiencyKmPerGallon?: number;
  station: string;
  createdAt: string; // ISO date string
  imageUrl?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  fullName?: string;
  passwordHash: string; // Hash de la contraseña
  role: "Admin" | "Standard";
  permissions: string[]; // Array de rutas/funcionalidades permitidas
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

export interface Alert {
  id: string;
  vehicleId: string;
  vehiclePlateNumber?: string; // For display
  alertType: "PreventiveMaintenanceDue" | "DocumentExpiry" | "LowMileageEfficiency" | "HighMaintenanceCost";
  message: string;
  dueDate?: string; // YYYY-MM-DD
  status: "Nueva" | "Vista" | "Resuelta";
  createdAt: string; // ISO date string
  severity?: "Low" | "Medium" | "High";
}

export interface AuditEvent {
  id: string;
  eventType:
    | "LOGIN"
    | "LOGOUT"
    | "USER_CREATED"
    | "USER_UPDATED"
    | "USER_DELETED"
    | "PASSWORD_CHANGED"
    | "USER_ACTIVATION_CHANGED"
    | "USER_ROLE_CHANGED"
    | "SESSION_INVALIDATED";
  actorUserId?: string;
  actorUsername?: string;
  targetUserId?: string;
  targetUsername?: string;
  message?: string;
  detailsJson?: string; // JSON string with extra details
  createdAt: string;
}

// FormData types
export type VehicleFormData = Omit<Vehicle, "id" | "createdAt" | "updatedAt" | "imageUrl" | "nextPreventiveMaintenanceDate"> & {
  nextPreventiveMaintenanceDate: Date;
};

export interface NewAttachmentPayload {
  name: string;
  type: string;
  content: string; // Base64 Data URI
}

export type MaintenanceFormData = Omit<MaintenanceLog, "id" | "createdAt" | "vehiclePlateNumber" | "executionDate" | "nextMaintenanceDateScheduled" | "attachments"> & {
  executionDate: Date;
  nextMaintenanceDateScheduled: Date;
  newAttachments?: NewAttachmentPayload[];
  attachmentsToRemove?: string[]; // IDs of existing attachments to remove
};


export type FuelingFormData = Omit<FuelingLog, "id" | "createdAt" | "vehiclePlateNumber" | "fuelEfficiencyKmPerGallon" | "fuelingDate" | "imageUrl"> & {
  fuelingDate: Date;
  imageUrl?: string;
};

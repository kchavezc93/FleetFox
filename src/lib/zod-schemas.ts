
import { z } from "zod";

export const vehicleSchema = z.object({
  plateNumber: z.string().min(1, "La matrícula es obligatoria").max(10, "Matrícula demasiado larga"),
  vin: z.string().min(1, "El VIN es obligatorio").max(50, "VIN demasiado largo"),
  brand: z.string().min(1, "La marca es obligatoria").max(50, "Marca demasiado larga"),
  model: z.string().min(1, "El modelo es obligatorio").max(50, "Modelo demasiado largo"),
  year: z.coerce.number().min(1900, "Año inválido").max(new Date().getFullYear() + 1, "Año inválido"),
  fuelType: z.enum(["Gasolina", "Diesel", "Eléctrico", "Híbrido", "Otro"]),
  currentMileage: z.coerce.number().min(0, "El kilometraje debe ser un número positivo o cero"),
  nextPreventiveMaintenanceMileage: z.coerce.number().min(0, "El kilometraje de próximo mantenimiento debe ser positivo o cero"),
  nextPreventiveMaintenanceDate: z.date({ required_error: "La fecha de próximo mantenimiento es obligatoria." }),
  status: z.enum(["Activo", "En Taller", "Inactivo"]),
});

export type VehicleSchema = z.infer<typeof vehicleSchema>;

const newAttachmentSchema = z.object({
  name: z.string().min(1, "El nombre del archivo es obligatorio."),
  type: z.string().min(1, "El tipo de archivo es obligatorio."),
  content: z.string().min(1, "El contenido del archivo es obligatorio."), // Base64 Data URI
});

export const maintenanceLogSchema = z.object({
  vehicleId: z.string().min(1, "La selección del vehículo es obligatoria"),
  maintenanceType: z.enum(["Preventivo", "Correctivo"]),
  executionDate: z.date({ required_error: "La fecha de ejecución es obligatoria." }),
  mileageAtService: z.coerce.number().min(0, "El kilometraje debe ser un número positivo o cero"),
  activitiesPerformed: z.string().min(1, "Las actividades realizadas son obligatorias").max(1000, "Descripción demasiado larga"),
  cost: z.coerce.number().min(0, "El costo debe ser un número positivo o cero"),
  provider: z.string().min(1, "El proveedor es obligatorio").max(100, "Nombre del proveedor demasiado largo"),
  nextMaintenanceDateScheduled: z.date({ required_error: "La fecha de próximo mantenimiento es obligatoria." }),
  nextMaintenanceMileageScheduled: z.coerce.number().min(0, "El kilometraje de próximo mantenimiento debe ser positivo o cero"),
  newAttachments: z.array(newAttachmentSchema).optional().default([]),
  attachmentsToRemove: z.array(z.string()).optional().default([]), // IDs of existing attachments to remove
});

export type MaintenanceLogSchema = z.infer<typeof maintenanceLogSchema>;


export const fuelingLogSchema = z.object({
  vehicleId: z.string().min(1, "La selección del vehículo es obligatoria"),
  fuelingDate: z.date({ required_error: "La fecha de carga es obligatoria." }),
  mileageAtFueling: z.coerce.number().min(0, "El kilometraje debe ser un número positivo o cero"),
  quantityLiters: z.coerce.number().min(0.01, "La cantidad debe ser positiva"),
  costPerLiter: z.coerce.number().min(0.01, "El costo por litro debe ser positivo"),
  totalCost: z.coerce.number().min(0.01, "El costo total debe ser positivo"),
  station: z.string().min(1, "La estación de servicio es obligatoria").max(100, "Nombre de la estación demasiado largo"),
  responsible: z.string().min(1, "El responsable es obligatorio").max(100, "Nombre del responsable demasiado largo"),
  imageUrl: z.string().url("Debe ser una URL válida para la imagen.").optional().or(z.literal('')),
  newVoucher: z.object({ name: z.string(), type: z.string(), content: z.string() }).optional()
});

export type FuelingLogSchema = z.infer<typeof fuelingLogSchema>;

export const dbConnectionSchema = z.object({
  dbType: z.enum(["PostgreSQL", "MySQL", "SQLServer", "SQLite"], {
    required_error: "El tipo de base de datos es obligatorio.",
  }),
  dbHost: z.string().min(1, "El host es obligatorio."),
  dbPort: z.coerce.number().min(1, "El puerto debe ser un número positivo.").max(65535, "Puerto inválido."),
  dbUser: z.string().min(1, "El usuario es obligatorio."),
  dbPassword: z.string().optional(),
  dbName: z.string().min(1, "El nombre de la base de datos es obligatorio."),
});

export type DbConnectionSchema = z.infer<typeof dbConnectionSchema>;

export const loginSchema = z.object({
  email: z.string().email("Correo electrónico inválido."),
  password: z.string().min(1, "La contraseña es obligatoria."),
});
export type LoginSchema = z.infer<typeof loginSchema>;

export const userSchema = z.object({
  id: z.string().optional(),
  email: z.string().email("Correo electrónico inválido."),
  username: z.string().min(3, "El nombre de usuario debe tener al menos 3 caracteres."),
  fullName: z.string().optional(),
  // En edición, permitir campo vacío como "no cambiar": '' -> undefined
  password: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
    z.string().min(6, "La contraseña debe tener al menos 6 caracteres.").optional()
  ),
  role: z.enum(["Admin", "Standard"]),
  permissions: z.array(z.string()).default([]),
  active: z.coerce.boolean().default(true),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type UserSchema = z.infer<typeof userSchema>;

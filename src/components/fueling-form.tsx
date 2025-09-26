
"use client";

import type { FuelingFormData, Vehicle, FuelingVoucher } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { fuelingLogSchema, type FuelingLogSchema } from "@/lib/zod-schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { CalendarIcon, Save, Loader2, ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { VOUCHER_MAX_PER_FUELING } from "@/lib/config";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import React from "react";

// Helpers for voucher compression
async function readFileAsDataURL(file: File): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('No se pudo leer el archivo del voucher'));
      reader.onload = () => resolve(String(reader.result || ''));
      reader.readAsDataURL(file);
    } catch (e) {
      reject(e as Error);
    }
  });
}

function base64SizeFromDataUrl(dataUrl: string): number {
  const i = dataUrl.indexOf('base64,');
  const b64 = i >= 0 ? dataUrl.substring(i + 7) : '';
  // Cada 4 chars base64 son 3 bytes
  return Math.ceil((b64.length * 3) / 4);
}

async function compressImageToDataUrl(file: File, opts?: { maxEdge?: number; qualityStart?: number; targetMaxBytes?: number; step?: number }): Promise<string> {
  const { maxEdge = 1600, qualityStart = 0.8, targetMaxBytes = 1_000_000, step = 0.1 } = opts || {};
  // Cargar imagen
  const srcDataUrl = await readFileAsDataURL(file);
  const img = new Image();
  img.decoding = 'async' as any;
  const loaded: Promise<void> = new Promise((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('No se pudo cargar la imagen del voucher'));
  });
  img.src = srcDataUrl;
  await loaded;

  // Calcular escala manteniendo aspecto
  let { width, height } = img;
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const targetW = Math.max(1, Math.round(width * scale));
  const targetH = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo preparar el lienzo para comprimir la imagen');
  ctx.drawImage(img, 0, 0, targetW, targetH);

  // Intentar calidades decrecientes hasta cumplir el tamaño objetivo
  let q = qualityStart;
  let dataUrl = canvas.toDataURL('image/jpeg', q);
  let size = base64SizeFromDataUrl(dataUrl);
  while (size > targetMaxBytes && q > 0.3) {
    q = Math.max(0.3, q - step);
    dataUrl = canvas.toDataURL('image/jpeg', q);
    size = base64SizeFromDataUrl(dataUrl);
  }
  return dataUrl;
}

interface FuelingFormProps {
  vehicles: Vehicle[];
  onSubmitAction: (data: FuelingFormData) => Promise<{ message: string; errors?: any }>;
  initial?: Partial<FuelingFormData> & { id?: string };
  submitLabel?: string;
  redirectPath?: string; // optional: where to go on success
  existingVouchers?: Pick<FuelingVoucher, 'id' | 'fileName' | 'fileContent'>[];
}

export function FuelingForm({ vehicles, onSubmitAction, initial, submitLabel, redirectPath, existingVouchers }: FuelingFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isClient, setIsClient] = React.useState(false);
  const [pendingVouchers, setPendingVouchers] = React.useState<{ name: string; type: string; content: string }[]>([]);
  const [toRemoveIds, setToRemoveIds] = React.useState<string[]>([]);
  const [isProcessingFiles, setIsProcessingFiles] = React.useState(false);
  const MAX_VOUCHERS = VOUCHER_MAX_PER_FUELING;
  const existingCount = (existingVouchers?.length || 0);
  const availableSlots = Math.max(0, MAX_VOUCHERS - (existingCount - toRemoveIds.length) - pendingVouchers.length);

  // Utilidad para rotar imagen base64 90 grados (simple, canvas)
  async function rotateDataUrl90(dataUrl: string): Promise<string> {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.height;
        canvas.height = img.width;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('No se pudo preparar el lienzo para rotar.')); return; }
        ctx.translate(canvas.width/2, canvas.height/2);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(img, -img.width/2, -img.height/2);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      };
      img.onerror = () => reject(new Error('No se pudo cargar la imagen para rotar.'));
      img.src = dataUrl;
    });
  }

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  const form = useForm<FuelingLogSchema>({
    resolver: zodResolver(fuelingLogSchema),
    defaultValues: {
      vehicleId: initial?.vehicleId ? String(initial.vehicleId).trim() : "",
      fuelingDate: initial?.fuelingDate ? (initial.fuelingDate instanceof Date ? initial.fuelingDate : new Date(initial.fuelingDate)) : new Date(), 
      mileageAtFueling: initial?.mileageAtFueling ?? 0,
      quantityLiters: initial?.quantityLiters ?? 0, 
      costPerLiter: initial?.costPerLiter ?? 0, 
      totalCost: initial?.totalCost ?? 0,
      station: initial?.station || "",
      responsible: (initial as any)?.responsible || "",
      imageUrl: initial?.imageUrl || "",
      // schema tiene defaults para arrays a nivel zod; no es necesario incluir aquí
    },
  });

  // Normalizar explícitamente el vehicleId al montar/actualizar props para evitar desajustes (espacios/tipos)
  React.useEffect(() => {
    if (initial?.vehicleId != null) {
      const normalized = String(initial.vehicleId).trim();
      const current = form.getValues("vehicleId") || "";
      if (current !== normalized) {
        form.setValue("vehicleId", normalized, { shouldValidate: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.vehicleId]);

  const quantity = form.watch("quantityLiters");
  const costPerUnit = form.watch("costPerLiter"); 

  React.useEffect(() => {
    if (typeof quantity === 'number' && typeof costPerUnit === 'number' && quantity > 0 && costPerUnit > 0) {
      const total = parseFloat((quantity * costPerUnit).toFixed(2));
      form.setValue("totalCost", total, { shouldValidate: true });
    } else if (quantity === 0 || costPerUnit === 0) {
       form.setValue("totalCost", 0, { shouldValidate: true });
    }
  }, [quantity, costPerUnit, form]);

  async function onSubmit(data: FuelingLogSchema) {
    setIsSubmitting(true);
    try {
      // Validación límite total local
      const remainingExisting = Math.max(0, (existingVouchers?.length || 0) - toRemoveIds.length);
      const totalAfter = remainingExisting + pendingVouchers.length;
      if (totalAfter > MAX_VOUCHERS) {
        throw new Error(`Solo se permiten ${MAX_VOUCHERS} vouchers por registro.`);
      }
      const formDataForAction: FuelingFormData = {
        ...data,
        fuelingDate: data.fuelingDate, 
        imageUrl: data.imageUrl || undefined, // Ensure undefined if empty string
        // newVouchers y vouchersToRemove se setean abajo
      };
      // Adjuntar vouchers pendientes y eliminaciones
      if (pendingVouchers.length > 0) {
        formDataForAction.newVouchers = pendingVouchers;
      }
      if (toRemoveIds.length > 0) {
        formDataForAction.vouchersToRemove = toRemoveIds;
      }
      const result = await onSubmitAction(formDataForAction);
      toast({
        title: "Éxito",
        description: result.message,
      });
      if (!result.errors) {
        router.push(redirectPath || "/fueling");
        router.refresh();
      } else {
         Object.entries(result.errors).forEach(([field, message]) => {
          form.setError(field as keyof FuelingLogSchema, { type: "manual", message: message as string });
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: (error as Error)?.message || "Ocurrió un error inesperado.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField<FuelingLogSchema, "vehicleId">
            control={form.control}
            name="vehicleId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vehículo *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={Boolean(initial?.id)}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione un vehículo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {vehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={String(vehicle.id).trim()}>
                        {vehicle.plateNumber} ({vehicle.brand} {vehicle.model})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField<FuelingLogSchema, "fuelingDate">
            control={form.control}
            name="fuelingDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fecha de Carga *</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {isClient && field.value ? (
                          // Renderizar una fecha estable para SSR/CSR evitando formatos locales variables
                          `${field.value.getFullYear()}-${String(field.value.getMonth()+1).padStart(2,'0')}-${String(field.value.getDate()).padStart(2,'0')}`
                        ) : (
                          <span>Cargando fecha...</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    {isClient && (
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        // Bloquear fechas futuras en el cliente
                        disabled={(date) => date > new Date()}
                        // También forzar max date via props if supported by DayPicker patterns
                        initialFocus
                      />
                    )}
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField<FuelingLogSchema, "mileageAtFueling">
            control={form.control}
            name="mileageAtFueling"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Kilometraje en Carga (km) *</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="Ej: 52000" {...field} value={field.value || 0} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField<FuelingLogSchema, "quantityLiters">
            control={form.control}
            name="quantityLiters" 
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cantidad (Litros) *</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="Ej: 50.5" {...field} value={field.value || 0} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField<FuelingLogSchema, "costPerLiter">
            control={form.control}
            name="costPerLiter" 
            render={({ field }) => (
              <FormItem>
                <FormLabel>Costo por Litro (C$) *</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="Ej: 35.50" {...field} value={field.value || 0} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField<FuelingLogSchema, "totalCost">
            control={form.control}
            name="totalCost"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Costo Total (C$) *</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="Calculado o ingrese manualmente" {...field} value={field.value || 0} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField<FuelingLogSchema, "station">
            control={form.control}
            name="station"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Estación de Servicio *</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: Puma Av. Principal" {...field} value={field.value} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField<FuelingLogSchema, "responsible">
          control={form.control}
          name="responsible"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Responsable *</FormLabel>
              <FormControl>
                <Input placeholder="Nombre de quien registró" {...field} value={field.value} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

          {/* Campo URL de imagen oculto por ahora: se reemplaza por carga de voucher en BD */}

        <div className="space-y-3 md:col-span-2">
          <div>
            <FormLabel className="flex items-center">
              <ImagePlus className="mr-2 h-4 w-4 text-muted-foreground"/>
              Vouchers (fotos) – almacenar en BD
            </FormLabel>
            <div className="text-xs text-muted-foreground mb-1">Máximo {MAX_VOUCHERS} por registro. Disponibles: {availableSlots}</div>
            <Input
              id="voucher-files"
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              onChange={async (e) => {
                setIsProcessingFiles(true);
                const chosen = Array.from(e.target.files || []);
                if (availableSlots <= 0) {
                  toast({ title: 'Límite alcanzado', description: `Ya no hay espacios disponibles (máximo ${MAX_VOUCHERS}).`, variant: 'destructive' });
                  e.currentTarget.value = '';
                  setIsProcessingFiles(false);
                  return;
                }
                const files = chosen.slice(0, availableSlots);
                const MAX_ORIGINAL_BYTES = 20 * 1024 * 1024;
                const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
                const prepared: { name: string; type: string; content: string }[] = [];
                for (const file of files) {
                  if (file.size > MAX_ORIGINAL_BYTES) {
                    toast({ title: 'Archivo muy grande', description: `${file.name} supera 20MB.`, variant: 'destructive' });
                    continue;
                  }
                  try {
                    const dataUrl = file.type.startsWith('image/')
                      ? await compressImageToDataUrl(file, { maxEdge: 1600, qualityStart: 0.8, targetMaxBytes: 1_000_000, step: 0.1 })
                      : await readFileAsDataURL(file);
                    const bytes = base64SizeFromDataUrl(dataUrl);
                    if (bytes > MAX_UPLOAD_BYTES) {
                      toast({ title: 'Archivo aún grande', description: `${file.name} sigue siendo muy grande tras comprimir.`, variant: 'destructive' });
                      continue;
                    }
                    prepared.push({ name: file.name, type: file.type || 'application/octet-stream', content: dataUrl });
                  } catch (err) {
                    toast({ title: 'Error al procesar', description: `${file.name}: ${(err as Error).message}` , variant: 'destructive' });
                  }
                }
                setPendingVouchers((prev) => [...prev, ...prepared]);
                // Limpiar input para permitir re-selección del mismo archivo
                e.currentTarget.value = '';
                setIsProcessingFiles(false);
                if (chosen.length > files.length) {
                  toast({ title: 'Se limitaron archivos', description: `Solo se agregaron ${files.length} archivo(s) por el límite de ${MAX_VOUCHERS}.`, variant: 'default' });
                }
              }}
            />
            {/* Drag & drop sencillo */}
            <div
              className="mt-2 border-2 border-dashed rounded p-3 text-xs text-muted-foreground"
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={async (e) => {
                e.preventDefault(); e.stopPropagation();
                const chosen = Array.from(e.dataTransfer?.files || []);
                if (chosen.length === 0) return;
                if (availableSlots <= 0) {
                  toast({ title: 'Límite alcanzado', description: `Ya no hay espacios disponibles (máximo ${MAX_VOUCHERS}).`, variant: 'destructive' });
                  return;
                }
                const dtFiles = chosen.slice(0, availableSlots);
                setIsProcessingFiles(true);
                const MAX_ORIGINAL_BYTES = 20 * 1024 * 1024;
                const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
                const prepared: { name: string; type: string; content: string }[] = [];
                for (const file of dtFiles) {
                  if (file.size > MAX_ORIGINAL_BYTES) { continue; }
                  try {
                    const dataUrl = file.type.startsWith('image/')
                      ? await compressImageToDataUrl(file, { maxEdge: 1600, qualityStart: 0.8, targetMaxBytes: 1_000_000, step: 0.1 })
                      : await readFileAsDataURL(file);
                    const bytes = base64SizeFromDataUrl(dataUrl);
                    if (bytes > MAX_UPLOAD_BYTES) { continue; }
                    prepared.push({ name: file.name, type: file.type || 'application/octet-stream', content: dataUrl });
                  } catch {}
                }
                setPendingVouchers((prev) => [...prev, ...prepared]);
                setIsProcessingFiles(false);
                if (chosen.length > dtFiles.length) {
                  toast({ title: 'Se limitaron archivos', description: `Solo se agregaron ${dtFiles.length} archivo(s) por el límite de ${MAX_VOUCHERS}.`, variant: 'default' });
                }
              }}
            >
              Arrastra imágenes aquí para agregarlas
            </div>
            <FormDescription>
              Opcional. Puedes tomar o arrastrar varias fotos del voucher/recibo.
            </FormDescription>
            {isProcessingFiles && (
              <div className="text-xs text-muted-foreground">Procesando imágenes…</div>
            )}
          </div>

          {/* Vouchers existentes (solo en edición) */}
          {existingVouchers && existingVouchers.length > 0 && (
            <div>
              <div className="text-sm text-muted-foreground mb-2">Vouchers existentes</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {existingVouchers.map((v) => {
                  const checked = toRemoveIds.includes(v.id);
                  return (
                    <div key={v.id} className={cn("border rounded overflow-hidden", checked && 'opacity-60 ring-2 ring-destructive/50') }>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={v.fileContent} alt={v.fileName} className="w-full h-28 object-cover" />
                      <div className="p-2 flex items-center justify-between gap-2">
                        <div className="text-xs truncate" title={v.fileName}>{v.fileName}</div>
                        <label className="text-xs inline-flex items-center gap-1 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            className="h-3 w-3"
                            checked={checked}
                            onChange={(e) => {
                              setToRemoveIds((prev) => e.target.checked ? [...prev, v.id] : prev.filter((id) => id !== v.id));
                            }}
                          />
                          Eliminar
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Vouchers nuevos seleccionados (previews locales) */}
          {pendingVouchers.length > 0 && (
            <div>
              <div className="text-sm text-muted-foreground mb-2">Vouchers a agregar</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {pendingVouchers.map((pv, idx) => (
                  <div key={`${pv.name}-${idx}`} className="border rounded overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={pv.content} alt={pv.name} className="w-full h-28 object-cover" />
                    <div className="p-2 flex items-center justify-between gap-2">
                      <div className="text-xs truncate" title={pv.name}>{pv.name}</div>
                      <div className="flex items-center gap-2">
                        <button type="button" className="text-xs underline" onClick={async () => {
                          try {
                            const rotated = await rotateDataUrl90(pv.content);
                            setPendingVouchers((prev) => prev.map((x, i) => i === idx ? { ...x, content: rotated } : x));
                          } catch {}
                        }}>Rotar</button>
                        <button type="button" className="text-xs text-destructive" onClick={() => setPendingVouchers((prev) => prev.filter((_, i) => i !== idx))}>Quitar</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="flex justify-end pt-6 border-t">
          <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90">
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {submitLabel || (initial ? "Guardar Cambios" : "Registrar Carga")}
          </Button>
        </div>
      </form>
    </Form>
  );
}

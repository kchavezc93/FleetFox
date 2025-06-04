
"use client";

import type { MaintenanceFormData, Vehicle, MaintenanceLog, AttachedDocument, NewAttachmentPayload } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { maintenanceLogSchema, type MaintenanceLogSchema } from "@/lib/zod-schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { CalendarIcon, Save, Loader2, Paperclip, XCircle, UploadCloud, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import React, { useState, useEffect, useCallback } from "react";

interface MaintenanceFormProps {
  vehicles: Vehicle[];
  onSubmitAction: (data: MaintenanceFormData) => Promise<{ message: string; errors?: any; log?: MaintenanceLog }>;
  maintenanceLog?: MaintenanceLog | null;
}

interface DisplayableAttachment extends Partial<AttachedDocument> {
  isNew?: boolean; // Flag to differentiate new files from existing ones
  fileObject?: File; // For new files, to keep the original file object if needed
  tempId?: string; // Temporary ID for client-side keying of new files
}

export function MaintenanceForm({ vehicles, onSubmitAction, maintenanceLog }: MaintenanceFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClient, setIsClient] = useState(false);
  
  // Local state to manage the list of attachments displayed in the UI
  const [currentAttachments, setCurrentAttachments] = useState<DisplayableAttachment[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const form = useForm<MaintenanceLogSchema>({
    resolver: zodResolver(maintenanceLogSchema),
    defaultValues: {
      vehicleId: maintenanceLog?.vehicleId || "",
      maintenanceType: maintenanceLog?.maintenanceType || "Preventivo",
      executionDate: maintenanceLog?.executionDate ? new Date(maintenanceLog.executionDate + "T00:00:00") : new Date(),
      mileageAtService: maintenanceLog?.mileageAtService || 0,
      activitiesPerformed: maintenanceLog?.activitiesPerformed || "",
      cost: maintenanceLog?.cost || 0,
      provider: maintenanceLog?.provider || "",
      nextMaintenanceDateScheduled: maintenanceLog?.nextMaintenanceDateScheduled ? new Date(maintenanceLog.nextMaintenanceDateScheduled + "T00:00:00") : new Date(),
      nextMaintenanceMileageScheduled: maintenanceLog?.nextMaintenanceMileageScheduled || 0,
      newAttachments: [],
      attachmentsToRemove: [],
    },
  });

  const { fields: newAttachmentFields, append: appendNewAttachment, remove: removeNewAttachment } = useFieldArray({
    control: form.control,
    name: "newAttachments",
  });
  
  const { fields: attachmentsToRemoveFields, append: appendAttachmentToRemove } = useFieldArray({
    control: form.control,
    name: "attachmentsToRemove",
  });


  useEffect(() => {
    setIsClient(true);
    if (maintenanceLog) {
      form.reset({
        vehicleId: maintenanceLog.vehicleId,
        maintenanceType: maintenanceLog.maintenanceType,
        executionDate: new Date(maintenanceLog.executionDate + "T00:00:00"),
        mileageAtService: maintenanceLog.mileageAtService,
        activitiesPerformed: maintenanceLog.activitiesPerformed,
        cost: maintenanceLog.cost,
        provider: maintenanceLog.provider || "",
        nextMaintenanceDateScheduled: new Date(maintenanceLog.nextMaintenanceDateScheduled + "T00:00:00"),
        nextMaintenanceMileageScheduled: maintenanceLog.nextMaintenanceMileageScheduled || 0,
        newAttachments: [], // Reset new attachments when log changes
        attachmentsToRemove: [], // Reset removals
      });
      // Populate currentAttachments from existing log
      setCurrentAttachments(maintenanceLog.attachments?.map(att => ({...att, isNew: false})) || []);
    } else {
      form.reset({ // Default values for new log
        vehicleId: "",
        maintenanceType: "Preventivo",
        executionDate: new Date(),
        mileageAtService: 0,
        activitiesPerformed: "",
        cost: 0,
        provider: "",
        nextMaintenanceDateScheduled: new Date(),
        nextMaintenanceMileageScheduled: 0,
        newAttachments: [],
        attachmentsToRemove: [],
      });
      setCurrentAttachments([]);
    }
  }, [maintenanceLog, form, setIsClient]);


  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newDisplayAttachments: DisplayableAttachment[] = [...currentAttachments];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();
        reader.onload = (loadEvent) => {
          const base64Content = loadEvent.target?.result as string;
          // Add to local UI state for display
           const displayAtt: DisplayableAttachment = {
            fileName: file.name,
            fileType: file.type,
            fileContent: base64Content, // For display, not directly submitted this way
            isNew: true,
            fileObject: file, // Keep original file if needed for preview types
            tempId: `new-${Date.now()}-${i}` // Temp ID for keying
          };
          setCurrentAttachments(prev => [...prev, displayAtt]);
          
          // Add to form state for submission
          appendNewAttachment({
            name: file.name,
            type: file.type,
            content: base64Content,
          });
        };
        reader.readAsDataURL(file);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = ""; // Clear the file input
      }
    }
  };

  const removeAttachment = (attachmentIdOrTempId: string, isNew: boolean) => {
    if (isNew) {
      // Find the index in form's newAttachments array by comparing name/content (or use tempId if stored there)
      const formAttachmentIndex = form.getValues("newAttachments").findIndex(att => 
        currentAttachments.find(ca => ca.tempId === attachmentIdOrTempId && ca.fileName === att.name && ca.fileContent === att.content)
      );
      if (formAttachmentIndex !== -1) {
        removeNewAttachment(formAttachmentIndex);
      }
      setCurrentAttachments(prev => prev.filter(att => att.tempId !== attachmentIdOrTempId));
    } else { // Existing attachment
      // Add its ID to the attachmentsToRemove list in the form
      appendAttachmentToRemove(attachmentIdOrTempId);
      // Remove from local UI display list
      setCurrentAttachments(prev => prev.filter(att => att.id !== attachmentIdOrTempId));
    }
  };
  
  const maintenanceType = form.watch("maintenanceType");

  async function onSubmit(data: MaintenanceLogSchema) {
    setIsSubmitting(true);
    try {
      const payload: MaintenanceFormData = {
        vehicleId: data.vehicleId,
        maintenanceType: data.maintenanceType,
        executionDate: data.executionDate,
        mileageAtService: data.mileageAtService,
        activitiesPerformed: data.activitiesPerformed,
        cost: data.cost,
        provider: data.provider,
        nextMaintenanceDateScheduled: data.nextMaintenanceDateScheduled,
        nextMaintenanceMileageScheduled: data.nextMaintenanceMileageScheduled,
        newAttachments: data.newAttachments || [],
        attachmentsToRemove: data.attachmentsToRemove || [],
      };

      const result = await onSubmitAction(payload);
      toast({
        title: "Éxito",
        description: result.message,
      });
      if (result.log && !result.errors) {
        router.push(`/maintenance/${result.log.id}`);
        router.refresh();
      } else if (result.errors) {
        Object.entries(result.errors).forEach(([field, message]) => {
          form.setError(field as keyof MaintenanceLogSchema, { type: "manual", message: message as string });
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Ocurrió un error inesperado.",
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
          <FormField
            control={form.control}
            name="vehicleId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vehículo *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={!!maintenanceLog}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione un vehículo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {vehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.plateNumber} ({vehicle.brand} {vehicle.model})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="maintenanceType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de Mantenimiento *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione el tipo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Preventivo">Preventivo</SelectItem>
                    <SelectItem value="Correctivo">Correctivo</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="executionDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fecha de Ejecución *</FormLabel>
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
                          format(field.value, "PPP")
                        ) : (
                          <span>Seleccione una fecha</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) => date > new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="mileageAtService"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Kilometraje en Servicio (km) *</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="Ej: 55000" {...field} value={field.value || 0} onChange={e => field.onChange(parseInt(e.target.value,10) || 0)} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
           <FormField
            control={form.control}
            name="cost"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Costo (C$) *</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="Ej: 1500.50" {...field} value={field.value || 0} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="provider"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Proveedor *</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: Taller Local" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
            control={form.control}
            name="activitiesPerformed"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Actividades Realizadas *</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Describa las actividades de mantenimiento realizadas..."
                    className="resize-y min-h-[100px]"
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        
        <div>
          <FormLabel className="flex items-center mb-2">
            <UploadCloud className="mr-2 h-5 w-5 text-muted-foreground"/>
            Adjuntar Archivos (Facturas, Fotos, etc.)
          </FormLabel>
          <FormControl>
            <Input 
              type="file" 
              multiple
              ref={fileInputRef}
              onChange={handleFileChange}
              className="cursor-pointer"
              accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt" // Example accepted types
            />
          </FormControl>
          <FormDescription className="mt-1">Opcional. Puede seleccionar múltiples archivos.</FormDescription>
          {/* Display selected/existing files */}
          {currentAttachments.length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="text-sm font-medium">Archivos Adjuntos:</h4>
              <ul className="list-disc list-inside space-y-1">
                {currentAttachments.map((att) => (
                  <li key={att.id || att.tempId} className="text-sm flex justify-between items-center p-1 rounded-md hover:bg-muted/50">
                    <span>
                      <Paperclip className="inline mr-2 h-4 w-4 text-muted-foreground" />
                      {att.fileName} ({att.fileType})
                    </span>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removeAttachment(att.id || att.tempId!, !!att.isNew)} 
                      className="h-6 w-6 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Quitar archivo</span>
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <FormMessage />
        </div>
        

        {maintenanceType === "Preventivo" && (
           <>
            <h3 className="text-lg font-medium text-primary pt-4 border-t">Próximo Mantenimiento Programado (Preventivo)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="nextMaintenanceMileageScheduled"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Próx. Mantenimiento por Kilometraje (km) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Ej: 65000"
                        {...field}
                        value={field.value || 0}
                        onChange={e => field.onChange(parseInt(e.target.value,10) || 0)}
                      />
                    </FormControl>
                    <FormDescription>Kilometraje recomendado para el próximo servicio preventivo.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nextMaintenanceDateScheduled"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Próx. Mantenimiento por Fecha *</FormLabel>
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
                              format(field.value, "PPP")
                            ) : (
                              <span>Seleccione una fecha</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                           disabled={(date) => date < new Date(new Date().setDate(new Date().getDate()))} 
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormDescription>Fecha recomendada para el próximo servicio preventivo.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
           </>
        )}
        
        <div className="flex justify-end pt-6 border-t">
          <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90">
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {maintenanceLog ? "Guardar Cambios" : "Registrar Mantenimiento"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

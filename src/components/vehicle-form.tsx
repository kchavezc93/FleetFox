
"use client";

import type { Vehicle, VehicleFormData } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { vehicleSchema, type VehicleSchema } from "@/lib/zod-schemas";
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
import { CalendarIcon, Save, Loader2 } from "lucide-react"; 
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import React from "react";

interface VehicleFormProps {
  vehicle?: Vehicle | null;
  onSubmitAction: (data: VehicleFormData) => Promise<{ message: string; errors?: any; vehicle?: Vehicle }>;
}

export function VehicleForm({ vehicle, onSubmitAction }: VehicleFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  const defaultValues = React.useMemo(() => ({
    plateNumber: vehicle?.plateNumber || "",
    vin: vehicle?.vin || "",
    brand: vehicle?.brand || "",
    model: vehicle?.model || "",
    year: vehicle?.year || new Date().getFullYear(),
    fuelType: vehicle?.fuelType || "Gasolina",
    currentMileage: vehicle?.currentMileage || 0,
    nextPreventiveMaintenanceMileage: vehicle?.nextPreventiveMaintenanceMileage || 0,
    nextPreventiveMaintenanceDate: vehicle?.nextPreventiveMaintenanceDate ? new Date(vehicle.nextPreventiveMaintenanceDate + "T00:00:00") : new Date(),
    status: vehicle?.status || "Activo",
  }), [vehicle]);


  const form = useForm<VehicleSchema>({
    resolver: zodResolver(vehicleSchema),
    defaultValues,
  });
  
  React.useEffect(() => {
     form.reset({
        plateNumber: vehicle?.plateNumber || "",
        vin: vehicle?.vin || "",
        brand: vehicle?.brand || "",
        model: vehicle?.model || "",
        year: vehicle?.year || new Date().getFullYear(),
        fuelType: vehicle?.fuelType || "Gasolina",
        currentMileage: vehicle?.currentMileage || 0,
        nextPreventiveMaintenanceMileage: vehicle?.nextPreventiveMaintenanceMileage || 0,
        nextPreventiveMaintenanceDate: vehicle?.nextPreventiveMaintenanceDate ? new Date(vehicle.nextPreventiveMaintenanceDate + "T00:00:00") : new Date(),
        status: vehicle?.status || "Activo",
    });
  }, [vehicle, form]);


  async function onSubmit(data: VehicleSchema) {
    setIsSubmitting(true);
    try {
      const formDataForAction: VehicleFormData = {
        ...data,
        nextPreventiveMaintenanceDate: data.nextPreventiveMaintenanceDate, 
      };
      const result = await onSubmitAction(formDataForAction);
      toast({
        title: "Éxito",
        description: result.message,
      });
      if (result.vehicle && !result.errors) {
        router.push("/vehicles"); 
        router.refresh(); 
      } else if (result.errors) {
        Object.entries(result.errors).forEach(([field, message]) => {
          form.setError(field as keyof VehicleSchema, { type: "manual", message: message as string });
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
            name="plateNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Matrícula *</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: ABC-123" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="vin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>VIN (Nº de Identificación Vehicular) *</FormLabel>
                <FormControl>
                  <Input placeholder="Ingrese VIN" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="brand"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Marca *</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: Toyota" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="model"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Modelo *</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: Hilux" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="year"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Año *</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="Ej: 2023" {...field} value={field.value} onChange={e => field.onChange(parseInt(e.target.value,10) || 0)} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="fuelType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de Combustible *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione tipo de combustible" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Gasolina">Gasolina</SelectItem>
                    <SelectItem value="Diesel">Diesel</SelectItem>
                    <SelectItem value="Eléctrico">Eléctrico</SelectItem>
                    <SelectItem value="Híbrido">Híbrido</SelectItem>
                    <SelectItem value="Otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="currentMileage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Kilometraje Actual (km) *</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="Ej: 50000" {...field} value={field.value} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
           <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estado *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione estado" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Activo">Activo</SelectItem>
                    <SelectItem value="En Taller">En Taller</SelectItem>
                    <SelectItem value="Inactivo">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <h3 className="text-lg font-medium text-primary pt-4 border-t">Mantenimiento Preventivo</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <FormField
            control={form.control}
            name="nextPreventiveMaintenanceMileage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Próx. Mantenimiento por Kilometraje (km) *</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="Ej: 60000" {...field} value={field.value} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} />
                </FormControl>
                <FormDescription>Kilometraje para el próximo mantenimiento preventivo programado.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="nextPreventiveMaintenanceDate"
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
                          <span>Cargando fecha...</span>
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
                      disabled={(date) => date < new Date(new Date().setDate(new Date().getDate() -1))} 
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormDescription>Fecha para el próximo mantenimiento preventivo programado.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <div className="flex justify-end space-x-4 pt-6 border-t">
          <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90">
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {vehicle ? "Guardar Cambios" : "Crear Vehículo"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

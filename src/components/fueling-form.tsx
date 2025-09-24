
"use client";

import type { FuelingFormData, Vehicle } from "@/types";
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
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import React from "react";

interface FuelingFormProps {
  vehicles: Vehicle[];
  onSubmitAction: (data: FuelingFormData) => Promise<{ message: string; errors?: any }>;
  initial?: Partial<FuelingFormData> & { id?: string };
  submitLabel?: string;
}

export function FuelingForm({ vehicles, onSubmitAction, initial, submitLabel }: FuelingFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  const form = useForm<FuelingLogSchema>({
    resolver: zodResolver(fuelingLogSchema),
    defaultValues: {
      vehicleId: initial?.vehicleId || "",
      fuelingDate: initial?.fuelingDate ? (initial.fuelingDate instanceof Date ? initial.fuelingDate : new Date(initial.fuelingDate)) : new Date(), 
      mileageAtFueling: initial?.mileageAtFueling ?? 0,
      quantityLiters: initial?.quantityLiters ?? 0, 
      costPerLiter: initial?.costPerLiter ?? 0, 
      totalCost: initial?.totalCost ?? 0,
      station: initial?.station || "",
      imageUrl: initial?.imageUrl || "",
    },
  });

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
      const formDataForAction: FuelingFormData = {
        ...data,
        fuelingDate: data.fuelingDate, 
        imageUrl: data.imageUrl || undefined, // Ensure undefined if empty string
      };
      const result = await onSubmitAction(formDataForAction);
      toast({
        title: "Éxito",
        description: result.message,
      });
      if (!result.errors) {
        router.push("/fueling");
        router.refresh();
      } else {
         Object.entries(result.errors).forEach(([field, message]) => {
          form.setError(field as keyof FuelingLogSchema, { type: "manual", message: message as string });
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
          <FormField<FuelingLogSchema, "vehicleId">
            control={form.control}
            name="vehicleId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vehículo *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
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
                      disabled={(date) => date > new Date()}
                      initialFocus
                    />
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

          <FormField<FuelingLogSchema, "imageUrl">
            control={form.control}
            name="imageUrl"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel className="flex items-center">
                  <ImagePlus className="mr-2 h-4 w-4 text-muted-foreground"/>
                  URL de Imagen (Recibo)
                </FormLabel>
                <FormControl>
                  <Input 
                    type="url" 
                    placeholder="https://ejemplo.com/imagen_recibo.png" 
                    {...field} 
                    value={field.value || ""}
                  />
                </FormControl>
                <FormDescription>Opcional. Ingrese la URL de una imagen del recibo de combustible.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        
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

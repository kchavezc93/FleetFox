"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

type Voucher = {
  id: string;
  fileName: string;
  fileType: string;
  fileContent: string; // data URL
};

interface VoucherGalleryProps {
  vouchers: Voucher[];
  fuelingLogId?: string; // optional to enable delete controls
}

export function VoucherGallery({ vouchers, fuelingLogId }: VoucherGalleryProps) {
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);

  const openAt = (idx: number) => {
    setActiveIndex(idx);
    setOpen(true);
  };

  const active = activeIndex != null ? vouchers[activeIndex] : null;

  return (
    <div className="md:col-span-2">
      <div className="text-sm text-muted-foreground mb-2">Vouchers (previsualización)</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {vouchers.map((v, idx) => (
          <div key={v.id} className="border rounded overflow-hidden group">
            <button
              type="button"
              onClick={() => openAt(idx)}
              className="text-left w-full focus:outline-none"
              aria-label={`Abrir voucher ${v.fileName}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={v.fileContent} alt={v.fileName} className="w-full h-32 object-cover" />
            </button>
            <div className="p-1 text-xs flex items-center justify-between gap-2">
              <div className="truncate" title={v.fileName}>{v.fileName}</div>
              {fuelingLogId && (
                <form
                  action={async () => {
                    try {
                      await fetch('/api/fueling/vouchers/delete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ voucherId: v.id, logId: fuelingLogId }),
                      });
                      // Let the page refetch or rely on revalidatePath server-side after deletion
                    } catch (e) {
                      console.error('Error eliminando voucher', e);
                    }
                  }}
                >
                  <ConfirmSubmitButton variant="destructive" confirmMessage="¿Eliminar este voucher?" className="h-6 px-2 py-0 text-xs">
                    Eliminar
                  </ConfirmSubmitButton>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setActiveIndex(null); }}>
        <DialogContent className="max-w-3xl">
          {active && (
            <div className="space-y-3">
              <DialogHeader>
                <DialogTitle className="text-base font-medium truncate" title={active.fileName}>
                  {active.fileName}
                </DialogTitle>
              </DialogHeader>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={active.fileContent}
                alt={active.fileName}
                className="w-full max-h-[70vh] object-contain rounded"
              />
              <div className="flex justify-end gap-2">
                <a
                  href={active.fileContent}
                  download={active.fileName}
                  className="px-3 py-1.5 text-sm border rounded hover:bg-muted"
                >
                  Descargar
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

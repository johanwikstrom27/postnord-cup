"use client";

type AdminLockPreviewModalProps = {
  open: boolean;
  busy?: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: () => void;
  children: React.ReactNode;
};

export default function AdminLockPreviewModal({
  open,
  busy = false,
  title,
  description,
  confirmLabel = "Lås och skicka ut",
  onClose,
  onConfirm,
  children,
}: AdminLockPreviewModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm md:items-center">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#131824] shadow-2xl shadow-black/40">
        <div className="border-b border-white/10 px-5 py-4 md:px-6">
          <div className="text-xs uppercase tracking-[0.28em] text-white/45">Förhandsgranska</div>
          <h2 className="mt-2 text-xl font-semibold text-white md:text-2xl">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm text-white/65">{description}</p>
        </div>

        <div className="overflow-y-auto px-5 py-5 md:px-6">{children}</div>

        <div className="flex flex-col-reverse gap-3 border-t border-white/10 bg-white/[0.03] px-5 py-4 md:flex-row md:items-center md:justify-end md:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Tillbaka
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-2xl border border-emerald-400/20 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

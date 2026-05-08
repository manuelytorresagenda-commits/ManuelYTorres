import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import { Delete, X } from "lucide-react";

/**
 * Reusable 4-digit PIN entry dialog.
 * Calls onVerify(pin) which must return a Promise. On success, the dialog closes
 * and onSuccess() is fired. On error, the PIN clears and an error message shows.
 */
export default function PinPromptDialog({
  open,
  onClose,
  onVerify,
  onSuccess,
  title = "Ingrese PIN",
  subtitle = "Cuatro dígitos para acceder.",
  errorText = "PIN incorrecto",
  confirmText = null,        // Optional: word the user must type before PIN unlocks (e.g. "ELIMINAR")
  confirmLabel = null,       // Optional: label/instruction for the confirmation input
}) {
  const [pin, setPin] = useState("");
  const [confirmInput, setConfirmInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errored, setErrored] = useState(false);

  const requiresConfirm = !!confirmText;
  const confirmOk = !requiresConfirm || confirmInput.trim().toUpperCase() === String(confirmText).toUpperCase();

  useEffect(() => {
    if (open) {
      setPin("");
      setConfirmInput("");
      setLoading(false);
      setErrored(false);
    }
  }, [open]);

  const press = async (digit) => {
    if (loading) return;
    if (!confirmOk) return;
    if (pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    setErrored(false);
    if (next.length === 4) {
      setLoading(true);
      try {
        await onVerify(next);
        onSuccess && onSuccess();
        onClose && onClose();
      } catch {
        setErrored(true);
        setTimeout(() => setPin(""), 350);
      } finally {
        setTimeout(() => setLoading(false), 200);
      }
    }
  };

  const del = () => setPin((p) => p.slice(0, -1));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose && onClose()}>
      <DialogContent
        data-testid="pin-prompt-dialog"
        className="max-w-sm bg-white border border-black rounded-none p-0 gap-0 [&>button]:hidden"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{subtitle}</DialogDescription>

        <div className="flex items-start justify-between p-6 border-b border-black">
          <div>
            <div className="font-mono-label text-[10px] text-neutral-500">─── ACCESO</div>
            <div className="font-serif-display text-2xl mt-1 leading-none">{title}</div>
            <div className="text-[11px] text-neutral-600 mt-1">{subtitle}</div>
          </div>
          <button
            type="button"
            data-testid="pin-prompt-close-btn"
            onClick={onClose}
            className="btn-invert border border-black p-2 hover:bg-black hover:text-white"
            aria-label="Cerrar"
          >
            <X className="w-3 h-3" strokeWidth={1.5} />
          </button>
        </div>

        <div className="p-6">
          {/* Dots */}
          <div
            className={`flex gap-3 mb-6 justify-center ${errored ? "animate-shake" : ""}`}
            data-testid="pin-prompt-dots"
          >
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                data-testid={`pin-prompt-dot-${i}`}
                className={`w-3.5 h-3.5 border ${
                  errored ? "border-red-600" : "border-black"
                } ${i < pin.length ? (errored ? "bg-red-600" : "bg-black") : "bg-white"}`}
              />
            ))}
          </div>

          {errored && (
            <p
              data-testid="pin-prompt-error"
              className="text-center font-mono-label text-[10px] text-red-600 mb-3"
            >
              {errorText}
            </p>
          )}

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-2" data-testid="pin-prompt-keypad">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <button
                key={n}
                data-testid={`pin-prompt-key-${n}`}
                onClick={() => press(String(n))}
                disabled={loading}
                className="btn-invert h-14 border border-black bg-white hover:bg-black hover:text-white font-serif-display text-2xl disabled:opacity-50"
              >
                {n}
              </button>
            ))}
            <button
              data-testid="pin-prompt-key-clear"
              onClick={() => { setPin(""); setErrored(false); }}
              className="btn-invert h-14 border border-neutral-300 text-neutral-500 hover:border-black hover:text-black font-mono-label text-[10px]"
            >
              CLEAR
            </button>
            <button
              data-testid="pin-prompt-key-0"
              onClick={() => press("0")}
              disabled={loading}
              className="btn-invert h-14 border border-black bg-white hover:bg-black hover:text-white font-serif-display text-2xl disabled:opacity-50"
            >
              0
            </button>
            <button
              data-testid="pin-prompt-key-delete"
              onClick={del}
              className="btn-invert h-14 border border-neutral-300 text-neutral-500 hover:border-black hover:text-black flex items-center justify-center"
            >
              <Delete className="w-4 h-4" strokeWidth={1} />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

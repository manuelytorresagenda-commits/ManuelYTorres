import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import { verifyMasterPin, updateBranchPin } from "../lib/api";
import { toast } from "sonner";
import { Delete, X, ShieldCheck } from "lucide-react";

/**
 * Two-step dialog: (1) master PIN check, (2) set new PIN for a branch.
 */
export default function ChangeBranchPinDialog({ open, onClose, branch }) {
  const [phase, setPhase] = useState("master"); // master | new
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    if (open) {
      setPhase("master");
      setPin("");
      setErrored(false);
      setLoading(false);
    }
  }, [open]);

  const press = async (digit) => {
    if (loading) return;
    if (pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    setErrored(false);
    if (next.length === 4) {
      setLoading(true);
      if (phase === "master") {
        try {
          await verifyMasterPin(next);
          // Move to new PIN phase
          setTimeout(() => {
            setPhase("new");
            setPin("");
            setLoading(false);
          }, 200);
        } catch {
          setErrored(true);
          setTimeout(() => { setPin(""); setLoading(false); }, 350);
        }
      } else {
        // phase === "new"
        try {
          await updateBranchPin(branch.id, next);
          toast.success(`PIN actualizado para ${branch.name.split("·").pop().trim()}`);
          setLoading(false);
          onClose && onClose();
        } catch (err) {
          toast.error(err.response?.data?.detail || "No se pudo actualizar el PIN");
          setErrored(true);
          setTimeout(() => { setPin(""); setLoading(false); }, 350);
        }
      }
    }
  };

  const del = () => setPin((p) => p.slice(0, -1));

  const title = phase === "master" ? "PIN Maestro" : "Nuevo PIN";
  const subtitle =
    phase === "master"
      ? "Ingrese el PIN maestro de la app para autorizar el cambio."
      : `Defina el nuevo PIN de 4 dígitos para ${branch?.name?.split("·").pop().trim() || "la sucursal"}.`;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose && onClose()}>
      <DialogContent
        data-testid="change-branch-pin-dialog"
        className="max-w-sm bg-white border border-black rounded-none p-0 gap-0 [&>button]:hidden"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{subtitle}</DialogDescription>

        <div className="flex items-start justify-between p-6 border-b border-black">
          <div>
            <div className="font-mono-label text-[10px] text-neutral-500 flex items-center gap-2">
              <ShieldCheck className="w-3 h-3" strokeWidth={1.5} />
              PASO {phase === "master" ? "1 / 2" : "2 / 2"}
            </div>
            <div className="font-serif-display text-2xl mt-1 leading-none" data-testid="cb-pin-title">
              {title}
            </div>
            <div className="text-[11px] text-neutral-600 mt-2 max-w-[16rem]">{subtitle}</div>
          </div>
          <button
            type="button"
            data-testid="cb-pin-close-btn"
            onClick={onClose}
            className="btn-invert border border-black p-2 hover:bg-black hover:text-white"
            aria-label="Cerrar"
          >
            <X className="w-3 h-3" strokeWidth={1.5} />
          </button>
        </div>

        <div className="p-6">
          <div
            className={`flex gap-3 mb-6 justify-center ${errored ? "animate-shake" : ""}`}
            data-testid="cb-pin-dots"
          >
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-3.5 h-3.5 border ${
                  errored ? "border-red-600" : "border-black"
                } ${i < pin.length ? (errored ? "bg-red-600" : "bg-black") : "bg-white"}`}
              />
            ))}
          </div>

          {errored && (
            <p
              data-testid="cb-pin-error"
              className="text-center font-mono-label text-[10px] text-red-600 mb-3"
            >
              {phase === "master" ? "PIN maestro incorrecto" : "PIN inválido"}
            </p>
          )}

          <div className="grid grid-cols-3 gap-2" data-testid="cb-pin-keypad">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <button
                key={n}
                data-testid={`cb-pin-key-${n}`}
                onClick={() => press(String(n))}
                disabled={loading}
                className="btn-invert h-14 border border-black bg-white hover:bg-black hover:text-white font-serif-display text-2xl disabled:opacity-50"
              >
                {n}
              </button>
            ))}
            <button
              data-testid="cb-pin-key-clear"
              onClick={() => { setPin(""); setErrored(false); }}
              className="btn-invert h-14 border border-neutral-300 text-neutral-500 hover:border-black hover:text-black font-mono-label text-[10px]"
            >
              CLEAR
            </button>
            <button
              data-testid="cb-pin-key-0"
              onClick={() => press("0")}
              disabled={loading}
              className="btn-invert h-14 border border-black bg-white hover:bg-black hover:text-white font-serif-display text-2xl disabled:opacity-50"
            >
              0
            </button>
            <button
              data-testid="cb-pin-key-delete"
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

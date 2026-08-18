import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import { createClient } from "../lib/api";
import { toast } from "sonner";
import { X, Instagram, Music2, Cake, UserCheck, Phone } from "lucide-react";
import ClientAutocomplete from "./ClientAutocomplete";

export default function NewClientModal({ open, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [birthday, setBirthday] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setPhone("");
      setInstagram("");
      setTiktok("");
      setBirthday("");
    }
  }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("El nombre del cliente es obligatorio");
      return;
    }
    setSubmitting(true);
    try {
      await createClient({
        name: name.trim(),
        phone: phone.trim(),
        instagram: instagram.trim(),
        tiktok: tiktok.trim(),
        birthday: birthday.trim(),
      });
      toast.success(`Cliente guardada exitosamente: ${name}`);
      onCreated && onCreated();
      onClose && onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "No se pudo guardar la información del cliente");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose && onClose()}>
      <DialogContent
        data-testid="new-client-modal"
        className="max-w-xl bg-white border-2 border-black rounded-none p-0 gap-0 [&>button]:hidden"
      >
        <DialogTitle className="sr-only">Guardar Cliente</DialogTitle>
        <DialogDescription className="sr-only">
          Formulario para dar de alta a una clienta frecuente sin agendar una cita de inmediato.
        </DialogDescription>

        <div className="flex items-start justify-between p-6 lg:p-8 border-b-2 border-black">
          <div>
            <div className="font-mono-label text-[10px] font-bold text-black">DIRECTORIO</div>
            <div className="font-serif-display text-3xl lg:text-4xl mt-1 leading-none text-black font-bold">
              Guardar <em className="italic">Cliente</em>
            </div>
          </div>
          <button
            type="button"
            data-testid="client-modal-close-btn"
            onClick={onClose}
            className="btn-invert border-2 border-black p-2 hover:bg-black hover:text-white"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 lg:p-8 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Client Name */}
          <div>
            <label className="font-mono-label text-[10px] font-bold text-black block mb-2 flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-black" strokeWidth={2} /> NOMBRE COMPLETO *
            </label>
            <ClientAutocomplete
              testid="modal-client-name-input"
              value={name}
              onChange={setName}
              onPick={(c) => {
                setName(c.name || "");
                setPhone(c.phone || "");
                setInstagram(c.instagram || "");
                setTiktok(c.tiktok || "");
                setBirthday(c.birthday || "");
                toast.info(`Cliente existente seleccionado: ${c.name}`);
              }}
              placeholder="Nombre completo (escriba para buscar o registrar nuevo)"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="font-mono-label text-[10px] font-bold text-black block mb-2 flex items-center gap-1">
              <Phone className="w-3.5 h-3.5 text-black" strokeWidth={2} /> TELÉFONO <span className="opacity-70">(opcional)</span>
            </label>
            <input
              data-testid="modal-client-phone-input"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ej. 55 1234 5678"
              className="w-full border-2 border-black px-4 py-3 bg-white outline-none focus:ring-1 focus:ring-black font-mono-label text-xs font-bold text-black placeholder:text-neutral-500"
            />
          </div>

          {/* Social + birthday */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div>
              <label className="font-mono-label text-[10px] font-bold text-black block mb-2 flex items-center gap-1">
                <Instagram className="w-3.5 h-3.5 text-black" strokeWidth={2} /> INSTAGRAM
              </label>
              <div className="flex">
                <span className="border-2 border-r-0 border-black px-3 py-3 bg-neutral-100 font-mono-label text-[10px] font-bold text-black flex items-center">@</span>
                <input
                  data-testid="modal-client-instagram-input"
                  type="text"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value.replace(/^@/, ""))}
                  placeholder="usuario"
                  autoComplete="off"
                  className="w-full border-2 border-black px-4 py-3 bg-white outline-none focus:ring-1 focus:ring-black font-mono-label text-xs font-bold text-black placeholder:text-neutral-500"
                />
              </div>
            </div>
            <div>
              <label className="font-mono-label text-[10px] font-bold text-black block mb-2 flex items-center gap-1">
                <Music2 className="w-3.5 h-3.5 text-black" strokeWidth={2} /> TIKTOK
              </label>
              <div className="flex">
                <span className="border-2 border-r-0 border-black px-3 py-3 bg-neutral-100 font-mono-label text-[10px] font-bold text-black flex items-center">@</span>
                <input
                  data-testid="modal-client-tiktok-input"
                  type="text"
                  value={tiktok}
                  onChange={(e) => setTiktok(e.target.value.replace(/^@/, ""))}
                  placeholder="usuario"
                  autoComplete="off"
                  className="w-full border-2 border-black px-4 py-3 bg-white outline-none focus:ring-1 focus:ring-black font-mono-label text-xs font-bold text-black placeholder:text-neutral-500"
                />
              </div>
            </div>
            <div>
              <label className="font-mono-label text-[10px] font-bold text-black block mb-2 flex items-center gap-1">
                <Cake className="w-3.5 h-3.5 text-black" strokeWidth={2} /> CUMPLEAÑOS
              </label>
              <input
                data-testid="modal-client-birthday-input"
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                className="w-full border-2 border-black px-4 py-3 bg-white outline-none focus:ring-1 focus:ring-black font-mono-label text-xs font-bold text-black"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              data-testid="client-modal-cancel-btn"
              className="btn-invert flex-1 border-2 border-black bg-white text-black py-3 font-mono-label text-[10px] font-bold hover:bg-neutral-100"
            >
              CANCELAR
            </button>
            <button
              type="submit"
              data-testid="client-modal-submit-btn"
              disabled={submitting}
              className="btn-invert flex-1 border-2 border-black bg-black text-white py-3 font-mono-label text-[10px] font-bold hover:bg-white hover:text-black disabled:opacity-50"
            >
              {submitting ? "GUARDANDO..." : "GUARDAR CLIENTE"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

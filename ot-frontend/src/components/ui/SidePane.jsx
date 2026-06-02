import { useEffect, useState } from "react";
import { X } from "lucide-react";

export default function SidePane({ isOpen, onClose, title, children, footer }) {
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRendered(true);
    } else {
      const t = setTimeout(() => setRendered(false), 280);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  if (!rendered) return null;

  return (
    <div className="z-side-pane-overlay" onClick={onClose}>
      <div
        className="z-side-pane"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="z-side-pane-header">
          <h2 className="z-side-pane-title">{title}</h2>
          <button onClick={onClose} className="z-modal-close" aria-label="Close">
            <X />
          </button>
        </div>
        <div className="z-side-pane-body">{children}</div>
        {footer && (
          <div className="z-side-pane-footer">{footer}</div>
        )}
      </div>
    </div>
  );
}

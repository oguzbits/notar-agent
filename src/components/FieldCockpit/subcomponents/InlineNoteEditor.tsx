import { Check, X } from 'lucide-react';
import React, { useState } from 'react';
import { useClickOutside } from '@/hooks/useClickOutside';

interface InlineNoteEditorProps {
  fieldKey: string;
  initialNote: string;
  onSave: (newNote: string) => void;
  onCancel: () => void;
}

export const InlineNoteEditor: React.FC<InlineNoteEditorProps> = ({
  initialNote,
  onSave,
  onCancel,
}) => {
  const [noteValue, setNoteValue] = useState(initialNote);

  const containerRef = useClickOutside<HTMLDivElement>(onCancel, {
    enabled: true,
    onEscape: true,
  });

  return (
    <div ref={containerRef} className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
      <textarea
        rows={3}
        value={noteValue}
        onChange={(e) => setNoteValue(e.target.value)}
        placeholder="Befund / Prüfungshinweis anpassen..."
        className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-notar-900 w-full rounded-md border p-2 text-xs focus:ring-2 focus:outline-none"
        autoFocus
      />
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onSave(noteValue.trim())}
          className="bg-notar-500 text-notar-950 hover:bg-notar-600 text-2xs inline-flex cursor-pointer items-center gap-1 rounded px-2.5 py-1 font-semibold shadow-2xs"
        >
          <Check className="h-3 w-3" />
          Speichern
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground border-border bg-background text-2xs inline-flex cursor-pointer items-center gap-1 rounded border px-2 py-1"
        >
          <X className="h-3 w-3" />
          Abbrechen
        </button>
      </div>
    </div>
  );
};
